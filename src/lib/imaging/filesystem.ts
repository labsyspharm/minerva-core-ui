import { loadOmeTiff } from "@hms-dbmi/viv";
import { fileOpen } from "browser-fs-access";
import { fromBlob, GeoTIFFImage } from "geotiff";
import type { HasTile, LoaderPlane } from "./loaderTypes";
import type { Loader } from "./viv";
import type { PoolClass } from "./workers/pool";

type GeoTiff = Awaited<ReturnType<typeof fromBlob>>;
type GeoTiffImage = Awaited<ReturnType<GeoTiff["getImage"]>>;

/** Fields geotiff uses when constructing SubIFD images (not in public typings). */
type GeoTiffInternals = GeoTiff & {
  dataView: DataView;
  littleEndian: boolean;
  cache: unknown;
  source: unknown;
  parseFileDirectoryAt: (offset: number) => Promise<{
    fileDirectory: GeoTiffImage["fileDirectory"];
    geoKeyDirectory: unknown;
  }>;
};

type FindFileIn = {
  handle: Handle.File;
};
type FindFile = (i: FindFileIn) => Promise<boolean>;
type ToFiles = () => Promise<Handle.File[]>;
type LoaderIn = {
  in_f: string;
  handle: Handle.File;
  pool?: PoolClass;
};
type ToLoader = (i: LoaderIn) => Promise<Loader>;
type ToMaskLoader = (i: LoaderIn) => Promise<Loader>;

/** Viv's published OME metadata types are looser than our app `Loader` shape. */
function asAppLoader(image: Awaited<ReturnType<typeof loadOmeTiff>>): Loader {
  return image as Loader;
}
export type Selection = {
  t: number;
  z: number;
  c: number;
};
type TileConfig = {
  x: number;
  y: number;
  signal: AbortSignal;
  selection: Selection;
};
export type Dtype =
  | "Uint8"
  | "Uint16"
  | "Uint32"
  | "Int8"
  | "Int16"
  | "Int32"
  | "Float32"
  | "Float64";
type OmePixelMetadata = Loader["metadata"]["Pixels"];

function dtypeFromTiffDirectory(fileDirectory: {
  BitsPerSample?: number[];
  SampleFormat?: number[];
}): Dtype {
  const bits = fileDirectory.BitsPerSample?.[0] ?? 16;
  const sampleFormat = fileDirectory.SampleFormat?.[0] ?? 1;
  if (sampleFormat === 3) return bits === 64 ? "Float64" : "Float32";
  if (sampleFormat === 2) {
    if (bits <= 8) return "Int8";
    if (bits <= 16) return "Int16";
    return "Int32";
  }
  if (bits <= 8) return "Uint8";
  if (bits <= 16) return "Uint16";
  return "Uint32";
}

/** First OME Pixels block — size/units only (channel names come from import). */
function parseFirstOmeImagePixels(
  imageDescription: unknown,
): Partial<OmePixelMetadata> | null {
  if (typeof imageDescription !== "string" || imageDescription.trim() === "") {
    return null;
  }
  const doc = new DOMParser().parseFromString(
    imageDescription,
    "application/xml",
  );
  const pixels = doc.querySelector("Image")?.querySelector("Pixels");
  if (!pixels) return null;
  const num = (name: string) => {
    const value = pixels.getAttribute(name);
    return value == null ? undefined : Number(value);
  };
  const channelCount = pixels.querySelectorAll("Channel").length;
  return {
    ID: pixels.getAttribute("ID") ?? undefined,
    Type: pixels.getAttribute("Type") ?? undefined,
    SizeC: num("SizeC") ?? (channelCount > 0 ? channelCount : undefined),
    PhysicalSizeX: num("PhysicalSizeX"),
    PhysicalSizeY: num("PhysicalSizeY"),
    PhysicalSizeXUnit: pixels.getAttribute("PhysicalSizeXUnit") ?? undefined,
    PhysicalSizeYUnit: pixels.getAttribute("PhysicalSizeYUnit") ?? undefined,
    PhysicalSizeZUnit: pixels.getAttribute("PhysicalSizeZUnit") ?? undefined,
    BigEndian: false,
  };
}

const FALLBACK_MAX_TEXTURE_SIZE = 4096;
let cachedMaxTextureSize: number | undefined;

/** WebGL `MAX_TEXTURE_SIZE`; cached. Fallback 4096 if there is no GPU context. */
function queryMaxTextureSize(): number {
  if (cachedMaxTextureSize != null) return cachedMaxTextureSize;
  if (typeof document === "undefined") {
    cachedMaxTextureSize = FALLBACK_MAX_TEXTURE_SIZE;
    return cachedMaxTextureSize;
  }
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  const size =
    gl && typeof gl.getParameter === "function"
      ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))
      : NaN;
  cachedMaxTextureSize =
    Number.isFinite(size) && size > 0 ? size : FALLBACK_MAX_TEXTURE_SIZE;
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  return cachedMaxTextureSize;
}

function tiffDirNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value) && typeof value[0] === "number") return value[0];
  return 0;
}

/** True TIFF tiles — not geotiff's ImageWidth / RowsPerStrip fallback. */
function isTiffTiled(image: GeoTiffImage): boolean {
  const fd = image.fileDirectory as {
    TileWidth?: unknown;
    TileLength?: unknown;
  };
  return tiffDirNumber(fd.TileWidth) > 0 && tiffDirNumber(fd.TileLength) > 0;
}

function isTiffPyramided(image: GeoTiffImage): boolean {
  const offsets = (image.fileDirectory as { SubIFDs?: unknown }).SubIFDs;
  return Array.isArray(offsets) && offsets.length > 0;
}

/** Power-of-two tile size, matching Viv MultiscaleImageLayer. */
function vivTileSize(image: GeoTiffImage): number {
  const tw = image.getTileWidth();
  const th = image.getTileHeight();
  const size = Math.min(tw, th);
  return 2 ** Math.floor(Math.log2(Math.max(1, size)));
}

async function readTiffRaster(
  image: GeoTiffImage,
  sample: number,
): Promise<HasTile> {
  const raster = (await image.readRasters({
    samples: [sample],
    interleave: true,
  })) as ArrayLike<number> & { width?: number; height?: number };
  return {
    data: raster as unknown as HasTile["data"],
    width: raster.width ?? image.getWidth(),
    height: raster.height ?? image.getHeight(),
  };
}

async function readTiffTile(
  image: GeoTiffImage,
  sample: number,
  tileX: number,
  tileY: number,
  tileSize: number,
): Promise<HasTile> {
  const x0 = tileX * tileSize;
  const y0 = tileY * tileSize;
  const x1 = Math.min(x0 + tileSize, image.getWidth());
  const y1 = Math.min(y0 + tileSize, image.getHeight());
  const width = x1 - x0;
  const height = y1 - y0;
  const raster = (await image.readRasters({
    samples: [sample],
    interleave: true,
    window: [x0, y0, x1, y1],
    width,
    height,
  })) as ArrayLike<number> & { width?: number; height?: number };
  return {
    data: raster as unknown as HasTile["data"],
    width: raster.width ?? width,
    height: raster.height ?? height,
  };
}

/** IFD 0 + SubIFD reduced-resolution levels. */
async function resolveMaskPyramidImages(
  tiff: GeoTiff,
  baseImage: GeoTiffImage,
): Promise<GeoTiffImage[]> {
  const images: GeoTiffImage[] = [baseImage];
  const offsets = (baseImage.fileDirectory as { SubIFDs?: number[] }).SubIFDs;
  if (!Array.isArray(offsets) || offsets.length === 0) return images;

  const internals = tiff as GeoTiffInternals;
  for (const offset of offsets) {
    const parsed = await internals.parseFileDirectoryAt(offset);
    images.push(
      new GeoTIFFImage(
        parsed.fileDirectory,
        parsed.geoKeyDirectory,
        internals.dataView,
        internals.littleEndian,
        internals.cache,
        internals.source,
      ) as unknown as GeoTiffImage,
    );
  }
  return images;
}

function maskPlaneFromImage(
  image: GeoTiffImage,
  sizeC: number,
  dtype: Dtype,
): LoaderPlane {
  const width = image.getWidth();
  const height = image.getHeight();
  const tiled = isTiffTiled(image);
  const tileSize = tiled ? vivTileSize(image) : Math.max(width, height, 1);
  const clampC = (c: number) => Math.max(0, Math.min(sizeC - 1, c));
  const getRaster = ({ selection }: { selection: Selection }) =>
    readTiffRaster(image, clampC(selection.c));
  return {
    dtype,
    shape: [1, sizeC, 1, height, width],
    tileSize,
    labels: ["t", "c", "z", "y", "x"],
    onTileError: () => undefined,
    getRaster,
    getTile: tiled
      ? ({ x, y, selection }) =>
          readTiffTile(image, clampC(selection.c), x, y, tileSize)
      : async ({ x, y, selection }) => {
          if (x !== 0 || y !== 0) {
            return { data: new Uint8Array(0), width: 0, height: 0 };
          }
          return getRaster({ selection });
        },
  };
}

/** Directory picker — required for batch export to a chosen folder (Chromium-class browsers). */
function hasDirectoryPickerAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/**
 * Author shell (Dexie, workers, remote image URLs) runs in a secure context.
 * Do not gate on `showDirectoryPicker`: Firefox lacks it while still supporting URL/DICOM
 * workflows and (via fallback picker) single-session local TIFF picks.
 */
function hasAuthorShellSupport(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/**
 * Stand-in when `fileOpen` returns a legacy `File` without `FileSystemFileHandle`.
 * Cannot be structured-cloned into IndexedDB; skip persistence for these handles.
 */
function ephemeralFileHandleFromFile(file: File): Handle.File {
  const h = {
    kind: "file" as const,
    name: file.name,
    getFile: async () => file,
    createWritable: async () => {
      throw new DOMException("Ephemeral file handle", "NotSupportedError");
    },
    isSameEntry: async () => false,
    queryPermission: async () => "granted" as PermissionState,
    requestPermission: async () => "granted" as PermissionState,
  };
  return h as unknown as Handle.File;
}

function isPersistableFileHandle(handle: Handle.File): boolean {
  return (
    typeof FileSystemFileHandle !== "undefined" &&
    handle instanceof FileSystemFileHandle
  );
}

/** Chromium can store file and directory handles in IndexedDB. */
function isPersistableFsHandle(
  handle: FileSystemHandle | Handle.File,
): boolean {
  if (typeof FileSystemHandle === "undefined") return false;
  if (handle instanceof FileSystemFileHandle) return true;
  return (
    typeof FileSystemDirectoryHandle !== "undefined" &&
    handle instanceof FileSystemDirectoryHandle
  );
}

/** Viewing only needs read (picker grants read; readwrite caused false denials). */
const readPermission = { mode: "read" } as const;

async function hasFileHandlePermission(handle: Handle.File): Promise<boolean> {
  try {
    return (await handle.queryPermission(readPermission)) === "granted";
  } catch {
    return false;
  }
}

/** Query, then request read if needed (requires a user gesture when prompting). */
async function ensureFileHandlePermission(
  handle: Handle.File,
): Promise<boolean> {
  if (await hasFileHandlePermission(handle)) return true;
  try {
    return (await handle.requestPermission(readPermission)) === "granted";
  } catch {
    return false;
  }
}

/** True if we can still read bytes from disk (real handle) or the chosen File (ephemeral). */
const findFile: FindFile = async (opts) => {
  const { handle } = opts;
  try {
    await handle.getFile();
    return true;
  } catch (e: unknown) {
    const name =
      e !== null && typeof e === "object" && "name" in e
        ? String((e as { name: unknown }).name)
        : "";
    if (name === "NotFoundError") {
      return false;
    }
    throw e;
  }
};

const toFile: ToFiles = async () => {
  try {
    const file = await fileOpen({
      description: "OME-TIFF images",
      mimeTypes: ["image/tiff"],
      extensions: [".tif", ".tiff", ".ome.tif", ".ome.tiff"],
      multiple: false,
    });
    if (file.handle) return [file.handle];
    return [ephemeralFileHandleFromFile(file)];
  } catch (e: unknown) {
    if (isAbortError(e)) {
      return [];
    }
    throw e;
  }
};

const toLoader: ToLoader = async ({ handle, pool = null }) => {
  const in_file = await handle.getFile();
  if (pool) {
    // @vivjs/loaders types geotiff@2.1.3 Pool; app uses geotiff@2.1.4-beta (different .d.ts).
    return asAppLoader(await loadOmeTiff(in_file, { pool: pool as never }));
  }
  return asAppLoader(await loadOmeTiff(in_file));
};

/**
 * Viv `loadOmeTiff` misreads mask files whose OME-XML lists extra `Image`
 * entries that are not real IFDs. Build a pyramid from IFD0 + SubIFDs instead;
 * OME Pixels is used for channel count / units only (names come later).
 */
async function maskLoaderFromBlob(inFile: Blob): Promise<Loader> {
  const tiff = await fromBlob(inFile);
  const baseImage = await tiff.getImage(0);
  const fd = baseImage.fileDirectory;
  const width = baseImage.getWidth();
  const height = baseImage.getHeight();
  if (!isTiffPyramided(baseImage) && !isTiffTiled(baseImage)) {
    const maxTextureSize = queryMaxTextureSize();
    if (width > maxTextureSize || height > maxTextureSize) {
      throw new Error(
        `This mask is not tiled or pyramided and is too large for the GPU (${width}×${height}; max texture ${maxTextureSize}). Export it as a tiled OME-TIFF pyramid and import again.`,
      );
    }
  }
  const pyramidImages = await resolveMaskPyramidImages(tiff, baseImage);
  const dtype = dtypeFromTiffDirectory(fd);
  const ome = parseFirstOmeImagePixels(fd.ImageDescription);
  const sizeC = Math.max(1, ome?.SizeC ?? fd.SamplesPerPixel ?? 1);
  const channels = Array.from({ length: sizeC }, (_, i) => ({
    ID: `Channel:0:${i}`,
    Name: sizeC === 1 ? "Mask" : `Mask ${i + 1}`,
    SamplesPerPixel: 1,
  }));
  const pixels: OmePixelMetadata = {
    ID: ome?.ID ?? "Pixels:0",
    DimensionOrder: "XYZCT",
    Type: ome?.Type ?? dtype,
    SizeT: 1,
    SizeC: sizeC,
    SizeZ: 1,
    SizeY: height,
    SizeX: width,
    PhysicalSizeX: ome?.PhysicalSizeX ?? 1,
    PhysicalSizeY: ome?.PhysicalSizeY ?? 1,
    PhysicalSizeXUnit: ome?.PhysicalSizeXUnit ?? "µm",
    PhysicalSizeYUnit: ome?.PhysicalSizeYUnit ?? "µm",
    PhysicalSizeZUnit: ome?.PhysicalSizeZUnit ?? "µm",
    BigEndian: ome?.BigEndian ?? false,
    TiffData: [],
    Channels: channels,
  };
  return {
    data: pyramidImages.map((image) =>
      maskPlaneFromImage(image, channels.length, dtype),
    ),
    metadata: {
      ID: "Image:0",
      AquisitionDate: "",
      Description: "",
      Pixels: pixels,
      ROIs: [],
    },
  } as Loader;
}

const toMaskLoader: ToMaskLoader = async ({ handle }) => {
  return maskLoaderFromBlob(await handle.getFile());
};

const toMaskLoaderFromUrl = async (url: string): Promise<Loader> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch mask OME-TIFF (${response.status})`);
  }
  return maskLoaderFromBlob(await response.blob());
};

export type OmeLoaderRole = "intensity" | "segmentation";

/**
 * Open the OME-TIFF file picker, then verify permission and that the file
 * still resolves. Returns null on cancel / denied / missing.
 */
export async function pickLocalOmeTiffHandle(): Promise<Handle.File | null> {
  const picked = await toFile();
  if (picked.length === 0) return null;
  const handle = picked[0];
  if (!(await ensureFileHandlePermission(handle))) return null;
  if (!(await findFile({ handle }))) return null;
  return handle;
}

/** Pick Viv vs minimal mask loader for local file or remote URL. */
export async function loadOmeLoaderForRole(
  role: OmeLoaderRole,
  source:
    | { kind: "local"; handle: Handle.File; in_f: string; pool?: PoolClass }
    | { kind: "url"; url: string; pool?: PoolClass },
): Promise<Loader> {
  const isMask = role === "segmentation";
  if (source.kind === "local") {
    return isMask
      ? toMaskLoader({
          handle: source.handle,
          in_f: source.in_f,
          pool: source.pool,
        })
      : toLoader({
          handle: source.handle,
          in_f: source.in_f,
          pool: source.pool,
        });
  }
  return isMask
    ? toMaskLoaderFromUrl(source.url)
    : toLoaderFromUrl(source.url, source.pool);
}

const toLoaderFromUrl = async (
  url: string,
  pool?: PoolClass,
): Promise<Loader> => {
  if (pool) {
    return asAppLoader(await loadOmeTiff(url, { pool: pool as never }));
  }
  return asAppLoader(await loadOmeTiff(url));
};

export {
  hasAuthorShellSupport,
  hasDirectoryPickerAccess,
  isPersistableFileHandle,
  isPersistableFsHandle,
  hasFileHandlePermission,
  ensureFileHandlePermission,
  findFile,
  toLoader,
  toFile,
};

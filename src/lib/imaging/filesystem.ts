import { loadOmeTiff } from "@hms-dbmi/viv";
import { fileOpen } from "browser-fs-access";
import { fromBlob } from "geotiff";
import type { HasTile, LoaderPlane } from "../authoring/config";
import type { Loader } from "./viv";
import type { PoolClass } from "./workers/Pool";

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
  const image = doc.querySelector("Image");
  const pixels = image?.querySelector("Pixels");
  if (!pixels) return null;
  const attrNum = (name: string) => {
    const value = pixels.getAttribute(name);
    return value == null ? undefined : Number(value);
  };
  const channels = Array.from(pixels.querySelectorAll("Channel"));
  return {
    ID: pixels.getAttribute("ID") ?? "Pixels:0",
    DimensionOrder: pixels.getAttribute("DimensionOrder") ?? "XYZCT",
    Type: pixels.getAttribute("Type") ?? "uint16",
    SizeT: attrNum("SizeT") ?? 1,
    SizeC: attrNum("SizeC") ?? Math.max(1, channels.length),
    SizeZ: attrNum("SizeZ") ?? 1,
    SizeY: attrNum("SizeY") ?? 0,
    SizeX: attrNum("SizeX") ?? 0,
    PhysicalSizeX: attrNum("PhysicalSizeX") ?? 1,
    PhysicalSizeY: attrNum("PhysicalSizeY") ?? 1,
    PhysicalSizeXUnit: pixels.getAttribute("PhysicalSizeXUnit") ?? "µm",
    PhysicalSizeYUnit: pixels.getAttribute("PhysicalSizeYUnit") ?? "µm",
    PhysicalSizeZUnit: pixels.getAttribute("PhysicalSizeZUnit") ?? "µm",
    BigEndian: false,
    TiffData: [],
    Channels:
      channels.length > 0
        ? channels.map((ch, i) => ({
            ID: ch.getAttribute("ID") ?? `Channel:0:${i}`,
            Name: ch.getAttribute("Name") ?? `Mask ${i + 1}`,
            SamplesPerPixel: Number(ch.getAttribute("SamplesPerPixel") ?? 1),
          }))
        : [],
  };
}

async function readTiffRaster(
  image: Awaited<ReturnType<Awaited<ReturnType<typeof fromBlob>>["getImage"]>>,
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
 * Mask files sometimes carry OME-XML copied from a multi-image source while the
 * TIFF payload itself contains only image 0. Viv interprets those extra OME
 * `Image` entries as pyramid levels and calls `getImage(1)`, which throws.
 * For mask overlays we only need the first raster, so build a minimal loader
 * directly from GeoTIFF image 0 and the first OME Pixels block.
 */
async function maskLoaderFromBlob(inFile: Blob): Promise<Loader> {
  const tiff = await fromBlob(inFile);
  const image = await tiff.getImage(0);
  const fd = image.fileDirectory;
  const width = image.getWidth();
  const height = image.getHeight();
  const samples = fd.SamplesPerPixel ?? 1;
  const dtype = dtypeFromTiffDirectory(fd);
  const omePixels = parseFirstOmeImagePixels(fd.ImageDescription);
  const sizeC = Math.max(1, omePixels?.SizeC ?? samples);
  // OME XML may have been copied from a multi-channel source whose channel
  // names ("Channel 0", ...) collide with intensity images. Names are
  // refined later by the import pipeline using the file basename; here we
  // just emit unambiguous generic mask labels.
  const channels = Array.from({ length: sizeC }, (_, i) => ({
    ID: omePixels?.Channels?.[i]?.ID ?? `Channel:0:${i}`,
    Name: sizeC === 1 ? "Mask" : `Mask ${i + 1}`,
    SamplesPerPixel: 1,
  }));
  const pixels: OmePixelMetadata = {
    ID: omePixels?.ID ?? "Pixels:0",
    DimensionOrder: "XYZCT",
    Type: omePixels?.Type ?? dtype,
    SizeT: 1,
    SizeC: channels.length,
    SizeZ: 1,
    SizeY: height,
    SizeX: width,
    PhysicalSizeX: omePixels?.PhysicalSizeX ?? 1,
    PhysicalSizeY: omePixels?.PhysicalSizeY ?? 1,
    PhysicalSizeXUnit: omePixels?.PhysicalSizeXUnit ?? "µm",
    PhysicalSizeYUnit: omePixels?.PhysicalSizeYUnit ?? "µm",
    PhysicalSizeZUnit: omePixels?.PhysicalSizeZUnit ?? "µm",
    BigEndian: omePixels?.BigEndian ?? false,
    TiffData: [],
    Channels: channels.map((ch, i) => ({
      ID: ch.ID ?? `Channel:0:${i}`,
      Name: ch.Name ?? (channels.length === 1 ? "Mask" : `Mask ${i + 1}`),
      SamplesPerPixel: ch.SamplesPerPixel ?? 1,
    })),
  };
  const plane: LoaderPlane = {
    dtype,
    shape: [1, channels.length, 1, height, width],
    tileSize: fd.TileWidth ?? fd.ImageWidth ?? width,
    labels: ["t", "c", "z", "y", "x"],
    onTileError: () => undefined,
    getRaster: ({ selection }) =>
      readTiffRaster(
        image,
        Math.max(0, Math.min(channels.length - 1, selection.c)),
      ),
    getTile: ({ selection }) =>
      readTiffRaster(
        image,
        Math.max(0, Math.min(channels.length - 1, selection.c)),
      ),
  };
  return {
    data: [plane],
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
  hasFileHandlePermission,
  ensureFileHandlePermission,
  findFile,
  toLoader,
  toMaskLoader,
  toMaskLoaderFromUrl,
  toLoaderFromUrl,
  toFile,
};

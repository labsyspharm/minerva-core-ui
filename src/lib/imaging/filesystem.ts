import { loadOmeTiff } from "@hms-dbmi/viv";
import { fileOpen } from "browser-fs-access";
import { fromBlob } from "geotiff";
import type { DecodePool } from "./omeDecodePool";
import type { Loader } from "./viv";

type GeoTiff = Awaited<ReturnType<typeof fromBlob>>;
type GeoTiffImage = Awaited<ReturnType<GeoTiff["getImage"]>>;

type FindFileIn = {
  handle: Handle.File;
};
type FindFile = (i: FindFileIn) => Promise<boolean>;
type ToFiles = () => Promise<Handle.File[]>;

/** Viv's published OME metadata types are looser than our app `Loader` shape. */
function asAppLoader(image: Awaited<ReturnType<typeof loadOmeTiff>>): Loader {
  return image as Loader;
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

/** Reject untiled, unpyramided masks larger than WebGL `MAX_TEXTURE_SIZE`. */
async function assertMaskFitsGpu(inFile: Blob): Promise<void> {
  const tiff = await fromBlob(inFile);
  const image = await tiff.getImage(0);
  if (isTiffPyramided(image) || isTiffTiled(image)) return;
  const width = image.getWidth();
  const height = image.getHeight();
  const maxTextureSize = queryMaxTextureSize();
  if (width > maxTextureSize || height > maxTextureSize) {
    throw new Error(
      `This mask is not tiled or pyramided and is too large for the GPU (${width}×${height}; max texture ${maxTextureSize}). Export it as a tiled OME-TIFF pyramid and import again.`,
    );
  }
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

/**
 * Prefer Chromium `getAsFileSystemHandle` for persistable drops; else ephemeral File.
 */
async function fileHandleFromDataTransferItem(
  item: DataTransferItem,
): Promise<Handle.File | null> {
  if (item.kind !== "file") return null;
  const withHandle = item as DataTransferItem & {
    getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
  };
  if (typeof withHandle.getAsFileSystemHandle === "function") {
    try {
      const handle = await withHandle.getAsFileSystemHandle();
      if (handle && handle.kind === "file") {
        return handle as Handle.File;
      }
    } catch {
      // fall through to File
    }
  }
  const file = item.getAsFile();
  if (!file) return null;
  return ephemeralFileHandleFromFile(file);
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

function vivLoadOpts(pool?: DecodePool | null, packedRgb?: "planar") {
  return {
    ...(pool ? { pool } : {}),
    ...(packedRgb ? { packedRgb } : {}),
  };
}

async function toMaskLoaderFromFile(
  inFile: Blob,
  pool?: DecodePool | null,
): Promise<Loader> {
  await assertMaskFitsGpu(inFile);
  const file =
    inFile instanceof File ? inFile : new File([inFile], "mask.ome.tif");
  return asAppLoader(await loadOmeTiff(file, vivLoadOpts(pool)));
}

type OmeLoaderRole = "intensity" | "segmentation";

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

export async function loadOmeLoaderForRole(
  role: OmeLoaderRole,
  source:
    | {
        kind: "local";
        handle: Handle.File;
        pool?: DecodePool;
        rgbDisplay?: boolean;
      }
    | { kind: "url"; url: string; pool?: DecodePool; rgbDisplay?: boolean },
): Promise<Loader> {
  const packedRgb = source.rgbDisplay === false ? "planar" : undefined;
  if (source.kind === "local") {
    const file = await source.handle.getFile();
    if (role === "segmentation") {
      return toMaskLoaderFromFile(file, source.pool);
    }
    return asAppLoader(
      await loadOmeTiff(file, vivLoadOpts(source.pool, packedRgb)),
    );
  }
  if (role === "segmentation") {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch mask OME-TIFF (${response.status})`);
    }
    return toMaskLoaderFromFile(await response.blob(), source.pool);
  }
  return asAppLoader(
    await loadOmeTiff(source.url, vivLoadOpts(source.pool, packedRgb)),
  );
}

export {
  hasAuthorShellSupport,
  hasDirectoryPickerAccess,
  isPersistableFileHandle,
  isPersistableFsHandle,
  hasFileHandlePermission,
  ensureFileHandlePermission,
  findFile,
  toFile,
  ephemeralFileHandleFromFile,
  fileHandleFromDataTransferItem,
};

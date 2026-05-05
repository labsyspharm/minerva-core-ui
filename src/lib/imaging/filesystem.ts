import { loadOmeTiff } from "@hms-dbmi/viv";
import { fileOpen } from "browser-fs-access";
import type { HasTile } from "../authoring/config";
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
export interface LoaderPlane {
  dtype: Dtype;
  tileSize: number;
  getTile: (s: TileConfig) => Promise<HasTile>;
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

const findFile: FindFile = async (opts) => {
  const { handle } = opts;
  try {
    handle.createWritable();
  } catch (e: unknown) {
    const name =
      e !== null && typeof e === "object" && "name" in e
        ? String((e as { name: unknown }).name)
        : "";
    if (name === "NotFoundError") {
      return false;
    }
  }
  return true;
};

const toFile: ToFiles = async () => {
  try {
    const file = await fileOpen({
      description: "OME-TIFF images",
      mimeTypes: ["image/tiff"],
      extensions: [".tif", ".tiff", ".ome.tif", ".ome.tiff"],
      multiple: false,
    });
    if (file.handle) {
      return [file.handle];
    }
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
    return await loadOmeTiff(in_file, { pool });
  }
  return await loadOmeTiff(in_file);
};

const toLoaderFromUrl = async (
  url: string,
  pool?: PoolClass,
): Promise<Loader> => {
  if (pool) {
    return await loadOmeTiff(url, { pool });
  }
  return await loadOmeTiff(url);
};

export {
  hasAuthorShellSupport,
  hasDirectoryPickerAccess,
  isPersistableFileHandle,
  findFile,
  toLoader,
  toLoaderFromUrl,
  toFile,
};

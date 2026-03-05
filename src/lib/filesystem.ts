import { loadOmeTiff } from "@hms-dbmi/viv";
import type { HasTile } from "./config";
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

const hasFileSystemAccess = () => {
  return "showDirectoryPicker" in window;
};

const toFile: ToFiles = async () => {
  const opts = { multiple: false };
  if (hasFileSystemAccess) {
    return await window.showOpenFilePicker(opts);
  }
  return [];
};

const findFile: FindFile = async (opts) => {
  const { handle } = opts;
  try {
    handle.createWritable();
  } catch (e) {
    if (e.name === "NotFoundError") {
      return false;
    }
  }
  return true;
};

const toLoader: ToLoader = async ({ handle, pool = null }) => {
  const in_file = await handle.getFile();
  if (pool) {
    return await loadOmeTiff(in_file, { pool });
  }
  return await loadOmeTiff(in_file);
};

export { hasFileSystemAccess, toLoader, findFile, toFile };

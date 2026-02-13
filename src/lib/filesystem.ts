import { loadOmeTiff } from "@hms-dbmi/viv";

import type { Loader } from "./viv";
import type { PoolClass } from "./workers/Pool";

type ListDirIn = {
  handle: Handle.Dir;
};
export type Entry = [string, Handle.File | Handle.Dir];
type ListDir = (i: ListDirIn) => Promise<Entry[]>
type FindFileIn = {
  handle: Handle.Dir;
  path: string;
};
type FindFile = (i: FindFileIn) => Promise<boolean>
type ToDir = () => Promise<Handle.Dir>
type LoaderIn = {
  in_f: string;
  handle: Handle.Dir;
  pool?: PoolClass;
};
type ToLoader = (i: LoaderIn) => Promise<Loader>
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
type HasTile = HasShape & {
  data: ArrayBuffer;
};
export type HasShape = {
  height: number;
  width: number;
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

const toDir: ToDir = async () => {
  const dir_opts = { mode: "readwrite" } as DirectoryPickerOptions;
  if (hasFileSystemAccess) {
    return await window.showDirectoryPicker(dir_opts);
  }
  return null;
};

const listDir: ListDir = async (opts) => {
  const { handle } = opts;
  const paths = handle.entries();
  const output: Entry[] = [];
  for await (const e of paths) {
    output.push(e);
  }
  return output;
};

const findFile: FindFile = async (opts) => {
  const { path, handle } = opts;
  const paths = handle.keys();
  for await (const f of paths) {
    if (f === path) return true;
  }
  return false;
};

const toLoader: ToLoader = async ({ in_f, handle, pool = null }) => {
  const in_fh = await handle.getFileHandle(in_f);
  const in_file = await in_fh.getFile();
  if (pool) {
    return await loadOmeTiff(in_file, { pool });
  }
  return await loadOmeTiff(in_file);
};

export { hasFileSystemAccess, toLoader, findFile, listDir, toDir };

import {
  loadOmeTiff,
} from "@hms-dbmi/viv";

import type { Loader } from './viv';

type ListDirIn = {
  handle: Handle.Dir,
}
export type Entry = [
  string, Handle.File | Handle.Dir
]
interface ListDir {
  (i: ListDirIn): Promise<Entry[]>;
}
type FindFileIn = {
  handle: Handle.Dir,
  path: string
}
interface FindFile {
  (i: FindFileIn): Promise<boolean>;
}
interface ToDir {
  (): Promise<Handle.Dir>;
}
type LoaderIn = {
  in_f: string,
  all?: boolean,
  handle: Handle.Dir
}
interface ToLoader {
  (i: LoaderIn): Promise<Loader>;
}
export type Selection = {
  t: number,
  z: number,
  c: number
}
type TileConfig = {
  x: number,
  y: number,
  signal: AbortSignal,
  selection: Selection
}
type HasTile = HasShape & {
  data: ArrayBuffer
}
export type HasShape = {
  height: number,
  width: number
}
export type Dtype = (
  "Uint8" | "Uint16" | "Uint32" |
  "Int8" | "Int16" | "Int32" | 
  "Float32" | "Float64"
)
export interface LoaderPlane {
  dtype: Dtype,
  tileSize: number,
  getTile: (s: TileConfig) => Promise<HasTile>
}

const hasFileSystemAccess = () => {
  return "showDirectoryPicker" in (window as any);
}

const toDir: ToDir = async () => {
  const dir_opts = { mode: "readwrite" };
  return await (window as any).showDirectoryPicker(dir_opts);
}

const listDir: ListDir = async (opts) => {
  const { handle } = opts;
  const ok = await handle.queryPermission();
  const entries = handle.entries();
  return await Array.fromAsync(entries);
}

const findFile: FindFile = async (opts) => {
  const { path, handle } = opts;
  const paths = handle.keys();
  for await (const f of paths) {
    if (f === path) return true;
  }
  return false
}

const toLoader: ToLoader = async ({in_f, handle, all}) => {
  const in_fh = await handle.getFileHandle(in_f);
  const in_file = await in_fh.getFile();
  return await loadOmeTiff(
    in_file, {
      images: all ? "all" : "first"
    }
  );
}

export {
  hasFileSystemAccess,
  toLoader,
  findFile,
  listDir,
  toDir 
}

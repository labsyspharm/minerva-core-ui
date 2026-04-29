import { del as kvDel, get as kvGet } from "idb-keyval";
import { storyDb } from "./db";

/**
 * Persist a {@link FileSystemFileHandle} in Dexie `handles` (same IDB database as `stories`).
 * Document JSON stores only `handleKey` (see `ImageSourceLocalSchema`).
 */
export async function putFileHandle(
  id: string,
  handle: Handle.File,
): Promise<void> {
  await storyDb.handles.put({ id, handle });
}

/**
 * Load a handle by key. Migrates from legacy idb-keyval `keyval-store` on first read when present.
 */
export async function getFileHandle(
  id: string,
): Promise<Handle.File | undefined> {
  const row = await storyDb.handles.get(id);
  if (row) return row.handle;

  const legacy = (await kvGet(id)) as Handle.File | undefined;
  if (!legacy) return undefined;

  await putFileHandle(id, legacy);
  try {
    await kvDel(id);
  } catch {
    /* ignore */
  }
  return legacy;
}

export async function deleteFileHandle(id: string): Promise<void> {
  await storyDb.handles.delete(id);
}

/** Remove all handles whose keys belong to a story (`story:<id>:…`). */
export async function deleteFileHandlesForStory(
  storyId: string,
): Promise<void> {
  const prefix = `story:${storyId}:`;
  await storyDb.handles.where("id").startsWith(prefix).delete();
}

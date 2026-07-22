import { del as kvDel, get as kvGet } from "idb-keyval";
import { isPersistableFileHandle } from "@/lib/imaging/filesystem";
import { storyDb } from "./db";

/**
 * Same-tab handles for browsers that cannot store {@link FileSystemFileHandle}
 * in IndexedDB (Firefox ephemeral `File` wrappers). Cleared on full page reload.
 */
const sessionHandles = new Map<string, Handle.File>();

/**
 * Persist a {@link FileSystemFileHandle} in Dexie `handles` (same IDB database as `stories`).
 * Document JSON stores only `handleKey` (see `ImageSourceLocalSchema`).
 * Non-persistable (ephemeral) handles stay in the session map only.
 */
export async function putFileHandle(
  id: string,
  handle: Handle.File,
): Promise<void> {
  sessionHandles.set(id, handle);
  if (!isPersistableFileHandle(handle)) return;
  await storyDb.handles.put({ id, handle });
}

/**
 * Load a handle by key. Migrates from legacy idb-keyval `keyval-store` on first read when present.
 */
export async function getFileHandle(
  id: string,
): Promise<Handle.File | undefined> {
  const session = sessionHandles.get(id);
  if (session) return session;

  const row = await storyDb.handles.get(id);
  if (row) {
    sessionHandles.set(id, row.handle);
    return row.handle;
  }

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
  sessionHandles.delete(id);
  await storyDb.handles.delete(id);
}

/** Remove all handles whose keys belong to a story (`story:<id>:…`). */
export async function deleteFileHandlesForStory(
  storyId: string,
): Promise<void> {
  const prefix = `story:${storyId}:`;
  for (const id of sessionHandles.keys()) {
    if (id.startsWith(prefix)) sessionHandles.delete(id);
  }
  await storyDb.handles.where("id").startsWith(prefix).delete();
}

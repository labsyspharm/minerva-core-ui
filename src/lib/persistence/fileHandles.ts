import { del as kvDel, get as kvGet } from "idb-keyval";
import {
  isPersistableFileHandle,
  isPersistableFsHandle,
} from "@/lib/imaging/filesystem";
import { storyDb } from "./db";

/**
 * Same-tab handles for browsers that cannot store {@link FileSystemFileHandle}
 * in IndexedDB (Firefox ephemeral `File` wrappers). Cleared on full page reload.
 */
const sessionHandles = new Map<string, FileSystemHandle>();

/**
 * Persist a {@link FileSystemFileHandle} in Dexie `handles` (same IDB database as `stories`).
 * Document JSON stores only `handleKey` (see `ImageSourceLocalSchema`).
 * Non-persistable (ephemeral) handles stay in the session map only.
 */
export async function putFileHandle(
  id: string,
  handle: FileSystemHandle | Handle.File,
): Promise<void> {
  sessionHandles.set(id, handle);
  if (!isPersistableFsHandle(handle)) return;
  await storyDb.handles.put({ id, handle });
}

/**
 * Load a handle by key. Migrates from legacy idb-keyval `keyval-store` on first read when present.
 */
export async function getFileHandle(
  id: string,
): Promise<FileSystemHandle | undefined> {
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

/** Typed helper when the caller expects a file handle (OME local sources). */
export async function getPersistedFileHandle(
  id: string,
): Promise<Handle.File | undefined> {
  const handle = await getFileHandle(id);
  if (!handle) return undefined;
  if (isPersistableFileHandle(handle as Handle.File)) {
    return handle as Handle.File;
  }
  if (handle.kind === "file") return handle as FileSystemFileHandle;
  return undefined;
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

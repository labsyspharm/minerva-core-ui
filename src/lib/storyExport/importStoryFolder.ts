import { hasDirectoryPickerAccess } from "@/lib/imaging/filesystem";
import type { JpegTileFetcher } from "@/lib/imaging/jpegImage";
import {
  folderByChannelIndexFromGroup,
  jpegPyramidFolderName,
} from "@/lib/imaging/jpegPyramid";
import { getFileHandle, putFileHandle } from "@/lib/persistence/fileHandles";
import {
  createStoryRecord,
  saveStoryDocument,
  setActiveStoryId,
} from "@/lib/persistence/storyPersistence";
import type { DocumentData } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { validateDocumentData } from "@/lib/stores/validateDocument";
import { withPortableJpegSources } from "./storyBundle";

const STORY_ROOT_HANDLE_SUFFIX = ":storyRoot";

function storyRootHandleKey(storyId: string): string {
  return `story:${storyId}${STORY_ROOT_HANDLE_SUFFIX}`;
}

const rootHandles = new Map<string, FileSystemDirectoryHandle>();

function isDirectoryHandle(
  handle: FileSystemHandle | undefined,
): handle is FileSystemDirectoryHandle {
  return !!handle && handle.kind === "directory";
}

/** Remember + persist the story export/import root directory. */
export async function setStoryRootHandle(
  storyId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  rootHandles.set(storyId, handle);
  await putFileHandle(storyRootHandleKey(storyId), handle);
}

export type GetStoryRootHandleOptions = {
  requestPermission?: boolean;
  mode?: "read" | "readwrite";
};

async function ensureDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  opts: GetStoryRootHandleOptions,
): Promise<boolean> {
  const mode = { mode: opts.mode ?? "read" } as const;
  try {
    if ((await handle.queryPermission(mode)) === "granted") return true;
    return opts.requestPermission
      ? (await handle.requestPermission(mode)) === "granted"
      : false;
  } catch {
    return false;
  }
}

export async function getStoryRootHandle(
  storyId: string | null | undefined,
  opts: GetStoryRootHandleOptions = {},
): Promise<FileSystemDirectoryHandle | undefined> {
  if (!storyId) return undefined;
  let root = rootHandles.get(storyId);
  if (!root) {
    const stored = await getFileHandle(storyRootHandleKey(storyId));
    if (isDirectoryHandle(stored)) {
      root = stored;
      rootHandles.set(storyId, root);
    }
  }
  if (!root || !(await ensureDirectoryPermission(root, opts))) return undefined;
  return root;
}

export function tileFetcherForDirectory(
  root: FileSystemDirectoryHandle,
): JpegTileFetcher {
  return async (folder, filename) => {
    const dir = await root.getDirectoryHandle(folder);
    const file = await dir.getFileHandle(filename);
    return file.getFile();
  };
}

/** Resolve a tile fetcher for an imported story's directory handle (memory or Dexie). */
export async function tileFetcherForStory(
  storyId: string | null | undefined,
  opts: GetStoryRootHandleOptions = {},
): Promise<JpegTileFetcher | undefined> {
  const root = await getStoryRootHandle(storyId, opts);
  return root ? tileFetcherForDirectory(root) : undefined;
}

/**
 * Folder names jpeg-pyramid export would write. Prefer channel groups; if none
 * contribute folders, fall back to image-level channels (same as import checks).
 */
export async function neededJpegPyramidFolderNames(
  channelGroups: ReadonlyArray<DocumentData["channelGroups"][number]>,
  images?: DocumentData["images"],
): Promise<Set<string>> {
  const names = new Set<string>();
  await Promise.all(
    channelGroups.flatMap((g) =>
      g.channels.map(async (ch) =>
        names.add(
          await jpegPyramidFolderName(
            ch.channelId,
            ch.lowerLimit,
            ch.upperLimit,
          ),
        ),
      ),
    ),
  );
  if (names.size === 0 && images) {
    for (const im of images) {
      if (im.source?.kind !== "jpeg" && im.source?.kind !== "local") continue;
      const channelIndexById = Object.fromEntries(
        im.channels.map((ch) => [ch.id, ch.index]),
      );
      const folders = await folderByChannelIndexFromGroup({
        channels: im.channels.map((ch) => ({
          channelId: ch.id,
          lowerLimit: ch.lowerLimit ?? 2 ** 5,
          upperLimit: ch.upperLimit ?? 2 ** 14,
        })),
        channelIndexById,
      });
      for (const name of Object.values(folders)) names.add(name);
    }
  }
  return names;
}

export async function listExistingPyramidFolders(
  root: FileSystemDirectoryHandle,
): Promise<Set<string>> {
  const names = new Set<string>();
  for await (const [name, handle] of root.entries()) {
    if (handle.kind === "directory" && /^[0-9a-f]{64}$/i.test(name)) {
      names.add(name.toLowerCase());
    }
  }
  return names;
}

async function assertPyramidFoldersExist(
  root: FileSystemDirectoryHandle,
  data: DocumentData,
): Promise<void> {
  if (data.metadata.imageSource === "remote-url") return;
  const needed = await neededJpegPyramidFolderNames(
    data.channelGroups,
    data.images,
  );
  if (needed.size === 0) return;
  const existing = await listExistingPyramidFolders(root);
  const missing = [...needed].filter((name) => !existing.has(name));
  if (missing.length > 0) {
    throw new Error(
      "Missing JPEG pyramid folders. Pick the folder created by Export (document.json plus channel directories).",
    );
  }
}

async function readDocumentJson(
  root: FileSystemDirectoryHandle,
): Promise<DocumentData> {
  const fh = await root.getFileHandle("document.json");
  const file = await fh.getFile();
  return validateDocumentData(JSON.parse(await file.text()) as unknown);
}

/**
 * Pick a story export folder, import `document.json` into Dexie, and open it.
 * Returns the new story id.
 */
export async function importStoryFolderFromPicker(): Promise<string> {
  if (!hasDirectoryPickerAccess()) {
    throw new Error(
      "Importing a story folder needs the File System Access API (Chrome or Edge).",
    );
  }
  const root = await window.showDirectoryPicker({
    id: "minerva-story-import",
    mode: "read",
  });
  const data = await readDocumentJson(root);
  await assertPyramidFoldersExist(root, data);
  const title = data.metadata.title?.trim() || root.name || "Imported Story";
  const rec = await createStoryRecord(title);
  // Remote-URL exports keep existing `kind: "url"` sources; JPEG-pyramid
  // bundles rewrite intensity roots to `{ kind: "jpeg", url: "." }`.
  const images =
    data.metadata.imageSource === "remote-url"
      ? data.images
      : withPortableJpegSources(data.images);
  const next = validateDocumentData({
    ...data,
    metadata: {
      ...data.metadata,
      id: rec.id,
      title: data.metadata.title ?? title,
    },
    images,
  });
  await saveStoryDocument(rec.id, next);
  await setStoryRootHandle(rec.id, root);
  useDocumentStore.getState().hydrateFromDocument(next, rec.id);
  await setActiveStoryId(rec.id);
  return rec.id;
}

export async function reconnectStoryRootFromPicker(
  storyId: string,
): Promise<FileSystemDirectoryHandle> {
  if (!hasDirectoryPickerAccess()) {
    throw new Error(
      "Reconnecting a story folder needs the File System Access API (Chrome or Edge).",
    );
  }
  const root = await window.showDirectoryPicker({
    id: "minerva-story-import",
    mode: "read",
  });
  await assertPyramidFoldersExist(
    root,
    useDocumentStore.getState().toDocumentData(),
  );
  await setStoryRootHandle(storyId, root);
  return root;
}

export function storyNeedsLocalJpegRoot(
  images: DocumentData["images"],
): boolean {
  return images.some(
    (im) =>
      im.source?.kind === "jpeg" &&
      (im.source.url === "." ||
        im.source.url === "./" ||
        im.source.url === "" ||
        !/^https?:\/\//i.test(im.source.url)),
  );
}

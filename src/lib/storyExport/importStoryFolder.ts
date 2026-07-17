import { hasDirectoryPickerAccess } from "@/lib/imaging/filesystem";
import type { JpegTileFetcher } from "@/lib/jpeg-image";
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

function rememberStoryRootHandle(
  storyId: string,
  handle: FileSystemDirectoryHandle,
): void {
  rootHandles.set(storyId, handle);
}

function tileFetcherForDirectory(
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
): Promise<JpegTileFetcher | undefined> {
  if (!storyId) return undefined;
  let root = rootHandles.get(storyId);
  if (!root) {
    const stored = await getFileHandle(storyRootHandleKey(storyId));
    if (stored && "getDirectoryHandle" in stored) {
      root = stored as unknown as FileSystemDirectoryHandle;
      rootHandles.set(storyId, root);
    }
  }
  return root ? tileFetcherForDirectory(root) : undefined;
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
  const title = data.metadata.title?.trim() || root.name || "Imported Story";
  const rec = await createStoryRecord(title);
  // Remote-URL exports keep OME/DICOM sources; only JPEG-pyramid bundles
  // need portable `{ kind: "jpeg", url: "." }` roots.
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
  rememberStoryRootHandle(rec.id, root);
  try {
    await putFileHandle(
      storyRootHandleKey(rec.id),
      root as unknown as Handle.File,
    );
  } catch (e) {
    console.warn("[minerva] could not persist story root directory handle", e);
  }
  useDocumentStore.getState().hydrateFromDocument(next, rec.id);
  await setActiveStoryId(rec.id);
  return rec.id;
}

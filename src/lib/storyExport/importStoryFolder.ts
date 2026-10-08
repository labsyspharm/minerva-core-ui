import { fileOpen } from "browser-fs-access";
import {
  folderLimitsForTransfer,
  isJpegOmeTiffImageSource,
  type JpegExportTransfer,
  jpegTransferFromImageSource,
} from "@/lib/imaging/cubeRootEncoding";
import { hasDirectoryPickerAccess } from "@/lib/imaging/filesystem";
import type { JpegTileFetcher } from "@/lib/imaging/jpegImage";
import {
  folderByChannelIndexFromGroup,
  JPEG_BAKED_CONTRAST_LIMIT,
  jpegPyramidFolderName,
} from "@/lib/imaging/jpegPyramid";
import {
  isRelativeOmeTiffUrl,
  jpegSourceNeedsLocalRoot,
} from "@/lib/imaging/loadJpegFromDocument";
import { putBlob } from "@/lib/persistence/db";
import { getFileHandle, putFileHandle } from "@/lib/persistence/fileHandles";
import { imageHandleStorageKey } from "@/lib/persistence/imageHandles";
import {
  createStoryRecord,
  saveStoryDocument,
  setActiveStoryId,
} from "@/lib/persistence/storyPersistence";
import type { DocumentData } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { validateDocumentData } from "@/lib/stores/validateDocument";
import { withPortableJpegSources } from "./storyBundle";

export { jpegSourceNeedsLocalRoot };

const STORY_ROOT_HANDLE_SUFFIX = ":storyRoot";

function storyRootHandleKey(storyId: string): string {
  return `story:${storyId}${STORY_ROOT_HANDLE_SUFFIX}`;
}

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
  const stored = await getFileHandle(storyRootHandleKey(storyId));
  if (!isDirectoryHandle(stored)) return undefined;
  if (!(await ensureDirectoryPermission(stored, opts))) return undefined;
  return stored;
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

/**
 * Folder names jpeg-pyramid export would write. Prefer channel groups; if none
 * contribute folders, fall back to image-level channels (same as import checks).
 */
export async function neededJpegPyramidFolderNames(
  channelGroups: ReadonlyArray<DocumentData["channelGroups"][number]>,
  images?: DocumentData["images"],
  transfer: JpegExportTransfer = "contrast",
): Promise<Set<string>> {
  const names = new Set<string>();
  await Promise.all(
    channelGroups.flatMap((g) =>
      g.channels.map(async (ch) => {
        const { lowerLimit, upperLimit } = folderLimitsForTransfer(
          transfer,
          ch.lowerLimit,
          ch.upperLimit,
        );
        names.add(
          await jpegPyramidFolderName(ch.channelId, lowerLimit, upperLimit),
        );
      }),
    ),
  );
  if (names.size === 0 && images) {
    for (const im of images) {
      if (im.source?.kind !== "jpeg" && im.source?.kind !== "local") continue;
      const channelIndexById = Object.fromEntries(
        im.channels.map((ch) => [ch.id, ch.index]),
      );
      const folders = await folderByChannelIndexFromGroup({
        channels: im.channels.map((ch) => {
          const { lowerLimit, upperLimit } = folderLimitsForTransfer(
            transfer,
            ch.lowerLimit ?? JPEG_BAKED_CONTRAST_LIMIT[0],
            ch.upperLimit ?? JPEG_BAKED_CONTRAST_LIMIT[1],
          );
          return { channelId: ch.id, lowerLimit, upperLimit };
        }),
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
  try {
    for await (const [name, handle] of root.entries()) {
      if (handle.kind === "directory" && /^[0-9a-f]{64}$/i.test(name)) {
        names.add(name.toLowerCase());
      }
    }
  } catch (e) {
    // Stale / moved story-root handles throw NotFoundError from the FS Access API.
    if (e instanceof DOMException && e.name === "NotFoundError") {
      return names;
    }
    throw e;
  }
  return names;
}

/** False when the persisted directory handle no longer points at a real folder. */
export async function isStoryRootHandleUsable(
  root: FileSystemDirectoryHandle,
): Promise<boolean> {
  try {
    // `entries()` touches the directory; permission alone can succeed on a dead handle.
    await root.entries().next();
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "NotFoundError") return false;
    throw e;
  }
}

async function assertPyramidFoldersExist(
  root: FileSystemDirectoryHandle,
  data: DocumentData,
): Promise<void> {
  if (data.metadata.imageSource === "remote-url") return;
  if (isJpegOmeTiffImageSource(data.metadata.imageSource)) return;
  const needed = await neededJpegPyramidFolderNames(
    data.channelGroups,
    data.images,
    jpegTransferFromImageSource(data.metadata.imageSource),
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
  let fh: FileSystemFileHandle;
  try {
    fh = await root.getFileHandle("document.json");
  } catch (e) {
    if (e instanceof DOMException && e.name === "NotFoundError") {
      throw new Error("Pick the export folder that contains document.json.");
    }
    throw e;
  }
  const file = await fh.getFile();
  return validateDocumentData(JSON.parse(await file.text()) as unknown);
}

/** File beside `document.json`. Missing files stay unbound so the story can still open. */
async function fileInDirectory(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<FileSystemFileHandle | undefined> {
  const parts = relativePath
    .trim()
    .split(/[/\\]/)
    .filter((part) => part && part !== ".");
  const name = parts.pop();
  if (!name || parts.includes("..")) return undefined;
  let dir = root;
  try {
    for (const part of parts) dir = await dir.getDirectoryHandle(part);
    return await dir.getFileHandle(name);
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === "NotFoundError" || e.name === "TypeMismatchError")
    ) {
      return undefined;
    }
    throw e;
  }
}

function isRemoteOrBlobUrl(url: string): boolean {
  const u = url.trim();
  return /^https?:\/\//i.test(u) || u.startsWith("blob:");
}

async function persistImportedStory(
  data: DocumentData,
  titleFallback: string,
  root?: FileSystemDirectoryHandle,
): Promise<string> {
  const title =
    data.metadata.title?.trim() || titleFallback || "Imported Story";
  const hasLocalSources = data.images.some((im) => im.source?.kind === "local");
  const omeTiffBundle = isJpegOmeTiffImageSource(data.metadata.imageSource);
  // Remote-URL exports keep `kind: "url"`. JPEG-pyramid bundles rewrite to
  // `{ kind: "jpeg", url: "." }`. JPEG OME-TIFF bundles use relative `.ome.tif`
  // URLs (bound to local handles below when `root` is set).
  const imagesBase =
    data.metadata.imageSource === "remote-url" ||
    hasLocalSources ||
    omeTiffBundle
      ? data.images
      : withPortableJpegSources(data.images);
  const rec = await createStoryRecord(title);
  let images = hasLocalSources
    ? imagesBase.map((im) => {
        if (im.source?.kind !== "local") return im;
        return {
          ...im,
          source: {
            kind: "local" as const,
            handleKey: imageHandleStorageKey(rec.id, im.id),
          },
        };
      })
    : imagesBase;

  let featureTables = data.featureTables;
  if (root) {
    const nextImages: typeof images = [];
    for (const im of images) {
      if (im.source?.kind === "url" && isRelativeOmeTiffUrl(im.source.url)) {
        const fh = await fileInDirectory(root, im.source.url);
        if (fh) {
          const handleKey = imageHandleStorageKey(rec.id, im.id);
          await putFileHandle(handleKey, fh);
          nextImages.push({
            ...im,
            source: { kind: "local", handleKey },
          });
          continue;
        }
      }
      nextImages.push(im);
    }
    images = nextImages;

    const nextTables: typeof featureTables = [];
    for (const table of featureTables) {
      if (table.source.kind === "url" && !isRemoteOrBlobUrl(table.source.url)) {
        const fh = await fileInDirectory(root, table.source.url);
        if (fh) {
          const handleKey = `story:${rec.id}:featureTable:${table.id}`;
          const file = await fh.getFile();
          await putBlob(handleKey, new Uint8Array(await file.arrayBuffer()));
          nextTables.push({
            ...table,
            source: { kind: "local", handleKey },
          });
          continue;
        }
      }
      nextTables.push(table);
    }
    featureTables = nextTables;
  }

  const next = validateDocumentData({
    ...data,
    metadata: {
      ...data.metadata,
      id: rec.id,
      title,
    },
    images,
    featureTables,
  });
  await saveStoryDocument(rec.id, next);
  if (root) await setStoryRootHandle(rec.id, root);
  useDocumentStore.getState().hydrateFromDocument(next, rec.id);
  await setActiveStoryId(rec.id);
  return rec.id;
}

/** Pick a story JSON and open it. Image files are located from the story, one at a time. */
export async function importStoryJsonFromPicker(): Promise<string> {
  const file = await fileOpen({
    description: "Minerva story JSON",
    mimeTypes: ["application/json"],
    extensions: [".json"],
    multiple: false,
  });
  const data = validateDocumentData(JSON.parse(await file.text()) as unknown);
  const base = file.name.replace(/\.json$/i, "").trim();
  const fallback = /^(document|story)$/i.test(base) ? "Imported Story" : base;
  return persistImportedStory(data, fallback);
}

/**
 * Pick a story export folder and open it. Image files and feature-table
 * sidecars found in the folder are attached; JPEG pyramids use the folder itself.
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
  return persistImportedStory(data, root.name, root);
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

/** Relative / empty jpeg `source.url` needs a persisted story directory handle. */
export function storyNeedsLocalJpegRoot(
  images: DocumentData["images"],
): boolean {
  return images.some(
    (im) =>
      im.source?.kind === "jpeg" && jpegSourceNeedsLocalRoot(im.source.url),
  );
}

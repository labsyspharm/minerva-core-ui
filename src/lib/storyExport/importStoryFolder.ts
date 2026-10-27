import { fileOpen } from "browser-fs-access";
import { featureTableBlobKey } from "@/lib/featureTable";
import {
  folderLimitsForTransfer,
  isJpegOmeTiffImageSource,
  type JpegExportTransfer,
  jpegTransferFromImageSource,
} from "@/lib/imaging/cubeRootEncoding";
import {
  fileInDirectory,
  hasDirectoryPickerAccess,
} from "@/lib/imaging/filesystem";
import { importFilePickerOptions } from "@/lib/imaging/importFileKind";
import type { JpegTileFetcher } from "@/lib/imaging/jpegImage";
import { jpegPyramidFolderName } from "@/lib/imaging/jpegPyramid";
import {
  isRelativeOmeTiffUrl,
  jpegSourceNeedsLocalRoot,
} from "@/lib/imaging/loadJpegFromDocument";
import { jpegPyramidExportChannels } from "@/lib/imaging/omeTiffExport";
import { isAbsoluteUrl } from "@/lib/imaging/sourceUrl";
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
import { fetchStoryDocument } from "@/lib/story/loadStoryDocument";
import { withPortableJpegSources } from "./storyBundle";

export { jpegSourceNeedsLocalRoot };

const STORY_ROOT_HANDLE_SUFFIX = ":storyRoot";

export function storyRootHandleKey(storyId: string): string {
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

/** A remembered story folder that needs permission again (as after a reload). */
export async function storyRootNeedsPermission(
  storyId: string | null | undefined,
): Promise<boolean> {
  if (!storyId) return false;
  const stored = await getFileHandle(storyRootHandleKey(storyId));
  if (!isDirectoryHandle(stored)) return false;
  return !(await ensureDirectoryPermission(stored, {}));
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
 * Folder names jpeg-pyramid export would write. With images, this matches
 * `jpegPyramidExportChannels` (per-image transfer, including ungrouped RGB).
 */
export async function neededJpegPyramidFolderNames(
  channelGroups: ReadonlyArray<DocumentData["channelGroups"][number]>,
  images?: DocumentData["images"],
  transfer: JpegExportTransfer = "contrast",
): Promise<Set<string>> {
  const names = new Set<string>();
  if (images && images.length > 0) {
    const exported = jpegPyramidExportChannels(
      images,
      [...channelGroups],
      transfer,
    );
    await Promise.all(
      exported.map(async (ch) => {
        names.add(
          await jpegPyramidFolderName(
            ch.channelId,
            ch.lowerLimit,
            ch.upperLimit,
          ),
        );
      }),
    );
    return names;
  }
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
  const raw = JSON.parse(await file.text()) as unknown;
  if (!looksLikeStoryJson(raw)) {
    throw new Error("document.json is not a Minerva story.");
  }
  return validateDocumentData(raw);
}

/**
 * Image sources as an imported story reads them. Remote-URL exports keep
 * `kind: "url"`. JPEG-pyramid bundles rewrite to `{ kind: "jpeg", url: "." }`.
 * JPEG OME-TIFF bundles use relative `.ome.tif` URLs (bound to local handles
 * when the story folder is known).
 */
function portableImportImages(data: DocumentData): DocumentData["images"] {
  const keep =
    data.metadata.imageSource === "remote-url" ||
    data.images.some((im) => im.source?.kind === "local") ||
    isJpegOmeTiffImageSource(data.metadata.imageSource);
  return keep ? data.images : withPortableJpegSources(data.images);
}

async function persistImportedStory(
  data: DocumentData,
  titleFallback: string,
  root?: FileSystemDirectoryHandle,
): Promise<string> {
  const title =
    data.metadata.title?.trim() || titleFallback || "Imported Story";
  const hasLocalSources = data.images.some((im) => im.source?.kind === "local");
  const imagesBase = portableImportImages(data);
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
      if (table.source.kind === "url" && !isAbsoluteUrl(table.source.url)) {
        const fh = await fileInDirectory(root, table.source.url);
        if (fh) {
          const handleKey = featureTableBlobKey(rec.id, table.id);
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
    ...importFilePickerOptions(["story"]),
    multiple: false,
  });
  return importStoryJsonFile(file);
}

/** Story arrays `validateDocumentData` reads; it defaults every missing one. */
const STORY_JSON_KEYS = [
  "waypoints",
  "shapes",
  "images",
  "channelGroups",
  "groups",
  "channels",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * A Minerva story has `version` 1 or 2, a `metadata` object, or at least one
 * story array that contains an object. An empty array is not enough.
 */
function looksLikeStoryJson(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  if (raw.version === "1" || raw.version === "2") return true;
  if (isPlainObject(raw.metadata)) return true;
  return STORY_JSON_KEYS.some((key) => {
    const value = raw[key];
    return Array.isArray(value) && value.some(isPlainObject);
  });
}

/** Open a story JSON (picked or dropped) and return the new story id. */
export async function importStoryJsonFile(file: File): Promise<string> {
  const raw = JSON.parse(await file.text()) as unknown;
  if (!looksLikeStoryJson(raw)) {
    throw new Error(`${file.name} is not a Minerva story.`);
  }
  const data = validateDocumentData(raw);
  const base = file.name.replace(/\.json$/i, "").trim();
  const fallback = /^(document|story)$/i.test(base) ? "Imported Story" : base;
  return persistImportedStory(data, fallback);
}

/**
 * Point every relative pixel and feature-table path at the published copy
 * beside `documentUrl`, so the story keeps reading the hosted files.
 * Absolute URLs stay; `//host` takes the document's scheme.
 */
function withHostedSources(
  data: DocumentData,
  documentUrl: string,
): DocumentData {
  const hosted = (url: string) => new URL(url.trim() || ".", documentUrl).href;
  return {
    ...data,
    images: data.images.map((im) => {
      const source = im.source;
      if (source?.kind === "jpeg") {
        // The pyramid root is a folder; loaders join tile paths onto it.
        const url = hosted(source.url).replace(/\/$/, "");
        return { ...im, source: { kind: "jpeg" as const, url } };
      }
      if (source?.kind === "url") {
        const url = hosted(source.url);
        return { ...im, source: { kind: "url" as const, url } };
      }
      return im;
    }),
    featureTables: data.featureTables.map((table) =>
      table.source.kind === "url"
        ? {
            ...table,
            source: { kind: "url" as const, url: hosted(table.source.url) },
          }
        : table,
    ),
  };
}

/**
 * Copy the published story at `documentUrl` (absolute) into the library.
 * Pixels and feature tables stay on the host. Returns the new story id.
 */
export async function importStoryFromUrl(documentUrl: string): Promise<string> {
  const data = await fetchStoryDocument(documentUrl);
  // Normalize first so legacy sources become the story-root pyramid, then
  // point every relative path at the host.
  const hosted = withHostedSources(
    { ...data, images: portableImportImages(data) },
    documentUrl,
  );
  return persistImportedStory(hosted, "");
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

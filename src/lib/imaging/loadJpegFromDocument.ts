import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import type { JpegTileFetcher } from "@/lib/imaging/jpegImage";
import type { JpegLoaderEntry } from "@/lib/imaging/loaderEntries";
import type { Image } from "@/lib/stores/documentSchema";
import {
  folderLimitsForTransfer,
  type JpegExportTransfer,
} from "./cubeRootEncoding";
import { loadJpeg } from "./jpeg.js";
import {
  folderByChannelIndexFromGroup,
  folderByChannelIndexFromImageChannels,
  JPEG_BAKED_CONTRAST_LIMIT,
} from "./jpegPyramid";

type GroupChannelRow = {
  channelId: string;
  lowerLimit: number;
  upperLimit: number;
};

export type GroupLike = {
  id?: string;
  channels?: ReadonlyArray<{
    channelId?: string;
    lowerLimit?: number;
    upperLimit?: number;
  }>;
};

function toGroupChannelRows(
  channels: ReadonlyArray<{
    channelId?: string;
    lowerLimit?: number;
    upperLimit?: number;
  }>,
): GroupChannelRow[] {
  const rows: GroupChannelRow[] = [];
  for (const c of channels) {
    if (
      typeof c.channelId !== "string" ||
      typeof c.lowerLimit !== "number" ||
      typeof c.upperLimit !== "number"
    ) {
      continue;
    }
    rows.push({
      channelId: c.channelId,
      lowerLimit: c.lowerLimit,
      upperLimit: c.upperLimit,
    });
  }
  return rows;
}

function resolveJpegStoryRoot(documentUrl: string, sourceUrl: string): string {
  if (/^https?:\/\//i.test(sourceUrl)) {
    return sourceUrl.replace(/\/$/, "");
  }
  const doc = new URL(documentUrl, window.location.href);
  if (sourceUrl === "." || sourceUrl === "./" || sourceUrl === "") {
    const path = doc.pathname.replace(/\/[^/]*$/, "/");
    return new URL(path, doc).href.replace(/\/$/, "");
  }
  return new URL(sourceUrl, doc).href.replace(/\/$/, "");
}

/** Relative / empty jpeg `source.url` needs a persisted story directory handle. */
export function jpegSourceNeedsLocalRoot(url: string): boolean {
  return (
    url === "." || url === "./" || url === "" || !/^https?:\/\//i.test(url)
  );
}

function channelFoldersEqual(
  a: Record<number, string> | undefined,
  b: Record<number, string> | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => a[Number(k)] === b[Number(k)]);
}

function folderNamesAvailable(
  folders: Record<number, string>,
  available: ReadonlySet<string> | undefined,
): boolean {
  if (!available || available.size === 0) return false;
  const names = Object.values(folders);
  return (
    names.length > 0 && names.every((name) => available.has(name.toLowerCase()))
  );
}

function pickAvailableChannelFolders(opts: {
  desired: Record<number, string>;
  available: ReadonlySet<string> | undefined;
  activeGroupId?: string | null;
  groupChannelFolders: Readonly<
    Record<string, Readonly<Record<number, string>>>
  >;
  /**
   * When false and `activeGroupId` is set, do not fall back to a different
   * group's map (avoids leaving the wrong baked contrast after a group switch).
   * Initial hydrate passes true so any on-disk group can seed the loader.
   */
  allowOtherGroupFallback?: boolean;
}): Record<number, string> | null {
  const {
    desired,
    available,
    activeGroupId,
    groupChannelFolders,
    allowOtherGroupFallback = true,
  } = opts;
  if (folderNamesAvailable(desired, available)) return desired;
  if (activeGroupId) {
    const snapshot = groupChannelFolders[activeGroupId];
    if (snapshot && folderNamesAvailable(snapshot, available)) {
      return { ...snapshot };
    }
    if (!allowOtherGroupFallback) return null;
  }
  for (const snapshot of Object.values(groupChannelFolders)) {
    if (folderNamesAvailable(snapshot, available)) return { ...snapshot };
  }
  return null;
}

function applyChannelFoldersInPlace(
  entry: JpegLoaderEntry,
  folders: Record<number, string>,
): JpegLoaderEntry {
  if (
    !entry.channelFolders ||
    channelFoldersEqual(entry.channelFolders, folders)
  ) {
    return entry;
  }
  for (const key of Object.keys(entry.channelFolders)) {
    delete entry.channelFolders[Number(key)];
  }
  Object.assign(entry.channelFolders, folders);
  return { ...entry };
}

async function resolveChannelFolders(opts: {
  groupChannels: GroupChannelRow[];
  image: Image;
  transfer: JpegExportTransfer;
}): Promise<Record<number, string>> {
  const channelIndexById = Object.fromEntries(
    opts.image.channels.map((ch) => [ch.id, ch.index]),
  );
  if (opts.groupChannels.length > 0) {
    return folderByChannelIndexFromGroup({
      channels: opts.groupChannels.map((row) => ({
        channelId: row.channelId,
        ...folderLimitsForTransfer(
          opts.transfer,
          row.lowerLimit,
          row.upperLimit,
        ),
      })),
      channelIndexById,
    });
  }
  // No channel group yet — still map every image channel so tile indexing
  // does not throw "no pyramid folder for channel index".
  return folderByChannelIndexFromImageChannels(
    opts.image.channels.map((ch) => {
      const { lowerLimit, upperLimit } = folderLimitsForTransfer(
        opts.transfer,
        ch.lowerLimit ?? JPEG_BAKED_CONTRAST_LIMIT[0],
        ch.upperLimit ?? JPEG_BAKED_CONTRAST_LIMIT[1],
      );
      return {
        id: ch.id,
        index: ch.index,
        lowerLimit,
        upperLimit,
      };
    }),
  );
}

/**
 * Align each entry's channelFolders with the active group's contrast keys.
 * Mutates the existing folder map in place (loadJpeg closes over that object),
 * and returns a new entries array when anything changed so React re-renders.
 */
async function syncJpegEntryChannelFolders(
  entries: JpegLoaderEntry[],
  images: Image[],
  groupChannels: ReadonlyArray<{
    channelId?: string;
    lowerLimit?: number;
    upperLimit?: number;
  }>,
  activeGroupId: string | null | undefined,
): Promise<JpegLoaderEntry[]> {
  const channels = toGroupChannelRows(groupChannels);
  let changed = false;
  const next = await Promise.all(
    entries.map(async (entry) => {
      // Cube-root folders are contrast-stable; do not remount on contrast edits.
      if (entry.transfer === "cube-root") return entry;
      if (!entry.channelFolders) return entry;
      const im = images.find((i) => i.id === entry.sourceImageId);
      if (!im) return entry;
      const desired = await resolveChannelFolders({
        groupChannels: channels,
        image: im,
        transfer: entry.transfer ?? "contrast",
      });
      const folders = pickAvailableChannelFolders({
        desired,
        available: entry.availablePyramidFolders,
        activeGroupId,
        groupChannelFolders: entry.groupChannelFolders ?? {},
        allowOtherGroupFallback: false,
      });
      if (!folders) return entry;
      const applied = applyChannelFoldersInPlace(entry, folders);
      if (applied !== entry) changed = true;
      return applied;
    }),
  );
  return changed ? next : entries;
}

const JPEG_FOLDER_SYNC_DEBOUNCE_MS = 150;

function jpegFolderSyncKey(
  activeChannelGroupId: string | null | undefined,
  channelGroups: ReadonlyArray<GroupLike>,
  images: Image[],
  jpegLoaderEntries: JpegLoaderEntry[],
): string {
  const groupContrast = channelGroups
    .map((g) => {
      const rows = (g.channels ?? [])
        .map(
          (c) =>
            `${c.channelId ?? ""}:${c.lowerLimit ?? ""}:${c.upperLimit ?? ""}`,
        )
        .join(",");
      return `${g.id ?? ""}=${rows}`;
    })
    .join("|");
  const imageContrast = images
    .map((im) =>
      im.channels
        .map((c) => `${c.id}:${c.lowerLimit}:${c.upperLimit}`)
        .join(","),
    )
    .join("|");
  return [
    activeChannelGroupId ?? "",
    groupContrast,
    imageContrast,
    jpegLoaderEntries.map((e) => e.sourceImageId).join(","),
  ].join("\0");
}

/** Keep JPEG pyramid folder map aligned with the active channel group's contrast. */
export function useSyncJpegChannelFolders(
  jpegLoaderEntries: JpegLoaderEntry[],
  images: Image[],
  activeChannelGroupId: string | null | undefined,
  channelGroups: ReadonlyArray<GroupLike>,
  setJpegLoaderEntries: Dispatch<SetStateAction<JpegLoaderEntry[]>>,
): void {
  const syncedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = jpegFolderSyncKey(
      activeChannelGroupId,
      channelGroups,
      images,
      jpegLoaderEntries,
    );
    if (key === syncedKeyRef.current) return;
    if (jpegLoaderEntries.length === 0) {
      syncedKeyRef.current = key;
      return;
    }
    const group = activeChannelGroupId
      ? channelGroups.find((g) => g.id === activeChannelGroupId)
      : channelGroups[0];
    // Empty / missing group channels still sync via image-channel fallback.
    const channels = group?.channels ?? [];
    const groupId = group?.id ?? activeChannelGroupId;
    const delayMs =
      syncedKeyRef.current === null ? 0 : JPEG_FOLDER_SYNC_DEBOUNCE_MS;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const next = await syncJpegEntryChannelFolders(
            jpegLoaderEntries,
            images,
            channels,
            groupId,
          );
          if (cancelled) return;
          syncedKeyRef.current = key;
          setJpegLoaderEntries((prev) =>
            prev.length === next.length && prev.every((e, i) => e === next[i])
              ? prev
              : next,
          );
        } catch {
          // Leave the key unmarked so a later effect can retry.
        }
      })();
    }, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    activeChannelGroupId,
    channelGroups,
    images,
    jpegLoaderEntries,
    setJpegLoaderEntries,
  ]);
}

export async function jpegLoaderEntriesFromImages(opts: {
  images: Image[];
  channelGroups: ReadonlyArray<GroupLike>;
  /** Used when source.url is relative (e.g. document.json URL or page URL). */
  documentUrl: string;
  /** Prefer this group's contrast for initial folder map (defaults to first). */
  activeGroupId?: string | null;
  fetchTile?: JpegTileFetcher;
  transfer?: JpegExportTransfer;
  /**
   * On-disk pyramid folder names from the story root. When set, only these
   * names count as available (so sync cannot target missing hashes). When
   * omitted (remote URL pyramids), document group hashes are treated as available.
   */
  existingPyramidFolders?: ReadonlySet<string>;
}): Promise<JpegLoaderEntry[]> {
  const transfer = opts.transfer ?? "contrast";
  const activeGroup =
    (opts.activeGroupId
      ? opts.channelGroups.find((g) => g.id === opts.activeGroupId)
      : undefined) ?? opts.channelGroups[0];
  const groupChannels = toGroupChannelRows(activeGroup?.channels ?? []);
  const entries: JpegLoaderEntry[] = [];
  for (const im of opts.images) {
    if (im.source?.kind !== "jpeg") continue;
    // Relative "." needs a directory fetchTile, or a document.json URL so the
    // default HTTP fetcher can load pyramids next to the story (CDN player).
    if (jpegSourceNeedsLocalRoot(im.source.url) && !opts.fetchTile) {
      const path = new URL(opts.documentUrl, window.location.href).pathname;
      if (!/\/document\.json$/i.test(path)) continue;
    }
    const storyRootUrl = resolveJpegStoryRoot(opts.documentUrl, im.source.url);
    const groupChannelFolders: Record<string, Record<number, string>> = {};
    for (const group of opts.channelGroups) {
      if (typeof group.id !== "string") continue;
      const rows = toGroupChannelRows(group.channels ?? []);
      if (rows.length === 0) continue;
      groupChannelFolders[group.id] = await resolveChannelFolders({
        groupChannels: rows,
        image: im,
        transfer,
      });
    }
    const availablePyramidFolders = new Set<string>();
    if (opts.existingPyramidFolders) {
      for (const name of opts.existingPyramidFolders) {
        availablePyramidFolders.add(name.toLowerCase());
      }
    } else {
      for (const folders of Object.values(groupChannelFolders)) {
        for (const name of Object.values(folders)) {
          availablePyramidFolders.add(name.toLowerCase());
        }
      }
    }
    const desired = await resolveChannelFolders({
      groupChannels,
      image: im,
      transfer,
    });
    const channelFolders =
      pickAvailableChannelFolders({
        desired,
        available: availablePyramidFolders,
        activeGroupId: activeGroup?.id,
        groupChannelFolders,
      }) ?? desired;
    const loader = loadJpeg({
      imagePath: storyRootUrl,
      imageWidth: im.sizeX,
      imageHeight: im.sizeY,
      channels: im.channels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        index: ch.index,
      })),
      channelFolders,
      fetchTile: opts.fetchTile,
      transfer,
    });
    entries.push({
      loader,
      sourceImageId: im.id,
      channelFolders,
      imagePath: storyRootUrl,
      transfer,
      availablePyramidFolders,
      groupChannelFolders,
    });
  }
  return entries;
}

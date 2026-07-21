import { type Dispatch, type SetStateAction, useEffect } from "react";
import type { JpegTileFetcher } from "@/lib/imaging/jpegImage";
import type { JpegLoaderEntry } from "@/lib/imaging/loaderEntries";
import type { Image } from "@/lib/stores/documentSchema";
import { loadJpeg } from "./jpeg.js";
import {
  folderByChannelIndexFromGroup,
  folderByChannelIndexFromImageChannels,
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

async function resolveChannelFolders(opts: {
  groupChannels: GroupChannelRow[];
  image: Image;
}): Promise<Record<number, string>> {
  const channelIndexById = Object.fromEntries(
    opts.image.channels.map((ch) => [ch.id, ch.index]),
  );
  if (opts.groupChannels.length > 0) {
    return folderByChannelIndexFromGroup({
      channels: opts.groupChannels,
      channelIndexById,
    });
  }
  // No channel group yet — still map every image channel so tile indexing
  // does not throw "no pyramid folder for channel index".
  return folderByChannelIndexFromImageChannels(
    opts.image.channels.map((ch) => ({
      id: ch.id,
      index: ch.index,
      lowerLimit: ch.lowerLimit,
      upperLimit: ch.upperLimit,
    })),
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
): Promise<JpegLoaderEntry[]> {
  const channels = toGroupChannelRows(groupChannels);
  let changed = false;
  const next = await Promise.all(
    entries.map(async (entry) => {
      if (!entry.channelFolders) return entry;
      const im = images.find((i) => i.id === entry.sourceImageId);
      if (!im) return entry;
      const folders = await resolveChannelFolders({
        groupChannels: channels,
        image: im,
      });
      if (channelFoldersEqual(entry.channelFolders, folders)) {
        return entry;
      }
      for (const key of Object.keys(entry.channelFolders)) {
        delete entry.channelFolders[Number(key)];
      }
      Object.assign(entry.channelFolders, folders);
      changed = true;
      return { ...entry };
    }),
  );
  return changed ? next : entries;
}

/** Keep JPEG pyramid folder map aligned with the active channel group's contrast. */
export function useSyncJpegChannelFolders(
  jpegLoaderEntries: JpegLoaderEntry[],
  images: Image[],
  activeChannelGroupId: string | null | undefined,
  channelGroups: ReadonlyArray<GroupLike>,
  setJpegLoaderEntries: Dispatch<SetStateAction<JpegLoaderEntry[]>>,
): void {
  useEffect(() => {
    if (jpegLoaderEntries.length === 0) return;
    const group = activeChannelGroupId
      ? channelGroups.find((g) => g.id === activeChannelGroupId)
      : channelGroups[0];
    // Empty / missing group channels still sync via image-channel fallback.
    const channels = group?.channels ?? [];
    let cancelled = false;
    void (async () => {
      const next = await syncJpegEntryChannelFolders(
        jpegLoaderEntries,
        images,
        channels,
      );
      if (cancelled) return;
      setJpegLoaderEntries((prev) =>
        prev.length === next.length && prev.every((e, i) => e === next[i])
          ? prev
          : next,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeChannelGroupId,
    channelGroups,
    jpegLoaderEntries,
    images,
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
}): Promise<JpegLoaderEntry[]> {
  const activeGroup =
    (opts.activeGroupId
      ? opts.channelGroups.find((g) => g.id === opts.activeGroupId)
      : undefined) ?? opts.channelGroups[0];
  const groupChannels = toGroupChannelRows(activeGroup?.channels ?? []);
  const entries: JpegLoaderEntry[] = [];
  for (const im of opts.images) {
    if (im.source?.kind !== "jpeg") continue;
    const storyRootUrl = resolveJpegStoryRoot(opts.documentUrl, im.source.url);
    const channelFolders = await resolveChannelFolders({
      groupChannels,
      image: im,
    });
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
    });
    entries.push({
      loader,
      sourceImageId: im.id,
      channelFolders,
      imagePath: storyRootUrl,
    });
  }
  return entries;
}

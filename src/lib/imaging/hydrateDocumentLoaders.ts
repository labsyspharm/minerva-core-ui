import { resolveImageContentRole } from "@/lib/imaging/channelKind";
import { loadDicomWeb, parseDicomWeb } from "@/lib/imaging/dicom.js";
import type { DicomIndex, DicomLoader } from "@/lib/imaging/dicomIndex";
import {
  ensureFileHandlePermission,
  findFile,
  hasFileHandlePermission,
  loadOmeLoaderForRole,
} from "@/lib/imaging/filesystem";
import type { JpegTileFetcher } from "@/lib/imaging/jpegImage";
import {
  type GroupLike,
  jpegLoaderEntriesFromImages,
} from "@/lib/imaging/loadJpegFromDocument";
import { getFileHandle } from "@/lib/persistence/fileHandles";
import type { Image } from "@/lib/stores/documentSchema";
import type { JpegLoaderEntry, OmeLoaderEntry } from "./loaderEntries";
import type { PoolClass } from "./workers/pool";
import { Pool } from "./workers/pool";

export type HydrateDocumentLoadersResult = {
  jpegLoaderEntries: JpegLoaderEntry[];
  omeLoaderEntries: OmeLoaderEntry[];
  dicomIndexList: DicomIndex[];
  deniedHandleKeys: string[];
  /** Local source present but no handle in IDB/session (typical after Firefox refresh). */
  missingHandleKeys: string[];
};

export type HydrateDocumentLoadersOpts = {
  channelGroups?: ReadonlyArray<GroupLike>;
  /** Used when source.url is relative (e.g. document.json URL or page URL). */
  documentUrl?: string;
  /** When omitted, a default worker pool is created for OME decode. Pass `null` to skip pooling. */
  pool?: PoolClass | null;
  requestPermission?: boolean;
  /** When false, skip `local` file-handle sources (CDN / URL-only stories). */
  includeLocal?: boolean;
  fetchTile?: JpegTileFetcher;
};

const omeLoaderRole = (im: Image): "intensity" | "segmentation" =>
  resolveImageContentRole({
    contentRole: im.contentRole,
    channels: im.channels ?? [],
  }) === "segmentation"
    ? "segmentation"
    : "intensity";

/** Rebuild Viv / DICOM loaders from persisted document image rows. */
export async function hydrateDocumentLoaders(
  images: Image[],
  opts: HydrateDocumentLoadersOpts = {},
): Promise<HydrateDocumentLoadersResult> {
  const jpegLoaderEntries: JpegLoaderEntry[] = [];
  const omeLoaderEntries: OmeLoaderEntry[] = [];
  const dicomIndexList: DicomIndex[] = [];
  const deniedHandleKeys: string[] = [];
  const missingHandleKeys: string[] = [];
  const pool = opts.pool === null ? undefined : (opts.pool ?? new Pool());
  const dicomSeriesSeen = new Set<string>();
  const requestPermission = opts.requestPermission ?? false;
  const includeLocal = opts.includeLocal ?? true;
  const canAccess = requestPermission
    ? ensureFileHandlePermission
    : hasFileHandlePermission;
  const channelGroups = opts.channelGroups ?? [];
  const documentUrl = opts.documentUrl ?? window.location.href;

  jpegLoaderEntries.push(
    ...(await jpegLoaderEntriesFromImages({
      images,
      channelGroups,
      documentUrl,
      ...(opts.fetchTile ? { fetchTile: opts.fetchTile } : {}),
    })),
  );

  for (const im of images) {
    if (!im.source) continue;
    if (im.source.kind === "jpeg") continue;
    switch (im.source.kind) {
      case "url": {
        const loader = await loadOmeLoaderForRole(omeLoaderRole(im), {
          kind: "url",
          url: im.source.url,
          ...(pool ? { pool } : {}),
        });
        omeLoaderEntries.push({ loader, sourceImageId: im.id });
        break;
      }
      case "local": {
        if (!includeLocal) break;
        const handle = await getFileHandle(im.source.handleKey);
        if (!handle) {
          missingHandleKeys.push(im.source.handleKey);
          break;
        }
        if (!(await canAccess(handle))) {
          deniedHandleKeys.push(im.source.handleKey);
          break;
        }
        if (!(await findFile({ handle }))) break;
        const file = await handle.getFile();
        const loader = await loadOmeLoaderForRole(omeLoaderRole(im), {
          kind: "local",
          handle,
          in_f: file.name,
          ...(pool ? { pool } : {}),
        });
        omeLoaderEntries.push({ loader, sourceImageId: im.id });
        break;
      }
      case "dicomWeb": {
        const { series, modality } = im.source;
        if (dicomSeriesSeen.has(series)) break;
        dicomSeriesSeen.add(series);
        const pyramids = await loadDicomWeb(series);
        const loader = parseDicomWeb({
          pyramids,
          series,
          little_endian: true,
        }) as DicomLoader;
        dicomIndexList.push({
          series,
          pyramids,
          modality,
          loader,
          sourceImageId: im.id,
        });
        break;
      }
    }
  }

  return {
    jpegLoaderEntries,
    omeLoaderEntries,
    dicomIndexList,
    deniedHandleKeys,
    missingHandleKeys,
  };
}

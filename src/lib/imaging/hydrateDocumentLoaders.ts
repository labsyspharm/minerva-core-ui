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
  isRelativeOmeTiffUrl,
  jpegLoaderEntriesFromImages,
} from "@/lib/imaging/loadJpegFromDocument";
import { getFileHandle } from "@/lib/persistence/fileHandles";
import type { Image } from "@/lib/stores/documentSchema";
import {
  hydrateJpegTransferForImage,
  isJpegOmeTiffImageSource,
  type JpegExportTransfer,
  jpegTransferFromImageSource,
  u8ToU16Lut,
} from "./cubeRootEncoding";
import type { JpegLoaderEntry, OmeLoaderEntry } from "./loaderEntries";
import { type DecodePool, sharedOmeDecodePool } from "./omeDecodePool";
import type { Loader } from "./viv";
import { wrapOmeLoaderJpegExport } from "./wrapOmeLoaderCubeRoot";

export type HydrateDocumentLoadersResult = {
  jpegLoaderEntries: JpegLoaderEntry[];
  omeLoaderEntries: OmeLoaderEntry[];
  dicomIndexList: DicomIndex[];
  deniedHandleKeys: string[];
  /** Local source present but no handle in IDB/session (typical after Firefox refresh). */
  missingHandleKeys: string[];
  /** Per-image load failures (e.g. untiled mask larger than the GPU). */
  loaderErrors: string[];
};

export type HydrateDocumentLoadersOpts = {
  channelGroups?: ReadonlyArray<GroupLike>;
  /** Used when source.url is relative (e.g. document.json URL or page URL). */
  documentUrl?: string;
  /** When omitted, a default worker pool is created for OME decode. Pass `null` to skip pooling. */
  pool?: DecodePool | null;
  requestPermission?: boolean;
  /** When false, skip `local` file-handle sources (CDN / URL-only stories). */
  includeLocal?: boolean;
  fetchTile?: JpegTileFetcher;
  existingPyramidFolders?: ReadonlySet<string>;
  /** When set, wrap OME loaders for cube-root JPEG OME-TIFF decode. */
  imageSource?: string;
  /**
   * Authoring: the file for a relative OME-TIFF `url` source (one the user
   * located, or the story folder's copy) and the Dexie key it is stored
   * under; no `handle` when that key needs permission first. Without a
   * result the image stays unloaded until located.
   */
  resolveRelativeFile?: (
    image: Image,
  ) => Promise<{ handle?: Handle.File; key: string } | undefined>;
  /**
   * Called as images open, with the loaders ready so far in document order.
   * Waits for the first OME image so the viewer's first loader (its world
   * frame) never changes. Not called for stories with DICOM images.
   */
  onLoaders?: (ready: ReadyDocumentLoaders) => void;
};

type ReadyDocumentLoaders = Pick<
  HydrateDocumentLoadersResult,
  "jpegLoaderEntries" | "omeLoaderEntries" | "dicomIndexList"
>;

const omeLoaderRole = (im: Image): "intensity" | "segmentation" =>
  resolveImageContentRole({
    contentRole: im.contentRole,
    channels: im.channels ?? [],
  }) === "segmentation"
    ? "segmentation"
    : "intensity";

function omeLoaderForHydrate(
  loader: Loader,
  im: Image,
  wrapOmeJpeg: boolean,
  storyTransfer: JpegExportTransfer,
): Pick<OmeLoaderEntry, "loader" | "transfer"> {
  // A gray ICC profile is already applied in `loadOmeLoaderForRole`. Only the
  // export's own 8-bit files still widen through the story transfer: a 16-bit
  // source located or imported into an exported story must not.
  const jpegTransfer =
    wrapOmeJpeg && loader.data?.[0]?.dtype === "Uint8"
      ? hydrateJpegTransferForImage(im, storyTransfer)
      : null;
  if (!jpegTransfer) {
    return { loader };
  }
  return {
    loader: wrapOmeLoaderJpegExport(loader, u8ToU16Lut(jpegTransfer)),
    transfer: jpegTransfer,
  };
}

/**
 * Viv's `loadOmeTiff` does `new URL(source)` with no base, so relative
 * export paths (`foo.ome.tif`) must be resolved against document.json.
 */
function resolveOmeSourceUrl(documentUrl: string, sourceUrl: string): string {
  // An absolute URL (any scheme) ignores the base; `//host` takes its scheme.
  return new URL(sourceUrl.trim(), new URL(documentUrl, window.location.href))
    .href;
}

/** Rebuild Viv / DICOM loaders from persisted document image rows. */
export async function hydrateDocumentLoaders(
  images: Image[],
  opts: HydrateDocumentLoadersOpts = {},
): Promise<HydrateDocumentLoadersResult> {
  const jpegLoaderEntries: JpegLoaderEntry[] = [];
  const dicomIndexList: DicomIndex[] = [];
  const deniedHandleKeys: string[] = [];
  const missingHandleKeys: string[] = [];
  const loaderErrors: string[] = [];
  const pool =
    opts.pool === null ? undefined : (opts.pool ?? sharedOmeDecodePool());
  const dicomSeriesSeen = new Set<string>();
  const requestPermission = opts.requestPermission ?? false;
  const includeLocal = opts.includeLocal ?? true;
  const canAccess = requestPermission
    ? ensureFileHandlePermission
    : hasFileHandlePermission;
  const channelGroups = opts.channelGroups ?? [];
  const documentUrl = opts.documentUrl ?? window.location.href;
  const transfer = jpegTransferFromImageSource(opts.imageSource);
  const wrapOmeJpeg = isJpegOmeTiffImageSource(opts.imageSource);

  jpegLoaderEntries.push(
    ...(await jpegLoaderEntriesFromImages({
      images,
      channelGroups,
      documentUrl,
      transfer,
      ...(opts.fetchTile ? { fetchTile: opts.fetchTile } : {}),
      ...(opts.existingPyramidFolders
        ? { existingPyramidFolders: opts.existingPyramidFolders }
        : {}),
    })),
  );

  // One slot per image in document order: undefined while an OME image is
  // opening, null once it is settled without a loader (or is not OME).
  const omeSlots: (OmeLoaderEntry | null | undefined)[] = images.map((im) =>
    im.source?.kind === "url" || im.source?.kind === "local" ? undefined : null,
  );
  const readyOme = () =>
    omeSlots.filter((slot): slot is OmeLoaderEntry => slot != null);
  // DICOM loaders come first in the viewer's list, so one opening late would
  // change its world frame.
  const onLoaders = images.some((im) => im.source?.kind === "dicomWeb")
    ? undefined
    : opts.onLoaders;
  let publishedCount = 0;
  const settle = (index: number, entry: OmeLoaderEntry | null) => {
    omeSlots[index] = entry;
    const first = omeSlots.findIndex((slot) => slot !== null);
    if (!onLoaders || first < 0 || omeSlots[first] === undefined) return;
    const ready = readyOme();
    if (ready.length === publishedCount) return;
    publishedCount = ready.length;
    onLoaders({ jpegLoaderEntries, omeLoaderEntries: ready, dicomIndexList });
  };

  const openOme = async (
    index: number,
    im: Image,
    source: Parameters<typeof loadOmeLoaderForRole>[1],
  ) => {
    let entry: OmeLoaderEntry | null = null;
    try {
      const loader = await loadOmeLoaderForRole(omeLoaderRole(im), source);
      entry = {
        ...omeLoaderForHydrate(loader, im, wrapOmeJpeg, transfer),
        sourceImageId: im.id,
      };
    } catch (e) {
      loaderErrors.push(
        e instanceof Error ? e.message : `Could not load ${im.basename}`,
      );
    }
    settle(index, entry);
  };

  const loadLocalFile = (index: number, im: Image, handle: Handle.File) =>
    openOme(index, im, {
      kind: "local",
      handle,
      ...(pool ? { pool } : {}),
      rgbDisplay: im.rgbDisplay,
    });

  // Remote TIFFs need no permission prompt, so they open side by side.
  const remoteOpens: Promise<void>[] = [];
  for (const [index, im] of images.entries()) {
    if (!im.source) continue;
    if (im.source.kind === "jpeg") continue;
    const opening = remoteOpens.length;
    switch (im.source.kind) {
      case "url": {
        // Authoring has no served story root: a relative TIFF is read from a
        // file the user located or the story folder, else it stays unloaded
        // until located. The player resolves it against document.json.
        if (includeLocal && isRelativeOmeTiffUrl(im.source.url)) {
          let resolved: Awaited<
            ReturnType<NonNullable<typeof opts.resolveRelativeFile>>
          >;
          try {
            resolved = await opts.resolveRelativeFile?.(im);
          } catch (e) {
            // One unreadable path leaves this image to be located, not the rest.
            console.warn("[minerva] could not resolve", im.source.url, e);
            break;
          }
          if (!resolved) break;
          if (!resolved.handle || !(await canAccess(resolved.handle))) {
            deniedHandleKeys.push(resolved.key);
            break;
          }
          if (await findFile({ handle: resolved.handle })) {
            await loadLocalFile(index, im, resolved.handle);
          }
          break;
        }
        remoteOpens.push(
          openOme(index, im, {
            kind: "url",
            url: resolveOmeSourceUrl(documentUrl, im.source.url),
            ...(pool ? { pool } : {}),
            rgbDisplay: im.rgbDisplay,
          }),
        );
        break;
      }
      case "local": {
        if (!includeLocal) break;
        const stored = await getFileHandle(im.source.handleKey);
        if (!stored || stored.kind !== "file") {
          missingHandleKeys.push(im.source.handleKey);
          break;
        }
        const handle = stored as Handle.File;
        if (!(await canAccess(handle))) {
          deniedHandleKeys.push(im.source.handleKey);
          break;
        }
        if (!(await findFile({ handle }))) break;
        await loadLocalFile(index, im, handle);
        break;
      }
      case "dicomWeb": {
        const { series, modality } = im.source;
        if (dicomSeriesSeen.has(series)) break;
        dicomSeriesSeen.add(series);
        const { pyramids } = await loadDicomWeb(series);
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
    // Skipped here (no file, no permission, not found): settled with nothing.
    if (omeSlots[index] === undefined && remoteOpens.length === opening) {
      settle(index, null);
    }
  }
  await Promise.all(remoteOpens);

  return {
    jpegLoaderEntries,
    omeLoaderEntries: readyOme(),
    dicomIndexList,
    deniedHandleKeys,
    missingHandleKeys,
    loaderErrors,
  };
}

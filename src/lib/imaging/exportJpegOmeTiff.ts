import {
  browserFileSink,
  createTiffWriter,
  grayscaleJpegTags,
  type PlanPyramidJob,
  planPyramid,
} from "tiffwriter";
import { getFileHandle } from "@/lib/persistence/fileHandles";
import type {
  ChannelGroup,
  Image,
  ImageChannel,
} from "@/lib/stores/documentSchema";
import {
  exportTransferForImage,
  folderLimitsForTransfer,
  type JpegExportTransfer,
} from "./cubeRootEncoding";
import {
  exportZlibOmeTiffImage,
  maskExportTileCount,
} from "./exportZlibOmeTiff";
import { encodeTileJpeg, jpegExportConcurrency } from "./jpegExportPool";
import type { OmeLoaderEntry } from "./loaderEntries";
import {
  type BrightfieldTally,
  brightfieldSampleMax,
  brightfieldSampleOffsets,
  brightfieldTallyMatches,
  omeTiffBaseIsJpeg,
  tallyBrightfieldSamples,
} from "./omeTiff";
import {
  allocateOmeTiffExportFileNames,
  buildOmeTiffXml,
  contrastLimitsForExportedChannel,
  groupIntensityChannelsForOmeExport,
  groupMaskChannelsForOmeExport,
  type LoaderPlane,
  loaderPlanesOrUndef,
  planeLevels,
  remappedImageForOmeTiffExport,
  stitchOmeTiffExportImages,
  tileCountForLevels,
} from "./omeTiffExport";

type JpegExportChannelSource = {
  channel: ImageChannel;
  planes: LoaderPlane[];
};

type ExportJpegOmeTiffOpts = {
  directory: FileSystemDirectoryHandle;
  layoutPlanes: LoaderPlane[];
  image: Image;
  channelSources: JpegExportChannelSource[];
  channelGroups: ChannelGroup[];
  fileName: string;
  transfer: JpegExportTransfer;
  signal: AbortSignal;
  onProgress?: (deltaCompleted: number) => void;
};

function interleavePlanar(planes: ArrayLike<number>[]): Float64Array {
  const n = planes.reduce(
    (min, plane) => Math.min(min, plane.length),
    planes[0]?.length ?? 0,
  );
  const out = new Float64Array(n * planes.length);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < planes.length; c++) {
      out[i * planes.length + c] = planes[c][i];
    }
  }
  return out;
}

/**
 * Cube-root lifts dark pixels. That is right for fluorescence and washes out
 * brightfield (white glass, dark stain). Sample the coarsest level the same
 * way import does; a brightfield hit forces contrast.
 */
async function planesLookBrightfield(
  planes: LoaderPlane[],
  channels: ImageChannel[],
  signal: AbortSignal,
): Promise<boolean> {
  if (channels.length !== 1 && channels.length < 3) return false;
  const level = planes[planes.length - 1];
  if (!level?.getTile) return false;
  const { width, height, tileSize } = planeLevels(planes).at(-1) ?? {
    width: 0,
    height: 0,
    tileSize: 256,
  };
  if (width <= 0 || height <= 0) return false;
  const tile = Math.max(1, tileSize);
  const xs = brightfieldSampleOffsets(width, tile);
  const ys = brightfieldSampleOffsets(height, tile);
  const use = channels.slice(0, 3);
  const tally: BrightfieldTally = { nDark: 0, nLight: 0 };
  for (const y0 of ys) {
    for (const x0 of xs) {
      if (signal.aborted) return false;
      const x = Math.floor(x0 / tile);
      const y = Math.floor(y0 / tile);
      let tiles: { data: ArrayLike<number> }[];
      try {
        tiles = await Promise.all(
          use.map((ch) =>
            level.getTile({
              selection: { t: 0, z: 0, c: ch.index },
              x,
              y,
              signal,
            }),
          ),
        );
      } catch {
        continue;
      }
      if (signal.aborted) return false;
      const sampleMax = brightfieldSampleMax(tiles[0].data, level.dtype);
      if (use.length >= 3) {
        tallyBrightfieldSamples(
          interleavePlanar(tiles.map((t) => t.data)),
          { sampleMax, channels: 3 },
          tally,
        );
      } else {
        tallyBrightfieldSamples(
          tiles[0].data,
          { sampleMax, channels: 1 },
          tally,
        );
      }
    }
  }
  return brightfieldTallyMatches(tally);
}

async function transferForBrightfield(
  image: Image,
  storyTransfer: JpegExportTransfer,
  planes: LoaderPlane[],
  channels: ImageChannel[],
  signal: AbortSignal,
): Promise<{ transfer: JpegExportTransfer; image: Image }> {
  const transfer = exportTransferForImage(image, storyTransfer);
  if (transfer !== "cube-root") return { transfer, image };
  if (!(await planesLookBrightfield(planes, channels, signal))) {
    return { transfer, image };
  }
  return {
    transfer: "contrast",
    image: image.rgbDisplay === true ? image : { ...image, rgbDisplay: true },
  };
}

function absoluteSourceUrl(url: string): string {
  const trimmed = url.trim();
  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("file:")
  ) {
    return trimmed;
  }
  return new URL(trimmed, window.location.href).href;
}

/** Header probe first. The body is opened only after the file is known to be JPEG. */
async function openCopySource(
  image: Image,
  signal: AbortSignal,
): Promise<{
  probe: Blob | string;
  openBody: () => Promise<{ stream: ReadableStream<Uint8Array>; size: number }>;
} | null> {
  const source = image.source;
  if (!source) return null;
  if (source.kind === "local") {
    const stored = await getFileHandle(source.handleKey);
    if (!stored || stored.kind !== "file") return null;
    const file = await (stored as FileSystemFileHandle).getFile();
    return {
      probe: file,
      openBody: async () => ({ stream: file.stream(), size: file.size }),
    };
  }
  if (source.kind === "url") {
    const url = absoluteSourceUrl(source.url);
    return {
      probe: url,
      openBody: async () => {
        const response = await fetch(url, { signal });
        if (!response.ok || !response.body) {
          throw new Error(`Failed to fetch ${url} (${response.status})`);
        }
        const length = Number(response.headers.get("content-length"));
        return {
          stream: response.body,
          size: Number.isFinite(length) && length > 0 ? length : 0,
        };
      },
    };
  }
  return null;
}

async function writeStream(
  directory: FileSystemDirectoryHandle,
  fileName: string,
  stream: ReadableStream<Uint8Array>,
  size: number,
  signal: AbortSignal,
  onProgress: (written: number, total: number) => void,
): Promise<void> {
  const fh = await directory.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  let written = 0;
  const reader = stream.getReader();
  try {
    while (true) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      const bytes =
        value.buffer instanceof ArrayBuffer
          ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          : new Uint8Array(value);
      await writable.write(bytes);
      written += value.byteLength;
      if (size > 0) onProgress(written, size);
    }
    await writable.close();
    onProgress(Math.max(written, size), Math.max(size, 1));
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    try {
      await writable.abort?.();
    } catch {
      /* ignore */
    }
    throw error;
  }
}

/**
 * Brightfield slides are usually already JPEG tiles. Copy the file when the
 * full-resolution IFD says so; otherwise the caller re-encodes.
 */
async function copyJpegBrightfieldSource(
  image: Image,
  directory: FileSystemDirectoryHandle,
  fileName: string,
  signal: AbortSignal,
  onProgress: (written: number, total: number) => void,
): Promise<Image | null> {
  const opened = await openCopySource(image, signal);
  if (!opened) return null;
  if (!(await omeTiffBaseIsJpeg(opened.probe, signal))) return null;
  const body = await opened.openBody();
  await writeStream(
    directory,
    fileName,
    body.stream,
    body.size,
    signal,
    onProgress,
  );
  return { ...image, source: { kind: "url", url: fileName } };
}

/** Write one multi-channel JPEG pyramidal OME-TIFF (contrast or cube-root uint8). */
async function exportJpegOmeTiffImage(
  opts: ExportJpegOmeTiffOpts,
): Promise<Image> {
  const {
    directory,
    layoutPlanes,
    image,
    channelSources,
    channelGroups,
    fileName,
    transfer,
    signal,
    onProgress,
  } = opts;
  const channels = channelSources.map((s) => s.channel);
  if (channels.length === 0) {
    throw new Error(
      `No intensity channels to export for ${image.basename || image.id}`,
    );
  }
  if (!layoutPlanes.length) {
    throw new Error(
      `Loader has no pyramid levels for ${image.basename || image.id}`,
    );
  }

  const levels = planeLevels(layoutPlanes);
  const channelLimits = channels.map((ch) => {
    const lim = contrastLimitsForExportedChannel(ch, channelGroups);
    return folderLimitsForTransfer(transfer, lim.lowerLimit, lim.upperLimit);
  });

  const omeXml = buildOmeTiffXml({
    imageName: image.basename || image.id || "image",
    channels,
    width: levels[0].width,
    height: levels[0].height,
    fileName,
    pixelType: "uint8",
    significantBits: 8,
  });

  const { layouts, jobs } = planPyramid({
    levels,
    channelCount: channels.length,
    baseTags: grayscaleJpegTags(),
    imageDescription: omeXml,
  });

  const fh = await directory.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();

  let exportFailed: Error | null = null;
  const localAbort = new AbortController();
  const onOuterAbort = () => localAbort.abort();
  signal.addEventListener("abort", onOuterAbort);
  if (signal.aborted) localAbort.abort();
  const workSignal = localAbort.signal;

  const failExport = (e: unknown) => {
    if (!exportFailed) {
      exportFailed =
        e instanceof Error
          ? e
          : new Error(String(e ?? "OME-TIFF export failed"));
    }
    localAbort.abort();
  };

  let writer: Awaited<ReturnType<typeof createTiffWriter>>;
  try {
    writer = await createTiffWriter({
      sink: browserFileSink(writable),
      signal: workSignal,
      images: layouts,
    });
  } catch (e) {
    signal.removeEventListener("abort", onOuterAbort);
    try {
      await writable.abort?.();
    } catch {
      /* ignore */
    }
    throw e;
  }

  const concurrency = Math.min(
    jpegExportConcurrency(),
    Math.max(1, jobs.length),
  );
  let next = 0;

  const runJob = async (job: PlanPyramidJob) => {
    if (workSignal.aborted) return;
    const source = channelSources[job.channelIndex];
    const levelIndex = Math.min(job.levelIndex, source.planes.length - 1);
    const plane = source.planes[levelIndex];
    const tileSize = levels[job.levelIndex].tileSize;
    const channel = source.channel;
    const limits = channelLimits[job.channelIndex];
    const tile = await plane.getTile({
      selection: { t: 0, z: 0, c: channel.index },
      x: job.x,
      y: job.y,
      signal: workSignal,
    });
    if (workSignal.aborted) return;
    const { width, height, data } = tile;
    const jpeg = await encodeTileJpeg({
      width,
      height,
      data: data as ArrayLike<number> & {
        buffer: ArrayBufferLike;
        byteOffset: number;
        byteLength: number;
      },
      lowerLimit: limits.lowerLimit,
      upperLimit: limits.upperLimit,
      transfer,
      padTileSize: tileSize,
    });
    if (workSignal.aborted) return;
    await writer.writeSegment(job.address, new Uint8Array(jpeg));
    onProgress?.(1);
  };

  const workerLoop = async () => {
    while (!workSignal.aborted) {
      const i = next++;
      if (i >= jobs.length) return;
      try {
        await runJob(jobs[i]);
      } catch (e) {
        if (workSignal.aborted) return;
        console.error(e instanceof Error ? e.message : e);
        try {
          await runJob(jobs[i]);
        } catch (e2) {
          console.error(e2 instanceof Error ? e2.message : e2);
          failExport(e2);
          return;
        }
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: concurrency }, () => workerLoop()));
    if (exportFailed) throw exportFailed;
    if (signal.aborted || workSignal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    await writer.finish();
  } catch (e) {
    try {
      await writer.abort(e);
    } catch {
      /* ignore */
    }
    try {
      await writable.abort?.();
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    signal.removeEventListener("abort", onOuterAbort);
  }

  return remappedImageForOmeTiffExport(image, channels, fileName);
}

export type ExportJpegOmeTiffStoryOpts = {
  directory: FileSystemDirectoryHandle;
  omeLoaderEntries: OmeLoaderEntry[];
  images: Image[];
  channelGroups: ChannelGroup[];
  transfer: JpegExportTransfer;
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
};

export async function exportJpegOmeTiffStory(
  opts: ExportJpegOmeTiffStoryOpts,
): Promise<Image[]> {
  const {
    directory,
    omeLoaderEntries,
    images,
    channelGroups,
    transfer,
    signal,
    onProgress,
  } = opts;
  if (omeLoaderEntries.length === 0) {
    throw new Error(
      "OME-TIFF export needs an OME or DICOM source image loaded.",
    );
  }

  type ImageWork = {
    entry: OmeLoaderEntry;
    image: Image;
    planes: LoaderPlane[];
    intensity: ImageChannel[];
    masks: ImageChannel[];
  };
  const perImage: ImageWork[] = [];

  for (const entry of omeLoaderEntries) {
    const image = images.find((im) => im.id === entry.sourceImageId);
    if (!image) continue;
    const planes = loaderPlanesOrUndef(entry);
    if (!planes) continue;
    const intensity = groupIntensityChannelsForOmeExport(image, channelGroups);
    const masks = groupMaskChannelsForOmeExport(image, channelGroups);
    if (intensity.length === 0 && masks.length === 0) continue;
    perImage.push({ entry, image, planes, intensity, masks });
  }

  const imageOrder = new Map(images.map((im, i) => [im.id, i]));
  const byDoc = (a: ImageWork, b: ImageWork) =>
    (imageOrder.get(a.image.id) ?? 0) - (imageOrder.get(b.image.id) ?? 0);
  const intensityItems = perImage
    .filter((w) => w.intensity.length > 0)
    .sort(byDoc);
  const maskItems = perImage.filter((w) => w.masks.length > 0).sort(byDoc);

  if (intensityItems.length === 0 && maskItems.length === 0) {
    throw new Error("No channels available for OME-TIFF export.");
  }

  let totalTiles = 0;
  for (const item of intensityItems) {
    totalTiles += tileCountForLevels(
      planeLevels(item.planes),
      item.intensity.length,
    );
  }
  for (const item of maskItems) {
    totalTiles += maskExportTileCount(item.entry, item.masks.length);
  }

  const { intensityFileNames, maskFileNames } = allocateOmeTiffExportFileNames(
    intensityItems.map((item) => item.image),
    maskItems.map((item) => item.image),
  );

  let completed = 0;
  onProgress?.(0, totalTiles);
  const bump = (delta: number) => {
    completed += delta;
    onProgress?.(completed, totalTiles);
  };

  const remappedById = new Map<string, Image>();
  const insertedAfter = new Map<string, Image[]>();
  const copiedSourceIds = new Set<string>();

  for (let i = 0; i < intensityItems.length; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const item = intensityItems[i];
    const decided = await transferForBrightfield(
      item.image,
      transfer,
      item.planes,
      item.intensity,
      signal,
    );
    if (decided.transfer === "contrast") {
      const imageTiles = tileCountForLevels(
        planeLevels(item.planes),
        item.intensity.length,
      );
      let credited = 0;
      const credit = (written: number, total: number) => {
        const next =
          total > 0
            ? Math.min(imageTiles, Math.floor((written / total) * imageTiles))
            : 0;
        if (next > credited) {
          bump(next - credited);
          credited = next;
        }
      };
      try {
        const copied = await copyJpegBrightfieldSource(
          decided.image,
          directory,
          intensityFileNames[i],
          signal,
          credit,
        );
        if (copied) {
          if (credited < imageTiles) bump(imageTiles - credited);
          copiedSourceIds.add(item.image.id);
          remappedById.set(item.image.id, copied);
          continue;
        }
      } catch (error) {
        if (signal.aborted) throw error;
        console.warn(
          "[minerva] jpeg brightfield copy failed, re-encoding",
          error,
        );
      }
    }
    let jpegImage = await exportJpegOmeTiffImage({
      directory,
      layoutPlanes: item.planes,
      image: decided.image,
      channelSources: item.intensity.map((channel) => ({
        channel,
        planes: item.planes,
      })),
      channelGroups,
      fileName: intensityFileNames[i],
      transfer: decided.transfer,
      signal,
      onProgress: bump,
    });
    if (item.masks.length > 0) {
      jpegImage = { ...jpegImage, contentRole: "intensity" };
    }
    remappedById.set(item.image.id, jpegImage);
  }

  for (let i = 0; i < maskItems.length; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const item = maskItems[i];
    if (copiedSourceIds.has(item.image.id)) {
      bump(maskExportTileCount(item.entry, item.masks.length));
      continue;
    }
    const splitFromIntensity = remappedById.has(item.image.id);
    const maskSource = splitFromIntensity
      ? { ...item.image, id: crypto.randomUUID() }
      : item.image;
    const maskImage = await exportZlibOmeTiffImage({
      directory,
      entry: item.entry,
      image: maskSource,
      channels: item.masks,
      fileName: maskFileNames[i],
      signal,
      onProgress: bump,
    });
    if (splitFromIntensity) {
      const extra = insertedAfter.get(item.image.id) ?? [];
      extra.push(maskImage);
      insertedAfter.set(item.image.id, extra);
    } else {
      remappedById.set(item.image.id, maskImage);
    }
  }

  return stitchOmeTiffExportImages(
    images,
    remappedById,
    insertedAfter,
    new Set(),
  );
}

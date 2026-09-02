import {
  browserFileSink,
  createTiffWriter,
  grayscaleJpegTags,
  type PlanPyramidJob,
  planPyramid,
} from "tiffwriter";
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

  for (let i = 0; i < intensityItems.length; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const item = intensityItems[i];
    let jpegImage = await exportJpegOmeTiffImage({
      directory,
      layoutPlanes: item.planes,
      image: item.image,
      channelSources: item.intensity.map((channel) => ({
        channel,
        planes: item.planes,
      })),
      channelGroups,
      fileName: intensityFileNames[i],
      transfer: exportTransferForImage(item.image, transfer),
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

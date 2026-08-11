import type { TiffPixelSource } from "@hms-dbmi/viv";
import { getImageSize } from "@hms-dbmi/viv";
import { effectiveChannelKind } from "@/lib/imaging/channelKind";
import type {
  ChannelGroup,
  Image,
  ImageChannel,
} from "@/lib/stores/documentSchema";
import type { JpegExportTransfer } from "./cubeRootEncoding";
import { folderLimitsForTransfer } from "./cubeRootEncoding";
import { encodeTileJpeg, jpegExportConcurrency } from "./jpegExportPool";
import { JPEG_PYRAMID_TILE_SIZE } from "./jpegPyramid";
import type { OmeLoaderEntry } from "./loaderEntries";
import {
  createFileWritableSink,
  type JpegTiffChannelPlan,
  StreamingJpegTiffWriter,
  tileCountForSize,
  tilesAcross,
  tilesDown,
} from "./streamingJpegTiff";

type LoaderPlane = TiffPixelSource<string[]>;

type OmeTiffExportJob = {
  channelIndex: number;
  levelIndex: number;
  tileIndex: number;
  x: number;
  y: number;
};

function omeTiffExportFileName(image: Image, used: Set<string>): string {
  const raw =
    image.basename?.replace(/\.(ome\.)?(tif|tiff)$/i, "") ||
    image.id ||
    "image";
  const base = raw.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "image";
  let name = `${base}.ome.tif`;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base}_${n}.ome.tif`;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Unique channelIds referenced by any channel group. */
function channelIdsFromGroups(channelGroups: ChannelGroup[]): Set<string> {
  const ids = new Set<string>();
  for (const g of channelGroups) {
    for (const row of g.channels) {
      ids.add(row.channelId);
    }
  }
  return ids;
}

/**
 * Intensity channels that appear in channel groups (JPEG-pyramid scope).
 * Stable TIFF IFD order: ascending source `index`.
 */
function groupIntensityChannelsForOmeExport(
  image: Image,
  channelGroups: ChannelGroup[],
): ImageChannel[] {
  const wanted = channelIdsFromGroups(channelGroups);
  if (wanted.size === 0) return [];
  return (image.channels ?? [])
    .filter((ch) => wanted.has(ch.id) && effectiveChannelKind(ch) === "channel")
    .slice()
    .sort((a, b) => a.index - b.index);
}

function assertNoSelectedMaskChannels(
  images: Image[],
  channelGroups: ChannelGroup[],
): void {
  const wanted = channelIdsFromGroups(channelGroups);
  for (const im of images) {
    const selectedMasks = (im.channels ?? []).filter(
      (ch) => wanted.has(ch.id) && effectiveChannelKind(ch) === "mask",
    );
    if (selectedMasks.length > 0) {
      throw new Error(
        `OME-TIFF export does not support mask/segmentation channels yet (${im.basename || im.id}). Remove masks from channel groups or export as JPEG folders.`,
      );
    }
  }
}

/** Remap exported channels to TIFF positions 0..k-1; point source at the relative file. */
function remappedImageForOmeTiffExport(
  image: Image,
  exportedChannels: ImageChannel[],
  fileName: string,
): Image {
  return {
    ...image,
    sizeC: exportedChannels.length,
    channels: exportedChannels.map((ch, i) => ({ ...ch, index: i })),
    source: { kind: "url", url: fileName },
  };
}

function planeLevels(loaderData: LoaderPlane[]): {
  width: number;
  height: number;
  tileSize: number;
}[] {
  return loaderData.map((plane) => {
    const { width, height } = getImageSize(plane);
    const tileSize =
      typeof plane.tileSize === "number" && plane.tileSize > 0
        ? plane.tileSize
        : JPEG_PYRAMID_TILE_SIZE;
    return { width, height, tileSize };
  });
}

function buildChannelPlans(
  levels: { width: number; height: number; tileSize: number }[],
  channelCount: number,
): JpegTiffChannelPlan[] {
  const levelPlans = levels.map((l) => ({
    width: l.width,
    height: l.height,
    tileWidth: l.tileSize,
    tileLength: l.tileSize,
  }));
  return Array.from({ length: channelCount }, () => ({
    levels: levelPlans,
  }));
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** OME Channel `Color` is signed big-endian RGBA packed into an int32. */
function omeColorInt(color: { r: number; g: number; b: number }): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint8(0, color.r & 0xff);
  view.setUint8(1, color.g & 0xff);
  view.setUint8(2, color.b & 0xff);
  view.setUint8(3, 255);
  return view.getInt32(0, false);
}

function optionalNumberAttr(name: string, value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return ` ${name}="${value}"`;
}

function optionalStringAttr(name: string, value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  return ` ${name}="${escapeXmlAttr(value)}"`;
}

type OmePixelsMeta = {
  PhysicalSizeX?: number;
  PhysicalSizeY?: number;
  PhysicalSizeZ?: number;
  PhysicalSizeXUnit?: string;
  PhysicalSizeYUnit?: string;
  PhysicalSizeZUnit?: string;
};

/**
 * Contrast for one exported channel: first matching group row (required —
 * OME export only writes group channels).
 */
function contrastLimitsForExportedChannel(
  channel: ImageChannel,
  channelGroups: ChannelGroup[],
): { lowerLimit: number; upperLimit: number } {
  for (const g of channelGroups) {
    for (const row of g.channels) {
      if (row.channelId !== channel.id) continue;
      return { lowerLimit: row.lowerLimit, upperLimit: row.upperLimit };
    }
  }
  throw new Error(`No channel-group contrast for channel ${channel.id}`);
}

/** Minimal OME-XML for Viv `loadOmeTiff` (ImageDescription.replace). */
function buildJpegOmeTiffXml(opts: {
  image: Image;
  channels: ReadonlyArray<ImageChannel>;
  width: number;
  height: number;
  fileName: string;
  pixels?: OmePixelsMeta | null;
}): string {
  const { image, channels, width, height, fileName, pixels } = opts;
  const imageName = image.basename || image.id || "image";
  const sizeC = channels.length;

  // Writer emits planar single-sample JPEG IFDs (one channel per IFD).
  const channelXml = channels
    .map((ch, i) => {
      const id = escapeXmlAttr(ch.id || `Channel:0:${i}`);
      const chName = escapeXmlAttr(ch.name?.trim() || `Channel ${i}`);
      const colorAttr =
        ch.color &&
        typeof ch.color.r === "number" &&
        typeof ch.color.g === "number" &&
        typeof ch.color.b === "number"
          ? ` Color="${omeColorInt({ r: ch.color.r, g: ch.color.g, b: ch.color.b })}"`
          : "";
      return `<Channel ID="${id}" Name="${chName}" SamplesPerPixel="1"${colorAttr}/>`;
    })
    .join("");

  const tiffDataXml = channels
    .map((_, i) => {
      const uuid = escapeXmlAttr(fileName);
      return (
        `<TiffData FirstC="${i}" FirstT="0" FirstZ="0" IFD="${i}" PlaneCount="1">` +
        `<UUID FileName="${uuid}">${uuid}</UUID>` +
        `</TiffData>`
      );
    })
    .join("");

  const physicalAttrs =
    optionalNumberAttr("PhysicalSizeX", pixels?.PhysicalSizeX) +
    optionalNumberAttr("PhysicalSizeY", pixels?.PhysicalSizeY) +
    optionalNumberAttr("PhysicalSizeZ", pixels?.PhysicalSizeZ) +
    optionalStringAttr("PhysicalSizeXUnit", pixels?.PhysicalSizeXUnit) +
    optionalStringAttr("PhysicalSizeYUnit", pixels?.PhysicalSizeYUnit) +
    optionalStringAttr("PhysicalSizeZUnit", pixels?.PhysicalSizeZUnit);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<OME xmlns="http://www.openmicroscopy.org/Schemas/OME/2016-06"` +
    ` xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` +
    ` xsi:schemaLocation="http://www.openmicroscopy.org/Schemas/OME/2016-06 http://www.openmicroscopy.org/Schemas/OME/2016-06/ome.xsd">` +
    `<Image ID="Image:0" Name="${escapeXmlAttr(imageName)}">` +
    `<Pixels ID="Pixels:0" DimensionOrder="XYZCT" Type="uint8"` +
    ` SizeX="${width}" SizeY="${height}" SizeZ="1" SizeC="${sizeC}" SizeT="1"` +
    ` SignificantBits="8" Interleaved="false" BigEndian="false"${physicalAttrs}>` +
    `${channelXml}${tiffDataXml}` +
    `</Pixels></Image></OME>`
  );
}

function buildJobs(
  levels: { width: number; height: number; tileSize: number }[],
  channelCount: number,
): OmeTiffExportJob[] {
  const jobs: OmeTiffExportJob[] = [];
  for (let c = 0; c < channelCount; c++) {
    for (let level = 0; level < levels.length; level++) {
      const { width, height, tileSize } = levels[level];
      const nx = tilesAcross(width, tileSize);
      const ny = tilesDown(height, tileSize);
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          jobs.push({
            channelIndex: c,
            levelIndex: level,
            tileIndex: y * nx + x,
            x,
            y,
          });
        }
      }
    }
  }
  return jobs;
}

type ExportJpegOmeTiffOpts = {
  directory: FileSystemDirectoryHandle;
  entry: OmeLoaderEntry;
  image: Image;
  channels: ImageChannel[];
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
    entry,
    image,
    channels,
    channelGroups,
    fileName,
    transfer,
    signal,
    onProgress,
  } = opts;
  if (channels.length === 0) {
    throw new Error(
      `No intensity channels to export for ${image.basename || image.id}`,
    );
  }
  const loaderData = entry.loader.data as LoaderPlane[] | undefined;
  if (!loaderData?.length) {
    throw new Error(
      `Loader has no pyramid levels for ${image.basename || image.id}`,
    );
  }

  const levels = planeLevels(loaderData);
  const channelPlans = buildChannelPlans(levels, channels.length);
  const jobs = buildJobs(levels, channels.length);
  const channelLimits = channels.map((ch) => {
    const lim = contrastLimitsForExportedChannel(ch, channelGroups);
    return folderLimitsForTransfer(transfer, lim.lowerLimit, lim.upperLimit);
  });

  const fh = await directory.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  const sink = createFileWritableSink(writable);

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

  const writer = new StreamingJpegTiffWriter(
    sink,
    {
      channels: channelPlans,
      omeXml: buildJpegOmeTiffXml({
        image,
        channels,
        width: levels[0].width,
        height: levels[0].height,
        fileName,
        pixels: entry.loader.metadata?.Pixels ?? null,
      }),
    },
    { onWriteError: failExport },
  );
  await writer.begin();

  const concurrency = Math.min(
    jpegExportConcurrency(),
    Math.max(1, jobs.length),
  );
  let next = 0;

  const runJob = async (job: OmeTiffExportJob) => {
    if (workSignal.aborted) return;
    const plane = loaderData[job.levelIndex];
    const tileSize = levels[job.levelIndex].tileSize;
    const channel = channels[job.channelIndex];
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
    // Enqueue only (backpressure); do not await the disk write queue.
    await writer.enqueueTile(
      job.channelIndex,
      job.levelIndex,
      job.tileIndex,
      jpeg,
    );
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
    if (exportFailed) {
      throw exportFailed;
    }
    if (signal.aborted || workSignal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    await writer.finish();
  } catch (e) {
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
  if (
    channelGroups.length === 0 ||
    !channelGroups.some((g) => g.channels.length > 0)
  ) {
    throw new Error(
      "Add a channel group with at least one channel before exporting OME-TIFF.",
    );
  }

  const candidateImages = omeLoaderEntries
    .map((e) => images.find((im) => im.id === e.sourceImageId))
    .filter((im): im is Image => !!im);
  assertNoSelectedMaskChannels(candidateImages, channelGroups);

  const usedNames = new Set<string>();
  const remappedImages: Image[] = [];

  let totalTiles = 0;
  const work: {
    entry: OmeLoaderEntry;
    image: Image;
    channels: ImageChannel[];
    fileName: string;
  }[] = [];

  for (const entry of omeLoaderEntries) {
    const image = images.find((im) => im.id === entry.sourceImageId);
    if (!image) continue;
    const channels = groupIntensityChannelsForOmeExport(image, channelGroups);
    if (channels.length === 0) continue;
    const loaderData = entry.loader.data as LoaderPlane[] | undefined;
    if (!loaderData?.length) continue;
    const levels = planeLevels(loaderData);
    for (const l of levels) {
      totalTiles +=
        tileCountForSize(l.width, l.height, l.tileSize, l.tileSize) *
        channels.length;
    }
    work.push({
      entry,
      image,
      channels,
      fileName: omeTiffExportFileName(image, usedNames),
    });
  }

  if (work.length === 0) {
    throw new Error(
      "No channel-group intensity channels available for OME-TIFF export.",
    );
  }

  let completed = 0;
  onProgress?.(0, totalTiles);

  for (const item of work) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    remappedImages.push(
      await exportJpegOmeTiffImage({
        directory,
        entry: item.entry,
        image: item.image,
        channels: item.channels,
        channelGroups,
        fileName: item.fileName,
        transfer,
        signal,
        onProgress: (delta) => {
          completed += delta;
          onProgress?.(completed, totalTiles);
        },
      }),
    );
  }

  const remappedById = new Map(
    remappedImages.map((image) => [image.id, image]),
  );
  return images.map((im) => remappedById.get(im.id) ?? im);
}

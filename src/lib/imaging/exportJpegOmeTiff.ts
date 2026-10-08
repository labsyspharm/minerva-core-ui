import {
  browserFileSink,
  createTiffWriter,
  grayscaleJpegTags,
  type PlanPyramidJob,
  planPyramid,
  tiffTag,
} from "tiffwriter";
import type {
  ChannelGroup,
  Image,
  ImageChannel,
} from "@/lib/stores/documentSchema";
import {
  isRgbDisplayImage,
  planarRgbSlotFromName,
  sourceDtypeMax,
} from "./channelKind";
import {
  exportTransferForImage,
  folderLimitsForTransfer,
  type JpegExportTransfer,
} from "./cubeRootEncoding";
import { readExportTile } from "./exportTileReader";
import {
  exportZlibOmeTiffImage,
  maskExportTileCount,
} from "./exportZlibOmeTiff";
import { encodeTileJpeg } from "./jpegExportPool";
import type { OmeLoaderEntry } from "./loaderEntries";
import {
  type BrightfieldTally,
  brightfieldSampleMax,
  brightfieldSampleOffsets,
  brightfieldTallyMatches,
  tallyBrightfieldSamples,
} from "./omeTiff";
import {
  allocateOmeTiffExportFileNames,
  buildOmeTiffXml,
  contrastLimitsForExportedChannel,
  exportPlaneLevels,
  groupIntensityChannelsForOmeExport,
  groupMaskChannelsForOmeExport,
  type LoaderPlane,
  loaderPlanesOrUndef,
  type OmePixelsMeta,
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
  /** Brightfield source channels in R,G,B order (or one packed channel). */
  rgb: ImageChannel[] | null;
  pixels?: OmePixelsMeta | null;
};

/** Brightfield: one IFD, 4:2:0 YCbCr JPEG tiles (Viv converts to RGB). Must match `encodeRgbJpeg`. */
const RGB_JPEG_TAGS = [
  tiffTag("BitsPerSample", "SHORT", [8, 8, 8]),
  tiffTag("Compression", "SHORT", 7),
  tiffTag("PhotometricInterpretation", "SHORT", 6),
  tiffTag("SamplesPerPixel", "SHORT", 3),
  tiffTag("PlanarConfiguration", "SHORT", 1),
  tiffTag(530, "SHORT", [2, 2]), // YCbCrSubSampling
  tiffTag("SampleFormat", "SHORT", [1, 1, 1]),
];

/**
 * Tiles in flight. Reads dominate (a network share takes ~20 ms each), so this
 * is well above the encoder pool size.
 */
const TILES_IN_FLIGHT = 32;
/** Encoded bytes queued for the (serial) TIFF writer before tiles wait on it. */
const MAX_PENDING_WRITE_BYTES = 64 * 1024 * 1024;

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

const HE_COLOR = { r: 204, g: 0, b: 255 };

/**
 * Brightfield sources all export as one interleaved RGB plane: a packed
 * channel as is, or a planar triplet in R,G,B order (by name, else index).
 */
function rgbExportChannels(
  image: Image,
  channels: ImageChannel[],
): ImageChannel[] | null {
  if (!isRgbDisplayImage(image)) return null;
  if (channels.length === 1 && channels[0].samples === 3) return channels;
  if (channels.length !== 3 || channels.some((c) => c.samples === 3)) {
    return null;
  }
  const slots = channels.map((c) => planarRgbSlotFromName(c.name));
  const named = !slots.includes(null) && new Set(slots).size === 3;
  return channels
    .map((c, i) => ({ c, key: named ? (slots[i] as number) : c.index }))
    .sort((a, b) => a.key - b.key)
    .map(({ c }) => c);
}

/** The single packed channel an RGB export writes. A planar triplet keeps the R id. */
function rgbFileChannel(rgb: ImageChannel[]): ImageChannel {
  const [first] = rgb;
  if (rgb.length === 1) return { ...first, sourceDataTypeId: "Uint8" };
  return {
    id: first.id,
    index: 0,
    name: "H&E",
    kind: "channel",
    samples: 3,
    sourceDataTypeId: "Uint8",
  };
}

/** Planar R/G/B group rows collapse to one H&E row on the kept (R) channel id. */
function collapsePlanarRgbRows(
  groups: ChannelGroup[],
  triplets: ImageChannel[][],
): ChannelGroup[] {
  if (triplets.length === 0) return groups;
  const keepOf = new Map(
    triplets.flatMap((rgb) => rgb.map((c) => [c.id, rgb[0].id] as const)),
  );
  return groups.map((group) => {
    const seen = new Set<string>();
    return {
      ...group,
      channels: group.channels.flatMap((row) => {
        const keep = keepOf.get(row.channelId);
        if (keep == null) return [row];
        if (seen.has(keep)) return [];
        seen.add(keep);
        return [
          {
            ...row,
            channelId: keep,
            color: HE_COLOR,
            lowerLimit: 0,
            upperLimit: 255,
          },
        ];
      }),
    };
  });
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
  // `rgbDisplay: false` is the user's "independent IF channels" choice.
  if (transfer !== "cube-root" || image.rgbDisplay === false) {
    return { transfer, image };
  }
  if (!(await planesLookBrightfield(planes, channels, signal))) {
    return { transfer, image };
  }
  return {
    transfer: "contrast",
    image: image.rgbDisplay === true ? image : { ...image, rgbDisplay: true },
  };
}

/**
 * Write one JPEG pyramidal OME-TIFF: grayscale IFD per channel (contrast or
 * cube-root uint8), or one interleaved RGB IFD for brightfield.
 */
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
    rgb,
    pixels,
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

  const levels = exportPlaneLevels(layoutPlanes);
  const fileChannels = rgb ? [rgbFileChannel(rgb)] : channels;
  const channelLimits = channels.map((ch) => {
    const lim = contrastLimitsForExportedChannel(ch, channelGroups);
    return folderLimitsForTransfer(transfer, lim.lowerLimit, lim.upperLimit);
  });
  // Packed RGB is drawn as a bitmap (no contrast), so only scale to 8-bit.
  const rgbLimits =
    rgb?.length === 1
      ? Array(3).fill([0, sourceDtypeMax(layoutPlanes[0].dtype)])
      : rgb?.map((ch) => {
          const lim = contrastLimitsForExportedChannel(ch, channelGroups);
          return [lim.lowerLimit, lim.upperLimit] as const;
        });

  const omeXml = buildOmeTiffXml({
    imageName: image.basename || image.id || "image",
    channels: fileChannels,
    width: levels[0].width,
    height: levels[0].height,
    fileName,
    pixelType: "uint8",
    significantBits: 8,
    samplesPerPixel: rgb ? 3 : 1,
    pixels,
  });

  const { layouts, jobs } = planPyramid({
    levels,
    channelCount: fileChannels.length,
    baseTags: rgb ? RGB_JPEG_TAGS : grayscaleJpegTags(),
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

  const concurrency = Math.min(TILES_IN_FLIGHT, Math.max(1, jobs.length));
  let next = 0;

  // The writer appends one tile at a time; tiles queue their bytes and move on.
  const pendingWrites = new Set<Promise<void>>();
  let pendingWriteBytes = 0;
  const queueWrite = async (job: PlanPyramidJob, bytes: Uint8Array) => {
    while (pendingWriteBytes >= MAX_PENDING_WRITE_BYTES) {
      await Promise.race(pendingWrites);
    }
    pendingWriteBytes += bytes.byteLength;
    const write = writer
      .writeSegment(job.address, bytes)
      .then(() => onProgress?.(1), failExport)
      .finally(() => {
        pendingWriteBytes -= bytes.byteLength;
        pendingWrites.delete(write);
      });
    pendingWrites.add(write);
  };

  const runJob = async (job: PlanPyramidJob) => {
    if (workSignal.aborted) return;
    const source = channelSources[job.channelIndex];
    const levelIndex = Math.min(job.levelIndex, source.planes.length - 1);
    const plane = source.planes[levelIndex];
    const tileSize = levels[job.levelIndex].tileSize;
    const limits = channelLimits[job.channelIndex];
    const readTile = (channel: ImageChannel) =>
      readExportTile(
        plane,
        tileSize,
        { t: 0, z: 0, c: channel.index },
        job.x,
        job.y,
        workSignal,
      );
    const tiles = await Promise.all((rgb ?? [source.channel]).map(readTile));
    if (workSignal.aborted) return;
    const { width, height } = tiles[0];
    const data =
      tiles.length === 3
        ? interleavePlanar(tiles.map((t) => t.data))
        : tiles[0].data;
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
      rgbLimits,
    });
    if (workSignal.aborted) return;
    await queueWrite(job, new Uint8Array(jpeg));
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
    await Promise.all(pendingWrites);
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

  return remappedImageForOmeTiffExport(
    rgb ? { ...image, rgbDisplay: true } : image,
    fileChannels,
    fileName,
  );
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

/** Planar brightfield collapses to one packed channel, so groups come back too. */
export async function exportJpegOmeTiffStory(
  opts: ExportJpegOmeTiffStoryOpts,
): Promise<{ images: Image[]; channelGroups: ChannelGroup[] }> {
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

  const decisions: {
    transfer: JpegExportTransfer;
    image: Image;
    rgb: ImageChannel[] | null;
  }[] = [];
  let totalTiles = 0;
  for (const item of intensityItems) {
    const decided = await transferForBrightfield(
      item.image,
      transfer,
      item.planes,
      item.intensity,
      signal,
    );
    const rgb = rgbExportChannels(decided.image, item.intensity);
    decisions.push({ ...decided, rgb });
    totalTiles += tileCountForLevels(
      exportPlaneLevels(item.planes),
      rgb ? 1 : item.intensity.length,
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
    const decided = decisions[i];
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
      rgb: decided.rgb,
      pixels: item.entry.loader.metadata?.Pixels,
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

  return {
    images: stitchOmeTiffExportImages(
      images,
      remappedById,
      insertedAfter,
      new Set(),
    ),
    channelGroups: collapsePlanarRgbRows(
      channelGroups,
      decisions.flatMap((d) => (d.rgb?.length === 3 ? [d.rgb] : [])),
    ),
  };
}

import type { TiffPixelSource } from "@hms-dbmi/viv";
import { getImageSize } from "@hms-dbmi/viv";
import { effectiveChannelKind } from "@/lib/imaging/channelKind";
import type { Image } from "@/lib/stores/documentSchema";
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

/** Intensity channels only; masks are not JPEG-safe. */
function intensityChannelsForOmeExport(image: Image): Image["channels"] {
  return (image.channels ?? []).filter(
    (ch) => effectiveChannelKind(ch) === "channel",
  );
}

function assertNoMaskChannelsForOmeExport(images: Image[]): void {
  for (const im of images) {
    const masks = (im.channels ?? []).filter(
      (ch) => effectiveChannelKind(ch) === "mask",
    );
    if (masks.length > 0) {
      throw new Error(
        `OME-TIFF export does not support mask/segmentation channels yet (${im.basename || im.id}). Remove masks or export as JPEG folders.`,
      );
    }
  }
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

export type ExportJpegOmeTiffImageResult = {
  fileName: string;
  sourceImageId: string;
};

type ExportJpegOmeTiffOpts = {
  directory: FileSystemDirectoryHandle;
  entry: OmeLoaderEntry;
  image: Image;
  fileName: string;
  signal: AbortSignal;
  onProgress?: (deltaCompleted: number) => void;
};

/** Write one multi-channel JPEG pyramidal OME-TIFF (cube-root uint8 codes). */
async function exportJpegOmeTiffImage(
  opts: ExportJpegOmeTiffOpts,
): Promise<ExportJpegOmeTiffImageResult> {
  const { directory, entry, image, fileName, signal, onProgress } = opts;
  const channels = intensityChannelsForOmeExport(image);
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

  const fh = await directory.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  const sink = createFileWritableSink(writable);
  const writer = new StreamingJpegTiffWriter(sink, {
    channels: channelPlans,
  });
  await writer.begin();

  const concurrency = Math.min(
    jpegExportConcurrency(),
    Math.max(1, jobs.length),
  );
  let next = 0;
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

  const runJob = async (job: OmeTiffExportJob) => {
    if (workSignal.aborted) return;
    const plane = loaderData[job.levelIndex];
    const tileSize = levels[job.levelIndex].tileSize;
    const channel = channels[job.channelIndex];
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
      lowerLimit: 0,
      upperLimit: 65535,
      transfer: "cube-root",
      padTileWidth: tileSize,
      padTileLength: tileSize,
    });
    if (workSignal.aborted) return;
    await writer.writeTile(
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

  return { fileName, sourceImageId: image.id };
}

export type ExportJpegOmeTiffStoryOpts = {
  directory: FileSystemDirectoryHandle;
  omeLoaderEntries: OmeLoaderEntry[];
  images: Image[];
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
};

export async function exportJpegOmeTiffStory(
  opts: ExportJpegOmeTiffStoryOpts,
): Promise<ExportJpegOmeTiffImageResult[]> {
  const { directory, omeLoaderEntries, images, signal, onProgress } = opts;
  if (omeLoaderEntries.length === 0) {
    throw new Error(
      "OME-TIFF export needs an OME or DICOM source image loaded.",
    );
  }
  assertNoMaskChannelsForOmeExport(
    omeLoaderEntries
      .map((e) => images.find((im) => im.id === e.sourceImageId))
      .filter((im): im is Image => !!im),
  );

  const usedNames = new Set<string>();
  const results: ExportJpegOmeTiffImageResult[] = [];

  // Precompute total tiles for progress.
  let totalTiles = 0;
  const work: {
    entry: OmeLoaderEntry;
    image: Image;
    fileName: string;
  }[] = [];

  for (const entry of omeLoaderEntries) {
    const image = images.find((im) => im.id === entry.sourceImageId);
    if (!image) continue;
    const channels = intensityChannelsForOmeExport(image);
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
      fileName: omeTiffExportFileName(image, usedNames),
    });
  }

  if (work.length === 0) {
    throw new Error("No intensity images available for OME-TIFF export.");
  }

  let completed = 0;
  onProgress?.(0, totalTiles);

  for (const item of work) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const result = await exportJpegOmeTiffImage({
      directory,
      entry: item.entry,
      image: item.image,
      fileName: item.fileName,
      signal,
      onProgress: (delta) => {
        completed += delta;
        onProgress?.(completed, totalTiles);
      },
    });
    results.push(result);
  }

  return results;
}

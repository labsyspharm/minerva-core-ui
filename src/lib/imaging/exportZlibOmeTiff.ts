import { getImageSize } from "@hms-dbmi/viv";
import {
  browserFileSink,
  createTiffWriter,
  grayscaleDeflateTags,
  type PlanPyramidJob,
  planPyramid,
  type RandomAccessSink,
} from "tiffwriter";
import type { Image, ImageChannel } from "@/lib/stores/documentSchema";
import { JPEG_PYRAMID_TILE_SIZE } from "./jpegPyramid";
import type { OmeLoaderEntry } from "./loaderEntries";
import type { LoaderPlane } from "./loaderTypes";
import {
  assertUnsignedLabelDtype,
  bitsPerSampleFromDtype,
  buildOmeTiffXml,
  type LabelDtype,
  type OmeExportLevelSize,
  type OmePixelsMeta,
  omeTypeFromDtype,
  remappedImageForOmeTiffExport,
  tileCountForLevels,
} from "./omeTiffExport";

export type { LabelDtype };
export type LabelArray = Uint8Array | Uint16Array | Uint32Array;

const MASK_EXPORT_CONCURRENCY = Math.min(
  8,
  globalThis?.navigator?.hardwareConcurrency ?? 4,
);

export { assertUnsignedLabelDtype, bitsPerSampleFromDtype, omeTypeFromDtype };

function labelArrayCtor(dtype: LabelDtype): new (n: number) => LabelArray {
  if (dtype === "Uint8") return Uint8Array;
  if (dtype === "Uint16") return Uint16Array;
  return Uint32Array;
}

export function toLabelArray(
  data: ArrayLike<number>,
  dtype: LabelDtype,
): LabelArray {
  const Ctor = labelArrayCtor(dtype);
  if (data instanceof Ctor) return data;
  const out = new Ctor(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i];
  return out;
}

/** Tile size: native if the source is tiled; otherwise 1024. */
export function maskExportTileSize(
  width: number,
  height: number,
  planeTileSize: number | undefined,
): number {
  const maxDim = Math.max(width, height, 1);
  const ts = planeTileSize ?? 0;
  if (ts > 0 && ts < maxDim) return ts;
  if (ts > 0 && ts <= JPEG_PYRAMID_TILE_SIZE) return ts;
  return JPEG_PYRAMID_TILE_SIZE;
}

/** Dyadic reductions down to one tile (same stop as {@link jpegPyramidLevels}). */
export function maskPyramidLevelSizes(
  width: number,
  height: number,
  tileSize: number,
): OmeExportLevelSize[] {
  const levels: OmeExportLevelSize[] = [{ width, height, tileSize }];
  let w = width;
  let h = height;
  let n = 1;
  while ((w > tileSize || h > tileSize) && n < 32) {
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
    levels.push({ width: w, height: h, tileSize });
    n += 1;
  }
  return levels;
}

export function nearestNeighborDownsample(
  src: LabelArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): LabelArray {
  const Ctor = src.constructor as new (n: number) => LabelArray;
  const dst = new Ctor(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    const srcY = Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
      dst[y * dstW + x] = src[srcY * srcW + srcX];
    }
  }
  return dst;
}

export function padLabelTile(
  src: LabelArray,
  width: number,
  height: number,
  tileWidth: number,
  tileHeight: number,
): LabelArray {
  if (
    width === tileWidth &&
    height === tileHeight &&
    src.length === tileWidth * tileHeight
  ) {
    return src;
  }
  const Ctor = src.constructor as new (n: number) => LabelArray;
  const dst = new Ctor(tileWidth * tileHeight);
  const copyW = Math.min(width, tileWidth);
  const copyH = Math.min(height, tileHeight);
  for (let y = 0; y < copyH; y++) {
    const srcStart = y * width;
    (dst as Uint8Array).set(
      (src as Uint8Array).subarray(srcStart, srcStart + copyW),
      y * tileWidth,
    );
  }
  return dst;
}

export function extractLabelTile(
  plane: LabelArray,
  planeW: number,
  planeH: number,
  tileX: number,
  tileY: number,
  tileSize: number,
): { data: LabelArray; width: number; height: number } {
  const x0 = tileX * tileSize;
  const y0 = tileY * tileSize;
  const width = Math.max(0, Math.min(tileSize, planeW - x0));
  const height = Math.max(0, Math.min(tileSize, planeH - y0));
  const Ctor = plane.constructor as new (n: number) => LabelArray;
  const data = new Ctor(width * height);
  for (let y = 0; y < height; y++) {
    const srcStart = (y0 + y) * planeW + x0;
    (data as Uint8Array).set(
      (plane as Uint8Array).subarray(srcStart, srcStart + width),
      y * width,
    );
  }
  return { data, width, height };
}

export function buildMaskPyramidRasters(
  full: LabelArray,
  levels: readonly OmeExportLevelSize[],
): LabelArray[] {
  const rasters: LabelArray[] = [full];
  for (let i = 1; i < levels.length; i++) {
    rasters.push(
      nearestNeighborDownsample(
        rasters[i - 1],
        levels[i - 1].width,
        levels[i - 1].height,
        levels[i].width,
        levels[i].height,
      ),
    );
  }
  return rasters;
}

export function labelTileBytesLE(data: LabelArray): Uint8Array {
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

/** zlib-wrapped deflate (TIFF Compression 8). */
export async function zlibDeflateBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([copyToArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function planMaskExportLevels(loaderData: LoaderPlane[]): {
  levels: OmeExportLevelSize[];
  useLoaderTiles: boolean;
} {
  const plane0 = loaderData[0];
  const { width, height } = getImageSize(plane0);
  const tileSize = maskExportTileSize(width, height, plane0.tileSize);
  if (loaderData.length > 1) {
    return {
      levels: loaderData.map((plane) => {
        const size = getImageSize(plane);
        return {
          width: size.width,
          height: size.height,
          tileSize: maskExportTileSize(size.width, size.height, plane.tileSize),
        };
      }),
      useLoaderTiles: true,
    };
  }
  const levels = maskPyramidLevelSizes(width, height, tileSize);
  return { levels, useLoaderTiles: levels.length === 1 };
}

type WriteZlibOmeTiffOpts = {
  sink: RandomAccessSink;
  closeSink?: boolean;
  image: Image;
  channels: ImageChannel[];
  fileName: string;
  pixels?: OmePixelsMeta | null;
  dtype: LabelDtype;
  levels: readonly OmeExportLevelSize[];
  readTile: (
    job: PlanPyramidJob,
  ) => Promise<{ data: LabelArray; width: number; height: number }>;
  signal: AbortSignal;
  onProgress?: (deltaCompleted: number) => void;
};

export async function writeZlibOmeTiff(
  opts: WriteZlibOmeTiffOpts,
): Promise<void> {
  const {
    sink,
    closeSink,
    image,
    channels,
    fileName,
    pixels,
    dtype,
    levels,
    readTile,
    signal,
    onProgress,
  } = opts;
  if (channels.length === 0) {
    throw new Error(
      `No mask channels to export for ${image.basename || image.id}`,
    );
  }
  const bits = bitsPerSampleFromDtype(dtype);
  const omeXml = buildOmeTiffXml({
    imageName: image.basename || image.id || "image",
    channels,
    width: levels[0].width,
    height: levels[0].height,
    fileName,
    pixelType: omeTypeFromDtype(dtype),
    significantBits: bits,
    pixels,
  });
  const { layouts, jobs } = planPyramid({
    levels: [...levels],
    channelCount: channels.length,
    baseTags: grayscaleDeflateTags(bits),
    imageDescription: omeXml,
  });

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
          : new Error(String(e ?? "Mask OME-TIFF export failed"));
    }
    localAbort.abort();
  };

  let writer: Awaited<ReturnType<typeof createTiffWriter>>;
  try {
    writer = await createTiffWriter({
      sink,
      closeSink,
      signal: workSignal,
      images: layouts,
    });
  } catch (e) {
    signal.removeEventListener("abort", onOuterAbort);
    throw e;
  }

  const concurrency = Math.min(
    MASK_EXPORT_CONCURRENCY,
    Math.max(1, jobs.length),
  );
  let next = 0;

  const runJob = async (job: PlanPyramidJob) => {
    if (workSignal.aborted) return;
    const tile = await readTile(job);
    if (workSignal.aborted) return;
    const tileSize = levels[job.levelIndex].tileSize;
    const padded = padLabelTile(
      tile.data,
      tile.width,
      tile.height,
      tileSize,
      tileSize,
    );
    const deflated = await zlibDeflateBytes(labelTileBytesLE(padded));
    if (workSignal.aborted) return;
    await writer.writeSegment(job.address, deflated);
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
    throw e;
  } finally {
    signal.removeEventListener("abort", onOuterAbort);
  }
}

type ExportZlibOmeTiffOpts = {
  directory: FileSystemDirectoryHandle;
  entry: OmeLoaderEntry;
  image: Image;
  channels: ImageChannel[];
  fileName: string;
  signal: AbortSignal;
  onProgress?: (deltaCompleted: number) => void;
};

function loaderPlanes(entry: OmeLoaderEntry): LoaderPlane[] {
  const data = entry.loader.data as LoaderPlane[] | undefined;
  if (!data?.length) {
    throw new Error(`Loader has no pyramid levels for ${entry.sourceImageId}`);
  }
  return data;
}

async function rastersForGeneratedPyramid(
  plane: LoaderPlane,
  channels: ImageChannel[],
  levels: readonly OmeExportLevelSize[],
  dtype: LabelDtype,
  signal: AbortSignal,
): Promise<LabelArray[][]> {
  const perChannel: LabelArray[][] = [];
  for (const channel of channels) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const raster = await plane.getRaster({
      selection: { t: 0, z: 0, c: channel.index },
      signal,
    });
    const full = toLabelArray(raster.data as ArrayLike<number>, dtype);
    perChannel.push(buildMaskPyramidRasters(full, levels));
  }
  return perChannel;
}

/** Write one multi-channel zlib pyramidal OME-TIFF of integer labels. */
export async function exportZlibOmeTiffImage(
  opts: ExportZlibOmeTiffOpts,
): Promise<Image> {
  const { directory, entry, image, channels, fileName, signal, onProgress } =
    opts;
  if (channels.length === 0) {
    throw new Error(
      `No mask channels to export for ${image.basename || image.id}`,
    );
  }
  const loaderData = loaderPlanes(entry);
  const dtype = assertUnsignedLabelDtype(loaderData[0].dtype);
  const { levels, useLoaderTiles } = planMaskExportLevels(loaderData);

  let generated: LabelArray[][] | null = null;
  if (!useLoaderTiles) {
    generated = await rastersForGeneratedPyramid(
      loaderData[0],
      channels,
      levels,
      dtype,
      signal,
    );
  }

  const fh = await directory.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();

  try {
    await writeZlibOmeTiff({
      sink: browserFileSink(writable),
      image,
      channels,
      fileName,
      pixels: entry.loader.metadata?.Pixels ?? null,
      dtype,
      levels,
      signal,
      onProgress,
      readTile: async (job) => {
        if (generated) {
          const level = levels[job.levelIndex];
          return extractLabelTile(
            generated[job.channelIndex][job.levelIndex],
            level.width,
            level.height,
            job.x,
            job.y,
            level.tileSize,
          );
        }
        const plane = loaderData[job.levelIndex];
        const channel = channels[job.channelIndex];
        const tile = await plane.getTile({
          selection: { t: 0, z: 0, c: channel.index },
          x: job.x,
          y: job.y,
          signal,
        });
        return {
          data: toLabelArray(tile.data as ArrayLike<number>, dtype),
          width: tile.width,
          height: tile.height,
        };
      },
    });
  } catch (e) {
    try {
      await writable.abort?.();
    } catch {
      /* ignore */
    }
    throw e;
  }

  return remappedImageForOmeTiffExport(
    { ...image, contentRole: "segmentation" },
    channels,
    fileName,
  );
}

export function maskExportTileCount(
  entry: OmeLoaderEntry,
  channelCount: number,
): number {
  const loaderData = entry.loader.data as LoaderPlane[] | undefined;
  if (!loaderData?.length || channelCount <= 0) return 0;
  return tileCountForLevels(
    planMaskExportLevels(loaderData).levels,
    channelCount,
  );
}

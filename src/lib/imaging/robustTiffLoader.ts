import { loadOmeTiff } from "@hms-dbmi/viv";
import { fromBlob } from "geotiff";
import type { Loader } from "./viv";
import type { PoolClass } from "./workers/Pool";

type GeoImage = Awaited<
  ReturnType<Awaited<ReturnType<typeof fromBlob>>["getImage"]>
>;

/**
 * "No image at index N" is thrown by geotiff when Viv's OME-XML traversal
 * walks past the last real IFD. Common with mask OME-TIFFs whose XML
 * declares phantom `<Image>` entries (overviews, thumbnails, or buggy writers).
 */
function isMissingIfdError(err: unknown): boolean {
  if (err instanceof Error) {
    return /No image at index/i.test(err.message);
  }
  return false;
}

const VIV_DTYPE_BY_KEY: Record<string, string> = {
  Uint8: "Uint8",
  Uint16: "Uint16",
  Uint32: "Uint32",
  Int8: "Int8",
  Int16: "Int16",
  Int32: "Int32",
  Float32: "Float32",
  Float64: "Float64",
};

function dtypeFromImage(image: GeoImage): string {
  const dir = (
    image as unknown as {
      fileDirectory: { SampleFormat?: number[]; BitsPerSample: number[] };
    }
  ).fileDirectory;
  const format = dir.SampleFormat?.[0] ?? 1;
  const bps = dir.BitsPerSample?.[0] ?? 8;
  switch (format) {
    case 3:
      return bps <= 32 ? VIV_DTYPE_BY_KEY.Float32 : VIV_DTYPE_BY_KEY.Float64;
    case 2:
      if (bps <= 8) return VIV_DTYPE_BY_KEY.Int8;
      if (bps <= 16) return VIV_DTYPE_BY_KEY.Int16;
      return VIV_DTYPE_BY_KEY.Int32;
    default:
      if (bps <= 8) return VIV_DTYPE_BY_KEY.Uint8;
      if (bps <= 16) return VIV_DTYPE_BY_KEY.Uint16;
      return VIV_DTYPE_BY_KEY.Uint32;
  }
}

/**
 * Minimal single-IFD GeoTIFF → Viv-shaped `Loader` (one channel, one z, one t,
 * one resolution level). Sufficient for mask consumers (TileLayer with
 * `getTile`) and for biomarker fallback when OME metadata is broken.
 */
async function loadRawTiffAsLoader(
  file: File,
  channelHint?: string,
): Promise<Loader> {
  const tiff = await fromBlob(file);
  const image = await tiff.getImage(0);
  const width = image.getWidth();
  const height = image.getHeight();
  const tileWidth = image.getTileWidth() || 256;
  const tileHeight = image.getTileHeight() || tileWidth;
  const tileSize = Math.min(tileWidth, tileHeight) || 256;
  const dtype = dtypeFromImage(image);

  const labels: ["t", "c", "z", "y", "x"] = ["t", "c", "z", "y", "x"];
  const shape = [1, 1, 1, height, width];

  const level = {
    dtype,
    tileSize,
    shape,
    labels,
    onTileError(e: Error) {
      console.error("[gating raw mask] tile error:", e);
    },
    async getTile({
      x,
      y,
      signal,
    }: {
      x: number;
      y: number;
      selection?: { t: number; z: number; c: number };
      signal?: AbortSignal;
    }) {
      const x0 = x * tileSize;
      const y0 = y * tileSize;
      const x1 = Math.min(width, x0 + tileSize);
      const y1 = Math.min(height, y0 + tileSize);
      const w = x1 - x0;
      const h = y1 - y0;
      const raster = (await image.readRasters({
        window: [x0, y0, x1, y1],
        interleave: false,
        signal,
      } as unknown as Parameters<typeof image.readRasters>[0])) as
        | ArrayLike<number>
        | ArrayLike<number>[];
      const data = Array.isArray(raster) ? raster[0] : raster;
      return { data, width: w, height: h } as unknown as ReturnType<
        typeof image.readRasters
      > extends Promise<infer R>
        ? R
        : never;
    },
    async getRaster({
      signal,
    }: {
      selection?: { t: number; z: number; c: number };
      signal?: AbortSignal;
    }) {
      const raster = (await image.readRasters({
        interleave: false,
        signal,
      } as unknown as Parameters<typeof image.readRasters>[0])) as
        | ArrayLike<number>
        | ArrayLike<number>[];
      const data = Array.isArray(raster) ? raster[0] : raster;
      return { data, width, height } as never;
    },
  };

  const metadata = {
    ID: "Image:0",
    AquisitionDate: "",
    Description: "",
    Pixels: {
      Channels: [
        {
          ID: "Channel:0:0",
          Name: channelHint ?? "Channel 0",
          SamplesPerPixel: 1,
        },
      ],
      ID: "Pixels:0",
      DimensionOrder: "XYZCT",
      Type: dtype.toLowerCase(),
      SizeT: 1,
      SizeC: 1,
      SizeZ: 1,
      SizeY: height,
      SizeX: width,
      PhysicalSizeX: 1,
      PhysicalSizeY: 1,
      PhysicalSizeXUnit: "px",
      PhysicalSizeYUnit: "px",
      PhysicalSizeZUnit: "px",
      BigEndian: false,
      TiffData: [],
    },
    ROIs: [],
  };

  return {
    data: [level],
    metadata,
  } as unknown as Loader;
}

export type RobustLoaderOpts = {
  file: File;
  pool?: PoolClass;
  /** Optional channel name to embed when we fall back (e.g. "Mask"). */
  fallbackChannelName?: string;
  /**
   * If true, swallow OME-XML traversal failures and silently fall back to the
   * raw single-IFD loader. Defaults to true.
   */
  allowFallback?: boolean;
};

/**
 * Wraps `loadOmeTiff` with a raw-geotiff fallback when the OME metadata is
 * malformed (declares more `<Image>` entries than the file actually contains).
 */
export async function loadRobustOmeTiff({
  file,
  pool,
  fallbackChannelName,
  allowFallback = true,
}: RobustLoaderOpts): Promise<Loader> {
  try {
    if (pool) {
      return (await loadOmeTiff(file, { pool: pool as never })) as Loader;
    }
    return (await loadOmeTiff(file)) as Loader;
  } catch (err) {
    if (!allowFallback || !isMissingIfdError(err)) {
      throw err;
    }
    console.warn(
      "[gating] OME-TIFF metadata declared more images than the file contains; " +
        "falling back to a single-IFD loader.",
      err,
    );
    return loadRawTiffAsLoader(file, fallbackChannelName);
  }
}

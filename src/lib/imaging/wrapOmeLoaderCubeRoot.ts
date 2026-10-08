import { SIGNAL_ABORTED } from "@hms-dbmi/viv";
import type { GeoTIFFImage } from "geotiff";
import {
  decodeCubeRootU8ToU16,
  type JpegExportTransfer,
} from "./cubeRootEncoding";
import type { HasTile, LoaderPlane } from "./loaderTypes";
import type { Loader } from "./viv";

type TileArgs = Parameters<LoaderPlane["getTile"]>[0];

const CUBE_ROOT_U8_TO_U16 = Uint16Array.from({ length: 256 }, (_, b) =>
  decodeCubeRootU8ToU16(b),
);

const CONTRAST_U8_TO_U16 = Uint16Array.from({ length: 256 }, (_, b) => b << 8);

/** Viv `TiffPixelSource` internals read by the fast path; absent on other planes. */
type TiffPlaneInternals = {
  tileSize: number;
  pool?: unknown;
  _indexer?: (selection: TileArgs["selection"]) => Promise<GeoTIFFImage>;
  _getTileExtent?: (x: number, y: number) => { width: number; height: number };
};

function expandThroughLut(
  data: ArrayLike<number>,
  lut: Uint16Array,
): Uint16Array {
  const out = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = lut[data[i] & 0xff];
  }
  return out;
}

/**
 * Read one decoded 8-bit tile and widen it through `lut`. Skips geotiff's
 * `readRasters`, which copies every pixel through a DataView on the main
 * thread. `null` means use Viv's path (other plane types, no pool, or a
 * probe that throws — missing `BitsPerSample` is one of those).
 */
async function readTileThroughLut(
  plane: LoaderPlane,
  args: TileArgs,
  lut: Uint16Array,
): Promise<HasTile | null> {
  const source = plane as unknown as TiffPlaneInternals;
  // geotiff's `readRasters` does `pool || getDecoder(...)`. No pool here.
  if (!source._indexer || !source._getTileExtent || !source.pool) return null;
  try {
    const image = await source._indexer(args.selection);
    if (
      !image.isTiled ||
      image.getTileWidth() !== source.tileSize ||
      image.getTileHeight() !== source.tileSize ||
      image.getSamplesPerPixel() !== 1 ||
      image.getBitsPerSample(0) !== 8
    ) {
      return null;
    }
    const { width, height } = source._getTileExtent(args.x, args.y);
    // Like Viv's `_readRasters`, do not hand `signal` to geotiff (shared blocks).
    const tile = await image.getTileOrStrip(
      args.x,
      args.y,
      0,
      source.pool as Parameters<GeoTIFFImage["getTileOrStrip"]>[3],
    );
    if (args.signal?.aborted) throw SIGNAL_ABORTED;
    const src = new Uint8Array(tile.data);
    const stride = source.tileSize;
    const out = new Uint16Array(width * height);
    for (let row = 0; row < height; row++) {
      const from = row * stride;
      const to = row * width;
      for (let col = 0; col < width; col++) {
        out[to + col] = lut[src[from + col]];
      }
    }
    return { data: out, width, height };
  } catch (err) {
    if (err === SIGNAL_ABORTED) throw err;
    return null;
  }
}

/**
 * Wrap Viv OME planes so JPEG-decoded uint8 tiles become uint16 for display.
 * Cube-root: inverse transfer. Contrast: `byte << 8` (baked window already applied).
 */
export function wrapOmeLoaderJpegExport(
  loader: Loader,
  transfer: JpegExportTransfer,
): Loader {
  const lut =
    transfer === "cube-root" ? CUBE_ROOT_U8_TO_U16 : CONTRAST_U8_TO_U16;
  const data = loader.data?.map((plane) => {
    const getTile = plane.getTile?.bind(plane);
    if (!getTile) return plane;
    const wrapped: LoaderPlane = {
      ...plane,
      dtype: "Uint16",
      getTile: async (args) => {
        const fast = await readTileThroughLut(plane, args, lut);
        if (fast) return fast;
        const tile = await getTile(args);
        return {
          ...tile,
          data: expandThroughLut(tile.data as ArrayLike<number>, lut),
        };
      },
    };
    return wrapped;
  });
  return data ? { ...loader, data } : loader;
}

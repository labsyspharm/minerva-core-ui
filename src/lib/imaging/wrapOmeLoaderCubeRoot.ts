import { SIGNAL_ABORTED } from "@hms-dbmi/viv";
import type { GeoTIFFImage } from "geotiff";
import { type JpegExportTransfer, u8ToU16Lut } from "./cubeRootEncoding";
import { expandThroughLut } from "./expandThroughLut";
import type { HasTile, LoaderPlane } from "./loaderTypes";
import { OmeDecodePool } from "./omeDecodePool";
import type { Loader } from "./viv";

type TileArgs = Parameters<LoaderPlane["getTile"]>[0];

/** Viv `TiffPixelSource` internals read by the fast path; absent on other planes. */
type TiffPlaneInternals = {
  tileSize: number;
  pool?: unknown;
  _indexer?: (selection: TileArgs["selection"]) => Promise<GeoTIFFImage>;
  _getTileExtent?: (x: number, y: number) => { width: number; height: number };
};

/** Cut a full `stride`² tile to an edge tile's `width` x `height`. */
function cropTile(
  full: Uint16Array<ArrayBuffer>,
  stride: number,
  width: number,
  height: number,
): Uint16Array<ArrayBuffer> {
  if (width === stride && height === stride) return full;
  const out = new Uint16Array(width * height);
  for (let row = 0; row < height; row++) {
    out.set(full.subarray(row * stride, row * stride + width), row * width);
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
  const pool = source.pool;
  if (
    !source._indexer ||
    !source._getTileExtent ||
    !(pool instanceof OmeDecodePool)
  ) {
    return null;
  }
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
    const stride = source.tileSize;
    // geotiff fetches the bytes, then calls this. Block fetches are shared
    // between tiles, so they always finish; a tile deck has dropped by then
    // skips its decode.
    const decoder = {
      decode: (fileDirectory: unknown, buffer: ArrayBuffer) => {
        if (args.signal?.aborted) throw SIGNAL_ABORTED;
        return pool.decodeWidened(fileDirectory, buffer, lut);
      },
    };
    const tile = await image.getTileOrStrip(
      args.x,
      args.y,
      0,
      decoder as Parameters<GeoTIFFImage["getTileOrStrip"]>[3],
    );
    if (args.signal?.aborted) throw SIGNAL_ABORTED;
    // The size says which it is: the worker returns 16-bit, while an empty
    // tile (no decode) comes back as geotiff's 8-bit fill.
    const bytes = tile.data as ArrayBuffer;
    const full =
      bytes.byteLength === stride * stride * 2
        ? new Uint16Array(bytes)
        : expandThroughLut(new Uint8Array(bytes), lut);
    return {
      data: cropTile(full, stride, width, height),
      width,
      height,
    };
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
  const lut = u8ToU16Lut(transfer);
  const data = loader.data?.map((plane) => {
    const getTile = plane.getTile?.bind(plane);
    if (!getTile) return plane;
    const wrapped: LoaderPlane = {
      ...plane,
      dtype: "Uint16",
      // A prototype method, so the spread drops it; Viv falls back to it.
      onTileError: plane.onTileError?.bind(plane),
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

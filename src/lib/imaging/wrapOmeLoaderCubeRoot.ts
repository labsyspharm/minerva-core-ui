import { SIGNAL_ABORTED } from "@hms-dbmi/viv";
import type { GeoTIFFImage } from "geotiff";
import { GEOTIFF_ICC_PROFILE_KEY, iccGrayU8ToU16Lut } from "@/lib/icc";
import { expandThroughLut } from "./expandThroughLut";
import type { HasTile, LoaderPlane } from "./loaderTypes";
import { OmeDecodePool } from "./omeDecodePool";
import { uncachedTiffImage } from "./uncachedTiff";
import type { Loader } from "./viv";

type TileArgs = Parameters<LoaderPlane["getTile"]>[0];
type WindowArgs = Parameters<NonNullable<LoaderPlane["readWindow"]>>[0];

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
 * probe that throws — missing `BitsPerSample` is one of those). `uncached`
 * reads around the source's block cache (see `uncachedTiffImage`).
 */
async function readTileThroughLut(
  plane: LoaderPlane,
  args: TileArgs,
  lut: Uint16Array,
  uncached = false,
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
    const indexed = await source._indexer(args.selection);
    const image = uncached ? uncachedTiffImage(indexed) : indexed;
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
 * An export's window, read around the source's block cache: a hosted file
 * read tile by tile through Viv's unlimited cache ends up held whole. A
 * window that is one tile goes through the widening decoder; any other is
 * read and widened here.
 */
async function readWindowThroughLut(
  plane: LoaderPlane,
  { selection, window, signal }: WindowArgs,
  lut: Uint16Array,
): Promise<HasTile> {
  const [x0, y0, x1, y1] = window;
  const width = x1 - x0;
  const height = y1 - y0;
  const size = plane.tileSize;
  if (x0 % size === 0 && y0 % size === 0 && width <= size && height <= size) {
    const args = { selection, x: x0 / size, y: y0 / size, signal };
    const tile = await readTileThroughLut(plane, args, lut, true);
    if (tile?.width === width && tile.height === height) return tile;
  }
  const source = plane as unknown as Required<TiffPlaneInternals>;
  const image = uncachedTiffImage(await source._indexer(selection));
  const options = { window, width, height, pool: source.pool };
  const raster = await image.readRasters(
    options as Parameters<GeoTIFFImage["readRasters"]>[0],
  );
  if (signal?.aborted) throw SIGNAL_ABORTED;
  const [samples] = raster as unknown as ArrayLike<number>[];
  return { data: expandThroughLut(samples, lut), width, height };
}

/**
 * Widening table from the gray ICC profile on an 8-bit, one-sample TIFF's
 * first IFD. `null` when the file has no such profile.
 */
async function iccLutForLoader(loader: Loader): Promise<Uint16Array | null> {
  const plane = loader.data?.[0];
  const indexer = (plane as unknown as TiffPlaneInternals | undefined)
    ?._indexer;
  if (plane?.dtype !== "Uint8" || !indexer) return null;
  const image = await indexer({ t: 0, z: 0, c: 0 });
  const icc = image.fileDirectory?.[GEOTIFF_ICC_PROFILE_KEY];
  if (!icc || image.getSamplesPerPixel() !== 1) return null;
  return iccGrayU8ToU16Lut(Uint8Array.from(icc));
}

/** Apply that table when the file has one. Pixels are then linear uint16. */
export async function applyGrayIccProfile(loader: Loader): Promise<Loader> {
  const lut = await iccLutForLoader(loader).catch(() => null);
  if (!lut) return loader;
  const wrapped = wrapOmeLoaderJpegExport(loader, lut);
  return {
    ...wrapped,
    metadata: {
      ...wrapped.metadata,
      Pixels: { ...wrapped.metadata.Pixels, Type: "uint16" },
    },
  };
}

/**
 * Wrap Viv OME planes so JPEG-decoded uint8 tiles become uint16 for display,
 * through `lut`: the file's ICC profile, the cube-root inverse, or
 * `byte << 8` for a baked contrast window.
 */
export function wrapOmeLoaderJpegExport(
  loader: Loader,
  lut: Uint16Array,
): Loader {
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
      // Export reads, so a re-export of a hosted story does not fill the cache.
      ...((plane as unknown as TiffPlaneInternals)._indexer
        ? {
            readWindow: (args: WindowArgs) =>
              readWindowThroughLut(plane, args, lut),
          }
        : {}),
    };
    return wrapped;
  });
  return data ? { ...loader, data } : loader;
}

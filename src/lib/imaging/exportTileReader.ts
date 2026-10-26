import { getImageSize, TiffPixelSource } from "@hms-dbmi/viv";
import { GeoTIFFImage } from "geotiff";
import type { HasTile, LoaderPlane, SupportedTypedArray } from "./loaderTypes";

type Selection = { t: number; z: number; c: number };
/** What re-tiling reads from a plane: Viv TIFF, DICOM and wrapped planes all fit. */
type ExportTilePlane = Parameters<typeof getImageSize>[0];
type Slice = { offset: number; length: number };
type Source = {
  fetch: (slices: Slice[], signal?: AbortSignal) => Promise<ArrayBuffer[]>;
};
/** geotiff's RemoteSource (under BlockedSource) answers `{ data, offset }`. */
type RangeSource = {
  fetch: (
    slices: Slice[],
    signal?: AbortSignal,
  ) => Promise<(ArrayBuffer | { data: ArrayBuffer; offset: number })[]>;
};

/** Merge block reads closer than this: reading a small gap beats another request. */
const MERGE_GAP_BYTES = 256 * 1024;

/** Byte ranges of the tiles (or strips) under a window, merged where close. */
function mergedBlockRanges(
  image: GeoTIFFImage,
  [x0, y0, x1, y1]: number[],
): Slice[] {
  const fd = image.fileDirectory;
  const offsets = image.isTiled ? fd.TileOffsets : fd.StripOffsets;
  const counts = image.isTiled ? fd.TileByteCounts : fd.StripByteCounts;
  const blockW = image.getTileWidth();
  const blockH = image.getTileHeight();
  const across = Math.ceil(image.getWidth() / blockW);
  const down = Math.ceil(image.getHeight() / blockH);
  const planes =
    image.planarConfiguration === 2 ? image.getSamplesPerPixel() : 1;
  const ranges: Slice[] = [];
  for (let p = 0; p < planes; p++) {
    for (let by = Math.floor(y0 / blockH); by < Math.ceil(y1 / blockH); by++) {
      for (
        let bx = Math.floor(x0 / blockW);
        bx < Math.ceil(x1 / blockW);
        bx++
      ) {
        if (bx >= across || by >= down) continue;
        const i = p * across * down + by * across + bx;
        const length = Number(counts[i]);
        if (length > 0) ranges.push({ offset: Number(offsets[i]), length });
      }
    }
  }
  ranges.sort((a, b) => a.offset - b.offset);
  const merged: Slice[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.offset - (last.offset + last.length) <= MERGE_GAP_BYTES) {
      last.length = Math.max(last.length, r.offset + r.length - last.offset);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/**
 * Starts the merged reads; geotiff's per-block fetches are then served from
 * them. `readSignal` is this tile's own (see {@link withReadSignal}).
 */
function prefetchedSource(
  base: Source,
  ranges: Slice[],
  readSignal: AbortSignal,
): Source {
  // geotiff's BlockedSource (URLs) shares its eviction map across fetches,
  // so large reads go to the range source underneath it.
  const blocked = base as Source & { blockSize?: number; source?: RangeSource };
  const bulk: RangeSource =
    blocked.blockSize && blocked.source ? blocked.source : base;
  const runs = ranges.map((range) => ({
    ...range,
    data: bulk.fetch([range], readSignal).then(
      ([result]) => {
        const { data, offset } =
          result instanceof ArrayBuffer
            ? { data: result, offset: range.offset }
            : result;
        const whole =
          offset === range.offset && data.byteLength >= range.length;
        return whole ? data : null;
      },
      () => null,
    ),
  }));
  return {
    fetch: (slices, signal) =>
      Promise.all(
        slices.map(async (slice) => {
          const run = runs.find(
            (r) =>
              r.offset <= slice.offset &&
              slice.offset + slice.length <= r.offset + r.length,
          );
          const data = await run?.data;
          // A cancelled export does not fall back to fetching the slice again.
          if (readSignal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          if (!run || !data) return (await base.fetch([slice], signal))[0];
          // A copy: the decode pool transfers (detaches) what it gets.
          const start = slice.offset - run.offset;
          return data.slice(start, start + slice.length);
        }),
      ),
  };
}

/**
 * Export tile (x, y) from a plane whose tiles are another size: copy in the
 * source tiles under it, one row of them at a time so a 1024 tile over 128px
 * source tiles does not start 64 reads at once.
 */
async function composeExportTile(
  plane: ExportTilePlane,
  tileSize: number,
  selection: Selection,
  x: number,
  y: number,
  signal: AbortSignal,
): Promise<HasTile> {
  const { width, height } = getImageSize(plane);
  const src = plane.tileSize;
  const x0 = x * tileSize;
  const y0 = y * tileSize;
  const w = Math.min(tileSize, width - x0);
  const h = Math.min(tileSize, height - y0);
  const sx0 = Math.floor(x0 / src);
  const columns = Math.ceil((x0 + w) / src) - sx0;
  let out: SupportedTypedArray | undefined;
  for (let sy = Math.floor(y0 / src); sy * src < y0 + h; sy++) {
    const top = sy * src;
    const tiles = Array.from({ length: columns }, async (_, i) => {
      const sx = sx0 + i;
      const left = sx * src;
      const tile = await plane.getTile({ selection, x: sx, y: sy, signal });
      const samples = tile.data.length / (tile.width * tile.height);
      out ??= new (
        tile.data.constructor as new (
          n: number,
        ) => SupportedTypedArray
      )(w * h * samples);
      const from0 = Math.max(x0, left);
      const run = (Math.min(x0 + w, left + tile.width) - from0) * samples;
      const rowEnd = Math.min(y0 + h, top + tile.height);
      for (let row = Math.max(y0, top); row < rowEnd; row++) {
        const from = ((row - top) * tile.width + (from0 - left)) * samples;
        const to = ((row - y0) * w + (from0 - x0)) * samples;
        out.set(tile.data.subarray(from, from + run), to);
      }
    });
    await Promise.all(tiles);
  }
  if (!out) throw new Error(`No source tiles under export tile ${x},${y}`);
  return { data: out, width: w, height: h };
}

/**
 * Run `read` on a signal of its own that follows `signal`. geotiff's file
 * source adds an abort listener for every read and never removes it; on the
 * export's long-lived signal, those listeners kept every buffer read alive
 * until the file was done, and a large export ran out of memory.
 */
async function withReadSignal<T>(
  signal: AbortSignal,
  read: (readSignal: AbortSignal) => Promise<T>,
): Promise<T> {
  const local = new AbortController();
  const abort = () => local.abort(signal.reason);
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  try {
    return await read(local.signal);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

const HOST_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

async function decodedBlockTile(
  reader: GeoTIFFImage,
  pool: unknown,
  tileSize: number,
  x: number,
  y: number,
  [x0, y0, x1, y1]: number[],
  signal: AbortSignal,
): Promise<HasTile | null> {
  if (!pool) return null;
  let bits: number;
  let bytesPerElement: number;
  try {
    if (
      !reader.isTiled ||
      reader.getTileWidth() !== tileSize ||
      reader.getTileHeight() !== tileSize ||
      reader.getSamplesPerPixel() !== 1
    ) {
      return null;
    }
    bits = reader.getBitsPerSample(0);
    bytesPerElement = reader.getArrayForSample(0, 0).BYTES_PER_ELEMENT;
  } catch {
    return null;
  }
  // Widened or packed samples are not the decoded buffer.
  if (bits !== bytesPerElement * 8) return null;
  if (bytesPerElement > 1 && reader.littleEndian !== HOST_LITTLE_ENDIAN) {
    return null;
  }
  const block = await reader.getTileOrStrip(
    x,
    y,
    0,
    pool as Parameters<GeoTIFFImage["getTileOrStrip"]>[3],
    signal,
  );
  const full = reader.getArrayForSample(0, block.data) as SupportedTypedArray;
  if (full.length !== tileSize * tileSize) return null;
  const width = x1 - x0;
  const height = y1 - y0;
  if (width === tileSize && height === tileSize) {
    return { data: full, width, height };
  }
  const Typed = full.constructor as new (n: number) => SupportedTypedArray;
  const data = new Typed(width * height);
  for (let row = 0; row < height; row++) {
    const from = row * tileSize;
    data.set(full.subarray(from, from + width), row * width);
  }
  return { data, width, height };
}

/**
 * Export tile (x, y), `tileSize` px. A TIFF plane reads the source blocks
 * under the tile in a few merged reads (a row of neighboring blocks is
 * usually contiguous on disk), then decodes that block when it is the tile.
 * A plane with `readWindow` (masks, JPEG-export wraps) reads the tile's window;
 * other planes are assembled from their own tiles.
 */
export function readExportTile(
  plane: ExportTilePlane & Pick<LoaderPlane, "readWindow">,
  tileSize: number,
  selection: Selection,
  x: number,
  y: number,
  signal: AbortSignal,
): Promise<HasTile> {
  return withReadSignal(signal, (readSignal) =>
    readTile(plane, tileSize, selection, x, y, readSignal),
  );
}

async function readTile(
  plane: ExportTilePlane & Pick<LoaderPlane, "readWindow">,
  tileSize: number,
  selection: Selection,
  x: number,
  y: number,
  signal: AbortSignal,
): Promise<HasTile> {
  const { width, height } = getImageSize(plane);
  const window: [number, number, number, number] = [
    x * tileSize,
    y * tileSize,
    Math.min(width, (x + 1) * tileSize),
    Math.min(height, (y + 1) * tileSize),
  ];
  // DICOM planes, masks, and the JPEG-export hydrate wrap (a spread copy) are not instances.
  if (!(plane instanceof TiffPixelSource)) {
    if (plane.readWindow)
      return plane.readWindow({ selection, window, signal });
    if (plane.tileSize === tileSize) {
      return plane.getTile({ selection, x, y, signal });
    }
    return composeExportTile(plane, tileSize, selection, x, y, signal);
  }
  const indexer = (
    plane as unknown as {
      _indexer: (s: Selection) => Promise<GeoTIFFImage>;
    }
  )._indexer;
  const image = await indexer(selection);
  const source = prefetchedSource(
    image.source as unknown as Source,
    mergedBlockRanges(image, window),
    signal,
  );
  const reader = new GeoTIFFImage(
    image.fileDirectory,
    image.geoKeys,
    image.dataView,
    image.littleEndian,
    false,
    source as unknown as GeoTIFFImage["source"],
  );
  const decoded = await decodedBlockTile(
    reader,
    plane.pool,
    tileSize,
    x,
    y,
    window,
    signal,
  );
  if (decoded) return decoded;
  const atTileSize = new TiffPixelSource(
    async () => reader,
    plane.dtype,
    tileSize,
    plane.shape,
    plane.labels,
    plane.meta,
    plane.pool,
  );
  return atTileSize.getTile({ selection, x, y, signal });
}

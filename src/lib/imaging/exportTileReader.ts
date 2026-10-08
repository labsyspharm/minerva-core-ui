import { getImageSize, TiffPixelSource } from "@hms-dbmi/viv";
import { GeoTIFFImage } from "geotiff";
import type { LoaderPlane } from "./omeTiffExport";

type Selection = { t: number; z: number; c: number };
type Slice = { offset: number; length: number };
type Source = {
  fetch: (slices: Slice[], signal?: AbortSignal) => Promise<ArrayBuffer[]>;
};
/** geotiff's RemoteSource (under BlockedSource) answers `{ data, offset }`. */
type RangeSource = {
  fetch: (
    slices: Slice[],
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

/** Starts the merged reads; geotiff's per-block fetches are then served from them. */
function prefetchedSource(base: Source, ranges: Slice[]): Source {
  // geotiff's BlockedSource (URLs) shares its eviction map across fetches,
  // so large reads go to the range source underneath it.
  const blocked = base as Source & { blockSize?: number; source?: RangeSource };
  const bulk: RangeSource =
    blocked.blockSize && blocked.source ? blocked.source : base;
  const runs = ranges.map((range) => ({
    ...range,
    data: bulk.fetch([range]).then(
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
          if (!run || !data) return (await base.fetch([slice], signal))[0];
          // A copy: the decode pool transfers (detaches) what it gets.
          const start = slice.offset - run.offset;
          return data.slice(start, start + slice.length);
        }),
      ),
  };
}

/**
 * Export tile (x, y), `tileSize` px. A TIFF plane reads the source blocks
 * under the tile in a few merged reads (a row of neighboring blocks is
 * usually contiguous on disk), then decodes through Viv as usual. Other
 * planes keep their own tile size (see `exportPlaneLevels`).
 */
export async function readExportTile(
  plane: Pick<LoaderPlane, "getTile">,
  tileSize: number,
  selection: Selection,
  x: number,
  y: number,
  signal: AbortSignal,
) {
  // DICOM planes, and the JPEG-export hydrate wrap (a spread copy), are not instances.
  if (!(plane instanceof TiffPixelSource)) {
    return plane.getTile({ selection, x, y, signal });
  }
  const indexer = (
    plane as unknown as {
      _indexer: (s: Selection) => Promise<GeoTIFFImage>;
    }
  )._indexer;
  const image = await indexer(selection);
  const { width, height } = getImageSize(plane);
  const window = [
    x * tileSize,
    y * tileSize,
    Math.min(width, (x + 1) * tileSize),
    Math.min(height, (y + 1) * tileSize),
  ];
  const source = prefetchedSource(
    image.source as unknown as Source,
    mergedBlockRanges(image, window),
  );
  const reader = new GeoTIFFImage(
    image.fileDirectory,
    image.geoKeys,
    image.dataView,
    image.littleEndian,
    false,
    source as unknown as GeoTIFFImage["source"],
  );
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

import { GeoTIFFImage } from "geotiff";

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

/**
 * `image`, reading from the range source under geotiff's block cache instead
 * of through it. Viv opens remote TIFFs with an unlimited cache, so an
 * export, which reads every tile once, would end up holding the whole file.
 * Sources without a cache (local files) come back as they are.
 */
export function uncachedTiffImage(image: GeoTIFFImage): GeoTIFFImage {
  const cached = image.source as unknown as Source & {
    blockSize?: number;
    source?: RangeSource;
  };
  const ranges = cached.blockSize ? cached.source : undefined;
  if (!ranges) return image;
  const source: Source = {
    fetch: (slices, signal) =>
      Promise.all(
        slices.map(async (slice) => {
          const [result] = await ranges.fetch([slice], signal);
          const { data, offset } =
            result instanceof ArrayBuffer
              ? { data: result, offset: slice.offset }
              : result;
          const start = slice.offset - offset;
          if (start < 0 || start + slice.length > data.byteLength) {
            // Not the bytes asked for; the cached path copes with that.
            return (await cached.fetch([slice], signal))[0];
          }
          // Exactly the slice: range reads come back a byte long.
          return data.slice(start, start + slice.length);
        }),
      ),
  };
  return new GeoTIFFImage(
    image.fileDirectory,
    image.geoKeys,
    image.dataView,
    image.littleEndian,
    false,
    source as unknown as GeoTIFFImage["source"],
  );
}

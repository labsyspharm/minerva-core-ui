import type { GeoTIFFImage } from "geotiff";
import { GEOTIFF_ICC_PROFILE_KEY, iccGrayU8ToU16Lut } from "@/lib/icc";
import { uncachedTiffImage } from "./uncachedTiff";

type Selection = { t: number; z: number; c: number };
type Source = {
  fetch: (
    slices: { offset: number; length: number }[],
    signal?: AbortSignal,
  ) => Promise<ArrayBuffer[]>;
};
/** Viv `TiffPixelSource`'s IFD lookup; the spread-copy wraps keep it. */
type IndexedPlane = {
  _indexer?: (selection: Selection) => Promise<GeoTIFFImage>;
};
type ExportLevel = { width: number; height: number; tileSize: number };

/**
 * What the export writes, which a source tile must already be to be copied:
 * one-sample cube-root gray, or packed RGB as 4:2:0 YCbCr. `profileless`
 * takes gray tiles as cube-root without a profile (an older Minerva export).
 */
export type JpegTileCopy =
  | { kind: "cube-root"; profileless: boolean }
  | { kind: "rgb" };

const TIFF_COMPRESSION_JPEG = 7;
const TIFF_BLACK_IS_ZERO = 1;
const TIFF_YCBCR = 6;
/** Baseline DCT, the only frame type the encoder writes. */
const JPEG_SOF0 = 0xc0;

/** Whether each IFD carries the gamma-3 gray profile. */
const gamma3Profiles = new WeakMap<object, boolean>();

function hasGamma3Profile(image: GeoTIFFImage): boolean {
  const fd = image.fileDirectory;
  let gamma3 = gamma3Profiles.get(fd);
  if (gamma3 === undefined) {
    const icc = fd[GEOTIFF_ICC_PROFILE_KEY];
    // The table exists only for a gamma-3 gray profile.
    gamma3 = !!icc && iccGrayU8ToU16Lut(Uint8Array.from(icc)) !== null;
    gamma3Profiles.set(fd, gamma3);
  }
  return gamma3;
}

/**
 * Whether `image` holds the export's own tiling at `level`: self-contained
 * 8-bit JPEG tiles of the same size and grid, in the form `copy` writes.
 */
function holdsExportTiles(
  image: GeoTIFFImage,
  level: ExportLevel,
  copy: JpegTileCopy,
): boolean {
  const fd = image.fileDirectory;
  const bits: ArrayLike<number> = fd.BitsPerSample ?? [];
  const sameTiling =
    image.isTiled &&
    image.getTileWidth() === level.tileSize &&
    image.getTileHeight() === level.tileSize &&
    image.getWidth() === level.width &&
    image.getHeight() === level.height &&
    fd.Compression === TIFF_COMPRESSION_JPEG &&
    !fd.JPEGTables &&
    Array.from(bits).every((b) => b === 8);
  if (!sameTiling) return false;
  if (copy.kind === "rgb") {
    // YCbCrSubSampling defaults to [2, 2], which is what the export declares.
    const sub = fd.YCbCrSubSampling ?? [2, 2];
    return (
      image.getSamplesPerPixel() === 3 &&
      image.planarConfiguration === 1 &&
      fd.PhotometricInterpretation === TIFF_YCBCR &&
      sub[0] === 2 &&
      sub[1] === 2
    );
  }
  return (
    image.getSamplesPerPixel() === 1 &&
    fd.PhotometricInterpretation === TIFF_BLACK_IS_ZERO &&
    (copy.profileless || hasGamma3Profile(image))
  );
}

/**
 * Whether `jpeg` is framed as the encoder frames a tile: baseline, 8-bit,
 * the full `tileSize` square (edge tiles padded, as TIFF requires), and one
 * gray component or Y at 2x2 with Cb, Cr at 1x1.
 */
function framedLikeExportTile(
  jpeg: Uint8Array,
  tileSize: number,
  copy: JpegTileCopy,
): boolean {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return false;
  let i = 2;
  while (i + 9 < jpeg.length) {
    if (jpeg[i] !== 0xff) return false;
    const marker = jpeg[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return false;
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      const height = (jpeg[i + 5] << 8) | jpeg[i + 6];
      const width = (jpeg[i + 7] << 8) | jpeg[i + 8];
      const components = jpeg[i + 9];
      const sampling = (k: number) => jpeg[i + 11 + k * 3];
      const framed =
        marker === JPEG_SOF0 &&
        jpeg[i + 4] === 8 &&
        width === tileSize &&
        height === tileSize;
      return copy.kind === "rgb"
        ? framed &&
            components === 3 &&
            sampling(0) === 0x22 &&
            sampling(1) === 0x11 &&
            sampling(2) === 0x11
        : framed && components === 1;
    }
    i += 2 + ((jpeg[i + 2] << 8) | jpeg[i + 3]);
  }
  return false;
}

/**
 * Tile (x, y) of an export level, copied from the source file as it is
 * when the source already has the export's tiling and encoding, so a
 * re-export neither decodes nor recompresses it. `null` means encode this
 * tile (the plane is not a TIFF, the IFD or tile is laid out or encoded
 * differently, or the tile is empty).
 */
export async function readCopyableJpegTile(
  plane: object,
  selection: Selection,
  x: number,
  y: number,
  level: ExportLevel,
  copy: JpegTileCopy,
  signal: AbortSignal,
): Promise<Uint8Array | null> {
  const indexer = (plane as IndexedPlane)._indexer;
  if (!indexer) return null;
  const image = await indexer(selection);
  if (!holdsExportTiles(image, level, copy)) return null;
  const fd = image.fileDirectory;
  const index = y * Math.ceil(level.width / level.tileSize) + x;
  const offset = Number(fd.TileOffsets?.[index]);
  const length = Number(fd.TileByteCounts?.[index]);
  if (!length) return null;
  const source = uncachedTiffImage(image).source as unknown as Source;
  const [buffer] = await source.fetch([{ offset, length }], signal);
  const jpeg = new Uint8Array(buffer);
  return framedLikeExportTile(jpeg, level.tileSize, copy) ? jpeg : null;
}

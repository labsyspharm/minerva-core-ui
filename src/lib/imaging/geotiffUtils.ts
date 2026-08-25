import { GeoTIFFImage } from "geotiff";
import type { Loader } from "./viv";

export type GeoTiff = Awaited<ReturnType<typeof import("geotiff").fromBlob>>;
export type GeoTiffImage = Awaited<ReturnType<GeoTiff["getImage"]>>;

/** Fields geotiff uses when constructing SubIFD images (not in public typings). */
type GeoTiffInternals = GeoTiff & {
  dataView: DataView;
  littleEndian: boolean;
  cache: unknown;
  source: unknown;
  parseFileDirectoryAt: (offset: number) => Promise<{
    fileDirectory: GeoTiffImage["fileDirectory"];
    geoKeyDirectory: unknown;
  }>;
};

export type Dtype =
  | "Uint8"
  | "Uint16"
  | "Uint32"
  | "Int8"
  | "Int16"
  | "Int32"
  | "Float32"
  | "Float64";

type OmePixelMetadata = Loader["metadata"]["Pixels"];

type ParsedOmePixels = Partial<OmePixelMetadata>;

type TiffSampleDirectory = {
  SamplesPerPixel?: number;
  BitsPerSample?: ArrayLike<number>;
  SampleFormat?: ArrayLike<number>;
  ImageDescription?: unknown;
  SubIFDs?: unknown;
  TileWidth?: unknown;
  TileLength?: unknown;
};

function tiffDirNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value) && typeof value[0] === "number") return value[0];
  return 0;
}

/** True TIFF tiles — not geotiff's ImageWidth / RowsPerStrip fallback. */
export function isTiffTiled(image: GeoTiffImage): boolean {
  const fd = image.fileDirectory as TiffSampleDirectory;
  return tiffDirNumber(fd.TileWidth) > 0 && tiffDirNumber(fd.TileLength) > 0;
}

export function isTiffPyramided(image: GeoTiffImage): boolean {
  const offsets = (image.fileDirectory as TiffSampleDirectory).SubIFDs;
  return Array.isArray(offsets) && offsets.length > 0;
}

/** Power-of-two tile size, matching Viv MultiscaleImageLayer. */
export function vivTileSize(image: GeoTiffImage): number {
  const tw = image.getTileWidth();
  const th = image.getTileHeight();
  const size = Math.min(tw, th);
  return 2 ** Math.floor(Math.log2(Math.max(1, size)));
}

export function dtypeFromTiffDirectory(fileDirectory: {
  BitsPerSample?: ArrayLike<number>;
  SampleFormat?: ArrayLike<number>;
}): Dtype {
  const bits = fileDirectory.BitsPerSample?.[0] ?? 16;
  const sampleFormat = fileDirectory.SampleFormat?.[0] ?? 1;
  if (sampleFormat === 3) return bits === 64 ? "Float64" : "Float32";
  if (sampleFormat === 2) {
    if (bits <= 8) return "Int8";
    if (bits <= 16) return "Int16";
    return "Int32";
  }
  if (bits <= 8) return "Uint8";
  if (bits <= 16) return "Uint16";
  return "Uint32";
}

/** First OME Pixels block — size/units only (channel names come from import). */
export function parseFirstOmeImagePixels(
  imageDescription: unknown,
): ParsedOmePixels | null {
  if (typeof imageDescription !== "string" || imageDescription.trim() === "") {
    return null;
  }
  const doc = new DOMParser().parseFromString(
    imageDescription,
    "application/xml",
  );
  const pixels = doc.querySelector("Image")?.querySelector("Pixels");
  if (!pixels) return null;
  const num = (name: string) => {
    const value = pixels.getAttribute(name);
    return value == null ? undefined : Number(value);
  };
  const channelCount = pixels.querySelectorAll("Channel").length;
  return {
    ID: pixels.getAttribute("ID") ?? undefined,
    Type: pixels.getAttribute("Type") ?? undefined,
    SizeC: num("SizeC") ?? (channelCount > 0 ? channelCount : undefined),
    PhysicalSizeX: num("PhysicalSizeX"),
    PhysicalSizeY: num("PhysicalSizeY"),
    PhysicalSizeXUnit: pixels.getAttribute("PhysicalSizeXUnit") ?? undefined,
    PhysicalSizeYUnit: pixels.getAttribute("PhysicalSizeYUnit") ?? undefined,
    PhysicalSizeZUnit: pixels.getAttribute("PhysicalSizeZUnit") ?? undefined,
    BigEndian: false,
  };
}

/** IFD 0 + SubIFD reduced-resolution levels. */
export async function resolveSubIfdPyramidImages(
  tiff: GeoTiff,
  baseImage: GeoTiffImage,
): Promise<GeoTiffImage[]> {
  const images: GeoTiffImage[] = [baseImage];
  const offsets = (baseImage.fileDirectory as TiffSampleDirectory).SubIFDs;
  if (!Array.isArray(offsets) || offsets.length === 0) return images;

  const internals = tiff as GeoTiffInternals;
  for (const offset of offsets) {
    const parsed = await internals.parseFileDirectoryAt(offset);
    images.push(
      new GeoTIFFImage(
        parsed.fileDirectory,
        parsed.geoKeyDirectory,
        internals.dataView,
        internals.littleEndian,
        internals.cache,
        internals.source,
      ) as unknown as GeoTiffImage,
    );
  }
  return images;
}

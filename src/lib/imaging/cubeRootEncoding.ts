import {
  isRgbDisplayImage,
  resolveImageContentRole,
} from "@/lib/imaging/channelKind";

/** Intensity transfer for JPEG pyramid / OME-TIFF encode/decode. */

export type JpegExportTransfer = "contrast" | "cube-root";

/**
 * Metadata.imageSource for JPEG OME-TIFF story bundles.
 * Legacy `jpeg-ome-tiff` means cube-root (first ship).
 */
export const JPEG_OME_TIFF_IMAGE_SOURCE = "jpeg-ome-tiff";
export const JPEG_OME_TIFF_CONTRAST_IMAGE_SOURCE = "jpeg-ome-tiff-contrast";

export function isJpegOmeTiffImageSource(
  imageSource: string | undefined,
): boolean {
  return (
    imageSource === JPEG_OME_TIFF_IMAGE_SOURCE ||
    imageSource === JPEG_OME_TIFF_CONTRAST_IMAGE_SOURCE
  );
}

export function jpegTransferFromImageSource(
  imageSource: string | undefined,
): JpegExportTransfer {
  if (
    imageSource === "jpeg-pyramid-cube-root" ||
    imageSource === JPEG_OME_TIFF_IMAGE_SOURCE
  ) {
    return "cube-root";
  }
  return "contrast";
}

export function imageSourceFromJpegTransfer(
  transfer: JpegExportTransfer,
): string {
  return transfer === "cube-root" ? "jpeg-pyramid-cube-root" : "jpeg-pyramid";
}

export function imageSourceFromOmeTiffTransfer(
  transfer: JpegExportTransfer,
): string {
  return transfer === "cube-root"
    ? JPEG_OME_TIFF_IMAGE_SOURCE
    : JPEG_OME_TIFF_CONTRAST_IMAGE_SOURCE;
}

/** Contrast used in pyramid folder hashes (cube-root folders are contrast-stable). */
export function folderLimitsForTransfer(
  transfer: JpegExportTransfer,
  lowerLimit: number,
  upperLimit: number,
): { lowerLimit: number; upperLimit: number } {
  if (transfer === "cube-root") {
    return { lowerLimit: 0, upperLimit: 65535 };
  }
  return { lowerLimit, upperLimit };
}

export function encodeCubeRootU16ToU8(pixel: number): number {
  if (!Number.isFinite(pixel) || pixel <= 0) return 0;
  return Math.min(
    255,
    Math.max(0, Math.round((pixel / 65536) ** (1 / 3) * 256)),
  );
}

function decodeCubeRootU8ToU16(byte: number): number {
  if (!Number.isFinite(byte) || byte <= 0) return 0;
  return Math.min(65535, Math.max(0, Math.round((byte / 256) ** 3 * 65536)));
}

const CUBE_ROOT_U8_TO_U16 = Uint16Array.from({ length: 256 }, (_, b) =>
  decodeCubeRootU8ToU16(b),
);

const CONTRAST_U8_TO_U16 = Uint16Array.from({ length: 256 }, (_, b) => b << 8);

/** Decoded JPEG byte → display uint16: inverse cube root, or `byte << 8` (baked window). */
export function u8ToU16Lut(transfer: JpegExportTransfer): Uint16Array {
  return transfer === "cube-root" ? CUBE_ROOT_U8_TO_U16 : CONTRAST_U8_TO_U16;
}

/** Widen decoded JPEG bytes through a {@link u8ToU16Lut} table. */
export function expandThroughLut(
  data: ArrayLike<number>,
  lut: Uint16Array,
): Uint16Array<ArrayBuffer> {
  const out = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = lut[data[i] & 0xff];
  }
  return out;
}

type TransferImage = {
  contentRole?: "intensity" | "segmentation";
  rgbDisplay?: boolean;
  channels?: ReadonlyArray<{
    kind?: "channel" | "mask";
    samples?: number;
    sourceDataTypeId?: string;
    name?: string;
  }>;
};

/** Brightfield / RGB / H&E stays contrast; IF multiplex uses the story transfer. */
export function exportTransferForImage(
  image: TransferImage,
  storyTransfer: JpegExportTransfer,
): JpegExportTransfer {
  if (isRgbDisplayImage(image)) return "contrast";
  return storyTransfer;
}

/**
 * JPEG OME-TIFF hydrate wrap. `null` means do not wrap (masks, packed RGB).
 * Planar RGB is contrast even when the story `imageSource` is cube-root.
 * Packed RGB stays uint8: Viv uploads interleaved tiles as rgba8unorm.
 */
export function hydrateJpegTransferForImage(
  image: TransferImage,
  storyTransfer: JpegExportTransfer,
): JpegExportTransfer | null {
  if (image.channels?.some((c) => c.samples === 3)) return null;
  if (
    resolveImageContentRole({
      contentRole: image.contentRole,
      channels: [...(image.channels ?? [])],
    }) === "segmentation"
  ) {
    return null;
  }
  return exportTransferForImage(image, storyTransfer);
}

import {
  isRgbDisplaySource,
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

export function decodeCubeRootU8ToU16(byte: number): number {
  if (!Number.isFinite(byte) || byte <= 0) return 0;
  return Math.min(65535, Math.max(0, Math.round((byte / 256) ** 3 * 65536)));
}

type TransferImage = {
  contentRole?: "intensity" | "segmentation";
  channels?: ReadonlyArray<{
    kind?: "channel" | "mask";
    samples?: number;
    sourceDataTypeId?: string;
    name?: string;
  }>;
};

/** RGB / H&E always uses contrast; IF multiplex uses the story transfer. */
export function exportTransferForImage(
  image: TransferImage,
  storyTransfer: JpegExportTransfer,
): JpegExportTransfer {
  if (isRgbDisplaySource(image.channels ?? [])) return "contrast";
  return storyTransfer;
}

/**
 * JPEG OME-TIFF hydrate wrap. `null` means do not wrap (masks).
 * RGB is contrast even when the story `imageSource` is cube-root.
 */
export function hydrateJpegTransferForImage(
  image: TransferImage,
  storyTransfer: JpegExportTransfer,
): JpegExportTransfer | null {
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

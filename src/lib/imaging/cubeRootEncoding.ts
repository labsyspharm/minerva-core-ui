/** Cube-root intensity transfer for JPEG pyramid encode/decode. */

export type JpegExportTransfer = "contrast" | "cube-root";

export function jpegTransferFromImageSource(
  imageSource: string | undefined,
): JpegExportTransfer {
  return imageSource === "jpeg-pyramid-cube-root" ? "cube-root" : "contrast";
}

export function imageSourceFromJpegTransfer(
  transfer: JpegExportTransfer,
): string {
  return transfer === "cube-root" ? "jpeg-pyramid-cube-root" : "jpeg-pyramid";
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

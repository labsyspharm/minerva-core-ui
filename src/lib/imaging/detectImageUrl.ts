import { isDicomWeb, isDicomWebSeriesUrl } from "@/lib/imaging/dicom.js";
import { isOmeTiff } from "@/lib/imaging/omeTiff";

export type DetectedUrlImageFormat = "ome-tiff" | "dicomweb";

/**
 * Probe a URL to choose OME-TIFF vs DICOMweb.
 * Uses path heuristic first; confirms with header-scale network checks.
 * Falls back to the path heuristic when both probes fail.
 */
export async function detectUrlImageFormat(
  url: string,
  signal?: AbortSignal,
): Promise<DetectedUrlImageFormat> {
  const looksDicom = isDicomWebSeriesUrl(url);
  if (looksDicom) {
    if (await isDicomWeb(url, signal)) return "dicomweb";
  }
  if (await isOmeTiff(url, signal)) return "ome-tiff";
  return looksDicom ? "dicomweb" : "ome-tiff";
}

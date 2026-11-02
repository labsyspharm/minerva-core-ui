import {
  isDicomWebSeriesUrl,
  normalizeDicomWebSeriesUrl,
} from "@/lib/imaging/dicom.js";

/**
 * What `?src=` should open on the public viewer.
 * A DICOMweb series, any other image URL, or a story file (`config.json`).
 */
type ViewerLaunchUrl =
  | { kind: "story"; url: string }
  | { kind: "dicomWeb"; url: string }
  | { kind: "image"; url: string };

/**
 * Classify an absolute http(s) URL.
 * Series roots and deeper WADO paths (`…/instances/…/frames/…`) are DICOMweb.
 * A path ending in `.json` is a story (`config.json` or `document.json`).
 * Anything else is an image (OME-TIFF). Query strings are kept on images and
 * stories so signed URLs still fetch; a series is opened at its root.
 */
export function classifyViewerLaunchUrl(raw: string): ViewerLaunchUrl | null {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const pathUrl = `${parsed.origin}${parsed.pathname}`;
  if (isDicomWebSeriesUrl(pathUrl)) {
    return {
      kind: "dicomWeb",
      url: normalizeDicomWebSeriesUrl(pathUrl),
    };
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  if (path.toLowerCase().endsWith(".json")) {
    return { kind: "story", url: trimmed };
  }
  return { kind: "image", url: trimmed };
}

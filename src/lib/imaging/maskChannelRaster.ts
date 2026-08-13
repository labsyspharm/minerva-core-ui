import type { Loader } from "@/lib/imaging/viv";
import type { LoaderPlane, SupportedTypedArray } from "./loaderTypes";

/**
 * OME plane raster fetch for histogram / auto-contrast.
 * File name is historical; not mask-specific.
 */

type PlaneRasterPrefs = { preferCoarsest?: boolean };

/**
 * Read a full-plane raster, trying pyramid levels until one succeeds.
 * OME metadata sometimes lists pyramid levels that are not present in the file.
 */
export async function fetchPlaneRaster(
  loader: Loader,
  sourceIndex: number,
  prefs: PlaneRasterPrefs = {},
): Promise<{
  raster: { data: SupportedTypedArray; width?: number; height?: number };
  plane: LoaderPlane;
} | null> {
  const planes = loader.data;
  if (!planes?.length) return null;
  const first = planes[0];
  const cIdx = first.labels.indexOf("c");
  const channelCount = cIdx >= 0 ? first.shape[cIdx] : 1;
  if (sourceIndex < 0 || sourceIndex >= channelCount) return null;
  const preferCoarsest = prefs.preferCoarsest ?? false;
  const order = preferCoarsest
    ? [...planes.keys()].reverse()
    : [...planes.keys()];
  for (const i of order) {
    const plane = planes[i];
    try {
      const raster = (await plane.getRaster({
        selection: { t: 0, z: 0, c: sourceIndex },
      })) as { data: SupportedTypedArray; width?: number; height?: number };
      if (raster?.data?.length) return { raster, plane };
    } catch {
      // skip missing or unreadable pyramid level
    }
  }
  return null;
}

/** Coerce raster pixels into `Uint16Array` for histogram / display-scale analysis. */
export function rasterToUint16Array(data: SupportedTypedArray): Uint16Array {
  if (data instanceof Uint16Array) return data;
  const out = new Uint16Array(data.length);
  if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
    for (let i = 0; i < data.length; i++) out[i] = data[i] << 8;
    return out;
  }
  for (let i = 0; i < data.length; i++) {
    const v = (data as ArrayLike<number>)[i];
    out[i] = Number.isFinite(v)
      ? Math.max(0, Math.min(65535, Math.round(v)))
      : 0;
  }
  return out;
}

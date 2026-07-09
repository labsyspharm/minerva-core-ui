import type { LoaderPlane, SupportedTypedArray } from "@/lib/authoring/config";
import type { Loader } from "@/lib/imaging/viv";

/**
 * OME plane raster fetch (histogram auto-contrast + mask label overlays).
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

function rasterToLabelArray(
  data: SupportedTypedArray,
): Uint8Array | Uint16Array | Uint32Array {
  if (
    data instanceof Uint8Array ||
    data instanceof Uint16Array ||
    data instanceof Uint32Array
  ) {
    return data;
  }
  return rasterToUint16Array(data);
}

/** Fetch label raster for one source index (finest readable pyramid plane). */
export async function fetchLabelRasterForSourceIndex(
  loader: Loader,
  sourceIndex: number,
): Promise<{
  data: Uint8Array | Uint16Array | Uint32Array;
  width: number;
  height: number;
} | null> {
  const hit = await fetchPlaneRaster(loader, sourceIndex, {
    preferCoarsest: false,
  });
  if (!hit) return null;
  const { raster, plane } = hit;
  const data = rasterToLabelArray(raster.data);
  const width = raster.width ?? plane.shape[plane.labels.indexOf("x")] ?? 0;
  const height = raster.height ?? plane.shape[plane.labels.indexOf("y")] ?? 0;
  if (width <= 0 || height <= 0) return null;
  return { data, width, height };
}

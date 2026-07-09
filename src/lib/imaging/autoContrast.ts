import {
  fetchPlaneRaster,
  rasterToUint16Array,
} from "@/lib/imaging/maskChannelRaster";
import {
  IMPORT_DEFAULT_LOWER_LIMIT,
  IMPORT_DEFAULT_UPPER_LIMIT,
} from "@/lib/imaging/sourceChannelStyle";
import type { Loader } from "@/lib/imaging/viv";
import type { Channel } from "@/lib/stores/documentStore";

/** Histogram percentile auto-contrast for OME channels (names retain `Gmm` for document schema). */

export type ContrastLimits = { lower: number; upper: number };

/**
 * True when `[lower, upper]` looks like import defaults or full range — probably
 * not yet auto-fitted or user-tuned.
 */
export function looksLikeImportDefaultLimits(
  lower: number,
  upper: number,
): boolean {
  if (
    lower === IMPORT_DEFAULT_LOWER_LIMIT &&
    upper === IMPORT_DEFAULT_UPPER_LIMIT
  ) {
    return true;
  }
  if (lower === 0 && upper === 65535) return true;
  if (lower === 0 && upper === 255) return true;
  return false;
}

/** Per-pyramid cache; cleared when the active image changes. */
const omeGmmCache = new Map<string, ContrastLimits>();

function gmmCacheKey(
  imageKey: string,
  sourceImageId: string,
  sourceIndex: number,
): string {
  return `${imageKey}\u0000${sourceImageId}\u0000${sourceIndex}`;
}

export function clearOmeGmmContrastCache(): void {
  omeGmmCache.clear();
}

function sanitizeGmmLimits(vmin: number, vmax: number): ContrastLimits | null {
  if (!Number.isFinite(vmin) || !Number.isFinite(vmax)) return null;
  const lower = Math.max(0, Math.min(65535, Math.round(vmin)));
  const upperRaw = Math.max(0, Math.min(65535, Math.round(vmax)));
  const upper = upperRaw <= lower ? Math.min(65535, lower + 1) : upperRaw;
  if (upper <= lower) return null;
  return { lower, upper };
}

/** 0.1% / 99.9% histogram ranks in uint16 space (stable vs psudo GMM). */
function approximateAutoContrastFromUint16Histogram(
  u16: Uint16Array,
): ContrastLimits | null {
  const n = u16.length;
  if (n === 0) return null;

  const hist = new Uint32Array(65536);
  for (let i = 0; i < n; i++) {
    hist[u16[i]]++;
  }

  const idxLo = Math.max(0, Math.floor(0.001 * (n - 1)));
  const idxHi = Math.min(n - 1, Math.ceil(0.999 * (n - 1)));

  const valuePastSortedIndex = (idx: number): number => {
    let cum = 0;
    for (let v = 0; v < 65536; v++) {
      cum += hist[v];
      if (cum > idx) return v;
    }
    return 65535;
  };

  const lower = valuePastSortedIndex(idxLo);
  const upper = valuePastSortedIndex(idxHi);
  return sanitizeGmmLimits(lower, upper);
}

async function fitChannelGmmContrastForSourceIndex(
  loader: Loader,
  sourceIndex: number,
): Promise<ContrastLimits | null> {
  const hit = await fetchPlaneRaster(loader, sourceIndex, {
    preferCoarsest: true,
  });
  if (!hit) return null;
  const { raster } = hit;
  if (!raster?.data || raster.data.length === 0) return null;

  const u16 = rasterToUint16Array(raster.data);
  return approximateAutoContrastFromUint16Histogram(u16);
}

export function mergeGmmContrastLimitsIntoSourceChannelsByChannelId(
  channels: Channel[],
  byChannelId: Map<string, ContrastLimits>,
  options?: { overwrite?: boolean },
): Channel[] {
  if (byChannelId.size === 0) return channels;
  const overwrite = !!options?.overwrite;
  let changed = false;
  const next = channels.map((sc) => {
    const fit = byChannelId.get(sc.id);
    if (!fit) return sc;
    if (!overwrite && sc.gmmContrastLimits) return sc;
    changed = true;
    return { ...sc, gmmContrastLimits: { lower: fit.lower, upper: fit.upper } };
  });
  return changed ? next : channels;
}

export async function ensureOmeGmmContrastLimits(
  loader: Loader,
  imageKey: string,
  sourceImageId: string,
  sourceIndices: readonly number[],
): Promise<Map<number, ContrastLimits>> {
  const unique = [...new Set(sourceIndices)].filter(
    (i) => Number.isFinite(i) && i >= 0,
  );
  const result = new Map<number, ContrastLimits>();
  const toCompute: number[] = [];

  for (const c of unique) {
    const hit = omeGmmCache.get(gmmCacheKey(imageKey, sourceImageId, c));
    if (hit) {
      result.set(c, hit);
    } else {
      toCompute.push(c);
    }
  }

  if (toCompute.length === 0) {
    return result;
  }

  const fresh = await Promise.all(
    toCompute.map(async (c) => {
      const limits = await fitChannelGmmContrastForSourceIndex(loader, c);
      return [c, limits] as const;
    }),
  );
  for (const [c, limits] of fresh) {
    if (limits) {
      omeGmmCache.set(gmmCacheKey(imageKey, sourceImageId, c), limits);
      result.set(c, limits);
    }
  }
  return result;
}

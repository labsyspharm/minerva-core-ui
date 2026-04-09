/**
 * Lazy OME-TIFF histograms: `ChannelGroupsMasterDetail` requests indices →
 * `ensureOmeHistogramDistributions` (tile extract + in-memory cache) →
 * `mergeHistogramsIntoSourceChannels` patches `sourceDistribution` on the store.
 * DICOM still uses eager `extractDistributions` in `main.tsx` (`getDistributions`).
 */
import type { ConfigSourceDistribution } from "../authoring/config";
import { extractDistributionsForSourceIndices } from "../authoring/config";
import type { Channel } from "../stores/documentStore";
import type { Loader } from "./viv";

export function sourceDistributionYValuesLength(sc: Channel): number {
  const d = sc.sourceDistribution;
  return d?.YValues?.length ?? 0;
}

/** Per-image OME pyramid; cleared when switching images. */
const omeHistogramCache = new Map<string, ConfigSourceDistribution>();

function cacheKey(imageKey: string, sourceIndex: number): string {
  return `${imageKey}\u0000${sourceIndex}`;
}

export function clearOmeHistogramCache(): void {
  omeHistogramCache.clear();
}

export function mergeHistogramsIntoSourceChannels(
  channels: Channel[],
  byIndex: Map<number, ConfigSourceDistribution>,
): Channel[] {
  let changed = false;
  const next = channels.map((sc) => {
    const dist = byIndex.get(sc.index);
    if (!dist) return sc;
    if (sourceDistributionYValuesLength(sc) > 0) return sc;
    changed = true;
    return { ...sc, sourceDistribution: dist };
  });
  return changed ? next : channels;
}

/**
 * Resolve histogram distributions for OME source indices, using an in-memory cache
 * keyed by `{imageKey, index}` (unique for a single multichannel OME-TIFF).
 */
export async function ensureOmeHistogramDistributions(
  loader: Loader,
  imageKey: string,
  sourceIndices: readonly number[],
): Promise<Map<number, ConfigSourceDistribution>> {
  const unique = [...new Set(sourceIndices)].filter(
    (i) => Number.isFinite(i) && i >= 0,
  );
  const result = new Map<number, ConfigSourceDistribution>();
  const toCompute: number[] = [];

  for (const c of unique) {
    const hit = omeHistogramCache.get(cacheKey(imageKey, c));
    if (hit) {
      result.set(c, hit);
    } else {
      toCompute.push(c);
    }
  }

  if (toCompute.length === 0) {
    return result;
  }

  const fresh = await extractDistributionsForSourceIndices(loader, toCompute);
  for (const c of toCompute) {
    const dist = fresh.get(c);
    if (dist) {
      omeHistogramCache.set(cacheKey(imageKey, c), dist);
      result.set(c, dist);
    }
  }

  return result;
}

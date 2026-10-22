/**
 * Lazy OME-TIFF histograms: `ChannelGroupsMasterDetail` requests indices →
 * `ensureOmeHistogramDistributions` (tile extract + in-memory cache) →
 * `mergeHistogramsIntoSourceChannelsByChannelId` patches `sourceDistribution`
 * on the store.
 * DICOM still uses eager `extractDistributions` in `main.tsx` (`getDistributions`).
 */
import type { ConfigSourceDistribution } from "../authoring/config";
import { extractDistributionsForSourceIndices } from "../authoring/config";
import type { Channel } from "../stores/documentStore";
import type { FloatRange } from "./floatRange";
import type { Loader } from "./viv";

export type BackgroundTaskHandle = { cancel: () => void };

/** Defer work until the browser is idle (histogram fetch, etc.). */
export function scheduleBackgroundTask(
  fn: () => void,
  opts?: { timeout?: number },
): BackgroundTaskHandle {
  const timeout = opts?.timeout ?? 2500;
  let cancelled = false;
  let idleId: number | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const run = () => {
    if (cancelled) return;
    fn();
  };

  if (typeof requestIdleCallback !== "undefined") {
    idleId = requestIdleCallback(run, { timeout });
  } else {
    timeoutId = setTimeout(run, 16);
  }

  return {
    cancel: () => {
      cancelled = true;
      if (idleId != null && typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    },
  };
}

export function sourceDistributionYValuesLength(sc: Channel): number {
  const d = sc.sourceDistribution;
  return d?.YValues?.length ?? 0;
}

/** Per-image OME pyramid; cleared when switching images. */
const omeHistogramCache = new Map<string, ConfigSourceDistribution>();

function cacheKey(
  imageKey: string,
  sourceImageId: string,
  sourceIndex: number,
  range?: FloatRange | null,
): string {
  const span = range ? `\0${range.min}\0${range.max}` : "";
  return `${imageKey}\u0000${sourceImageId}\u0000${sourceIndex}${span}`;
}

export function clearOmeHistogramCache(): void {
  omeHistogramCache.clear();
}

/** Prefer when OME channels from several images can share the same pyramid `index`. */
export function mergeHistogramsIntoSourceChannelsByChannelId(
  channels: Channel[],
  byChannelId: Map<string, ConfigSourceDistribution>,
): Channel[] {
  let changed = false;
  const next = channels.map((sc) => {
    const dist = byChannelId.get(sc.id);
    if (!dist) return sc;
    const prev = sc.sourceDistribution;
    if (
      sourceDistributionYValuesLength(sc) > 0 &&
      prev?.LowerRange === dist.LowerRange &&
      prev?.UpperRange === dist.UpperRange &&
      prev?.XScale === dist.XScale
    ) {
      return sc;
    }
    changed = true;
    return { ...sc, sourceDistribution: dist };
  });
  return changed ? next : channels;
}

/**
 * Resolve histogram distributions for OME source indices. The cache key is
 * image, source index, and float span when one was passed.
 */
export async function ensureOmeHistogramDistributions(
  loader: Loader,
  imageKey: string,
  sourceImageId: string,
  sourceIndices: readonly number[],
  ranges?: ReadonlyMap<number, FloatRange>,
): Promise<Map<number, ConfigSourceDistribution>> {
  const unique = [...new Set(sourceIndices)].filter(
    (i) => Number.isFinite(i) && i >= 0,
  );
  const result = new Map<number, ConfigSourceDistribution>();
  const toCompute: number[] = [];

  for (const c of unique) {
    const hit = omeHistogramCache.get(
      cacheKey(imageKey, sourceImageId, c, ranges?.get(c)),
    );
    if (hit) {
      result.set(c, hit);
    } else {
      toCompute.push(c);
    }
  }

  if (toCompute.length === 0) {
    return result;
  }

  const fresh = await extractDistributionsForSourceIndices(
    loader,
    toCompute,
    ranges,
  );
  for (const c of toCompute) {
    const dist = fresh.get(c);
    if (dist) {
      omeHistogramCache.set(
        cacheKey(imageKey, sourceImageId, c, ranges?.get(c)),
        dist,
      );
      result.set(c, dist);
    }
  }

  return result;
}

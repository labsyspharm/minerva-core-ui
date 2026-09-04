import {
  defaultVisibilitiesForSources,
  initialPaintSourceChannelIds,
} from "@/lib/imaging/channelCompositor";
import { isImageChannel } from "@/lib/imaging/channelKind";
import {
  fetchPlaneRaster,
  rasterToUint16Array,
} from "@/lib/imaging/maskChannelRaster";
import { warmupPsudoPalette } from "@/lib/imaging/psudoPalette";
import {
  IMPORT_DEFAULT_LOWER_LIMIT,
  IMPORT_DEFAULT_UPPER_LIMIT,
} from "@/lib/imaging/sourceChannelStyle";
import type { Loader } from "@/lib/imaging/viv";
import type { Image } from "@/lib/stores/documentSchema";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import { flattenImageChannelsInDocumentOrder } from "@/lib/stores/documentStore";
import { applySourceChannelsToImages } from "@/lib/stores/storeUtils";

/** Auto-contrast for OME channels via `psudo.channel_gmm` (schema field still `gmmContrastLimits`). */

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

/** Drop cached fits so a manual re-run recomputes from the raster. */
export function invalidateOmeGmmContrastCache(
  imageKey: string,
  sourceImageId: string,
  sourceIndices: readonly number[],
): void {
  for (const c of sourceIndices) {
    omeGmmCache.delete(gmmCacheKey(imageKey, sourceImageId, c));
  }
}

function sanitizeGmmLimits(vmin: number, vmax: number): ContrastLimits | null {
  if (!Number.isFinite(vmin) || !Number.isFinite(vmax)) return null;
  const lower = Math.max(0, Math.min(65535, Math.round(vmin)));
  const upperRaw = Math.max(0, Math.min(65535, Math.round(vmax)));
  const upper = upperRaw <= lower ? Math.min(65535, lower + 1) : upperRaw;
  if (upper <= lower) return null;
  return { lower, upper };
}

/** DEV diagnostics for why `channel_gmm` may refuse a plane. */
function summarizeUint16ForGmm(u16: Uint16Array): {
  pixels: number;
  positiveCount: number;
  uniquePositive: number;
  positiveMin: number | null;
  positiveMax: number | null;
} {
  const pixels = u16.length;
  let positiveCount = 0;
  let positiveMin = Number.POSITIVE_INFINITY;
  let positiveMax = Number.NEGATIVE_INFINITY;
  const seen = new Set<number>();
  for (let i = 0; i < pixels; i++) {
    const v = u16[i];
    if (v <= 0) continue;
    positiveCount++;
    if (v < positiveMin) positiveMin = v;
    if (v > positiveMax) positiveMax = v;
    // Cap unique tracking — enough to know if < 3 distinct positives.
    if (seen.size < 64) seen.add(v);
  }
  return {
    pixels,
    positiveCount,
    uniquePositive: seen.size,
    positiveMin: positiveCount > 0 ? positiveMin : null,
    positiveMax: positiveCount > 0 ? positiveMax : null,
  };
}

/**
 * Fallback when `psudo.channel_gmm` returns empty / throws (degenerate planes).
 * 0.1% / 99.9% ranks; if a heavy zero peak would pin lower at 0, fit on
 * positive pixels instead.
 */
function approximateAutoContrastFromUint16Histogram(
  u16: Uint16Array,
): ContrastLimits | null {
  const n = u16.length;
  if (n === 0) return null;

  const hist = new Uint32Array(65536);
  let positive = 0;
  for (let i = 0; i < n; i++) {
    const v = u16[i];
    hist[v]++;
    if (v > 0) positive++;
  }

  const zeroHeavy = hist[0] / n >= 0.001 && positive >= 64;
  const mass = zeroHeavy ? positive : n;
  const startV = zeroHeavy ? 1 : 0;

  const idxLo = Math.max(0, Math.floor(0.001 * (mass - 1)));
  const idxHi = Math.min(mass - 1, Math.ceil(0.999 * (mass - 1)));

  const valuePastSortedIndex = (idx: number): number => {
    let cum = 0;
    for (let v = startV; v < 65536; v++) {
      cum += hist[v];
      if (cum > idx) return v;
    }
    return 65535;
  };

  return sanitizeGmmLimits(
    valuePastSortedIndex(idxLo),
    valuePastSortedIndex(idxHi),
  );
}

/**
 * Fit contrast with `psudo.channel_gmm` (tri-modal log-space GMM → [min, max]).
 * Falls back to histogram percentiles if WASM throws or returns a bad pair.
 */
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
  const stats = import.meta.env.DEV ? summarizeUint16ForGmm(u16) : null;

  try {
    if (import.meta.env.DEV && stats) {
      console.log("[psudo] channel_gmm input", {
        c: sourceIndex,
        width: raster.width,
        height: raster.height,
        ...stats,
      });
    }
    const psudo = await import("psudo");
    await warmupPsudoPalette();
    const result = await psudo.channel_gmm(u16);
    if (result && result.length >= 2) {
      const limits = sanitizeGmmLimits(result[0], result[1]);
      if (limits) {
        if (import.meta.env.DEV) {
          console.log("[psudo] channel_gmm", {
            c: sourceIndex,
            pixels: u16.length,
            lower: limits.lower,
            upper: limits.upper,
          });
        }
        return limits;
      }
    } else if (import.meta.env.DEV) {
      console.log("[psudo] channel_gmm soft fail (empty result)", {
        c: sourceIndex,
        ...(stats ?? { pixels: u16.length }),
      });
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(
        `[psudo] channel_gmm failed for c=${sourceIndex}; using histogram fallback`,
        { ...(stats ?? {}), error: e },
      );
    }
  }

  const fallback = approximateAutoContrastFromUint16Histogram(u16);
  if (import.meta.env.DEV && fallback) {
    console.log("[psudo] auto contrast (histogram fallback)", {
      c: sourceIndex,
      ...(stats ?? { pixels: u16.length }),
      lower: fallback.lower,
      upper: fallback.upper,
    });
  }
  return fallback;
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
    return {
      ...sc,
      gmmContrastLimits: { lower: fit.lower, upper: fit.upper },
      lowerLimit: fit.lower,
      upperLimit: fit.upper,
    };
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

function mergeGmmIntoChannelGroups(
  groups: ChannelGroup[],
  byChannelId: Map<string, ContrastLimits>,
): ChannelGroup[] {
  if (byChannelId.size === 0 || groups.length === 0) return groups;
  let changed = false;
  const next = groups.map((g) => {
    const channels = g.channels.map((gc) => {
      const fit = byChannelId.get(gc.channelId);
      if (!fit) return gc;
      if (!looksLikeImportDefaultLimits(gc.lowerLimit, gc.upperLimit)) {
        return gc;
      }
      changed = true;
      return { ...gc, lowerLimit: fit.lower, upperLimit: fit.upper };
    });
    return { ...g, channels };
  });
  return changed ? next : groups;
}

/** Source channels that will be composited on first paint — GMM targets only these. */
export function visibleChannelIdsForGmmBeforePaint(args: {
  images: Image[];
  channelGroups?: ChannelGroup[];
  stackVisibilities?: Record<string, boolean>;
  groupRowVisibilities?: Record<string, boolean>;
  activeGroupId?: string | null;
}): Set<string> {
  const sourceChannels = flattenImageChannelsInDocumentOrder(args.images);
  const channelGroups = args.channelGroups ?? [];
  return initialPaintSourceChannelIds({
    sourceChannels,
    channelGroups,
    stackVisibilities:
      args.stackVisibilities ??
      defaultVisibilitiesForSources(sourceChannels, {}, channelGroups),
    groupRowVisibilities: args.groupRowVisibilities,
    activeGroupId: args.activeGroupId,
  });
}

/**
 * Fit `channel_gmm` for intensity channels and merge limits into images (and
 * optional channel groups) before the viewer first paints.
 */
export async function fitGmmContrastBeforePaint(args: {
  images: Image[];
  channelGroups?: ChannelGroup[];
  loaderEntries: readonly { loader: Loader; sourceImageId: string }[];
  imageKey: string;
  /** When set, only these source channels are fitted (visible on first paint). */
  visibleChannelIds?: ReadonlySet<string>;
}): Promise<{ images: Image[]; channelGroups?: ChannelGroup[] }> {
  const { loaderEntries, imageKey } = args;
  if (loaderEntries.length === 0) {
    return { images: args.images, channelGroups: args.channelGroups };
  }

  const sourceChannels = flattenImageChannelsInDocumentOrder(args.images);
  const loaderByImageId = new Map(
    loaderEntries.map((e) => [e.sourceImageId, e.loader] as const),
  );

  const byChannelId = new Map<string, ContrastLimits>();
  const byImage = new Map<string, { channelId: string; index: number }[]>();
  const visible = args.visibleChannelIds;
  for (const sc of sourceChannels) {
    if (!loaderByImageId.has(sc.imageId)) continue;
    if (!isImageChannel(sc) || sc.samples === 3) continue;
    if (visible && !visible.has(sc.id)) continue;
    if (sc.gmmContrastLimits) continue;
    const list = byImage.get(sc.imageId) ?? [];
    list.push({ channelId: sc.id, index: sc.index });
    byImage.set(sc.imageId, list);
  }

  for (const [imageId, pairs] of byImage) {
    const loader = loaderByImageId.get(imageId);
    if (!loader) continue;
    const uniqueIdx = [...new Set(pairs.map((p) => p.index))];
    const map = await ensureOmeGmmContrastLimits(
      loader,
      imageKey,
      imageId,
      uniqueIdx,
    );
    for (const p of pairs) {
      const limits = map.get(p.index);
      if (limits) byChannelId.set(p.channelId, limits);
    }
  }

  if (byChannelId.size === 0) {
    return { images: args.images, channelGroups: args.channelGroups };
  }

  const nextChannels = mergeGmmContrastLimitsIntoSourceChannelsByChannelId(
    sourceChannels,
    byChannelId,
  );
  const images =
    nextChannels === sourceChannels
      ? args.images
      : applySourceChannelsToImages(args.images, nextChannels);

  const channelGroups =
    args.channelGroups != null
      ? mergeGmmIntoChannelGroups(args.channelGroups, byChannelId)
      : undefined;

  return { images, channelGroups };
}

/** Stable cache key for an OME import before loaders are published to React state. */
export function omeImportGmmImageKey(
  fileName: string,
  sourceImageIds: readonly string[],
): string {
  return `${fileName || "ome-tiff"}\0${sourceImageIds.join("\0")}`;
}

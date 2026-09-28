/**
 * CPU-heavy histogram curve from a single-channel tile (legacy `bin` logic minus I/O).
 * Shared by the main thread (fallback) and `histogram.worker`.
 */

const HISTOGRAM_BIN_COUNT = 100 as const;

/** Skip decode/bin of tiles larger than this (4MP). */
export const MAX_HISTOGRAM_TILE_PIXELS = 4_000_000;

/** Map a positive intensity into [0, HISTOGRAM_BIN_COUNT). */
function intensityToHistogramBin(v: number, bits: number): number {
  const n = HISTOGRAM_BIN_COUNT;
  if (bits <= 8) {
    return Math.min(n - 1, Math.floor((v * n) / 2 ** bits));
  }
  return Math.min(n - 1, Math.floor((n * Math.log2(v)) / bits));
}

/** Linear bin across an explicit [min, max] span. `max` lands in the last bin. */
function binInRange(v: number, min: number, max: number): number {
  const n = HISTOGRAM_BIN_COUNT;
  const t = (v - min) / (max - min);
  return Math.min(n - 1, Math.max(0, Math.floor(t * n)));
}

/**
 * CPU histogram. Returns [] on empty / oversized tile; otherwise length
 * HISTOGRAM_BIN_COUNT. Integer bins skip v <= 0. A float `range` includes
 * every finite sample, including negatives and zeros.
 */
export function histogramBinFromPixels(
  bits: number,
  width: number,
  data: ArrayLike<number>,
  range?: { min: number; max: number } | null,
): number[] {
  const len = data.length;
  if (len === 0 || len > MAX_HISTOGRAM_TILE_PIXELS) return [];
  const spanned = range != null && range.max > range.min;

  const counts = new Array<number>(HISTOGRAM_BIN_COUNT).fill(0);
  const step = 4;
  const w = Math.max(1, width);
  for (let i = 0; i < len; i++) {
    if (i % step !== 0 && Math.floor(i / w) % step !== 0) continue;
    const v = data[i];
    if (spanned) {
      if (!Number.isFinite(v)) continue;
      counts[binInRange(v, range.min, range.max)]++;
    } else {
      if (!(v > 0)) continue;
      counts[intensityToHistogramBin(v, bits)]++;
    }
  }
  return counts;
}

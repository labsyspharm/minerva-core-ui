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

/**
 * CPU histogram. Returns [] on empty / oversized tile; otherwise length
 * HISTOGRAM_BIN_COUNT. Excludes v <= 0.
 */
export function histogramBinFromPixels(
  bits: number,
  width: number,
  data: ArrayLike<number>,
): number[] {
  const len = data.length;
  if (len === 0 || len > MAX_HISTOGRAM_TILE_PIXELS) return [];

  const counts = new Array<number>(HISTOGRAM_BIN_COUNT).fill(0);
  const step = 4;
  const w = Math.max(1, width);
  for (let i = 0; i < len; i++) {
    if (i % step !== 0 && Math.floor(i / w) % step !== 0) continue;
    const v = data[i];
    if (!(v > 0)) continue;
    counts[intensityToHistogramBin(v, bits)]++;
  }
  return counts;
}

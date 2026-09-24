/**
 * CPU-heavy histogram curve from a single-channel tile (legacy `bin` logic minus I/O).
 * Shared by the main thread (fallback) and `histogram.worker`.
 */

/** Skip decode/bin of tiles larger than this (4MP). */
export const MAX_HISTOGRAM_TILE_PIXELS = 4_000_000;

export function histogramBinFromPixels(
  bits: number,
  width: number,
  data: ArrayLike<number>,
): number[] {
  const len = data.length;
  if (len === 0 || len > MAX_HISTOGRAM_TILE_PIXELS) return [];

  const n_bins = 100;
  const seen = new Set<number>();
  const thresholds: number[] = [];
  for (let x = 0; x < n_bins; x++) {
    const t = Math.floor(2 ** ((bits * x) / n_bins));
    if (seen.has(t)) continue;
    seen.add(t);
    thresholds.push(t);
  }
  thresholds.sort((a, b) => a - b);

  const counts = new Array<number>(thresholds.length).fill(0);
  const step = 4;
  const w = Math.max(1, width);
  const nTh = thresholds.length;
  for (let i = 0; i < len; i++) {
    if (i % step !== 0 && Math.floor(i / w) % step !== 0) continue;
    const v = data[i];
    if (!(v > 0)) continue;
    let lo = 0;
    let hi = nTh;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (v <= thresholds[mid]) hi = mid;
      else lo = mid + 1;
    }
    if (lo < nTh) counts[lo]++;
  }
  return counts;
}

const HIST_BINS = 50;
const HIST_STEP = 4;

function sampleHistIndices(
  data: ArrayLike<number>,
  width: number,
  predicate: (v: number) => boolean,
): number[] {
  const len = data.length;
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    if (i % HIST_STEP !== 0 && Math.floor(i / width) % HIST_STEP !== 0) {
      continue;
    }
    if (predicate(data[i])) out.push(i);
  }
  return out;
}

/**
 * CPU-heavy histogram curve from a single-channel tile (legacy `bin` logic minus I/O).
 * Shared by the main thread (fallback) and `histogram.worker`.
 */
export function histogramBinFromPixels(
  bits: number,
  width: number,
  data: ArrayLike<number>,
): number[] {
  const max_power = bits;
  const thresholds = [
    ...new Set(
      [...new Array(HIST_BINS).keys()].map((x) => {
        return Math.floor(2 ** ((max_power * x) / HIST_BINS));
      }),
    ),
  ];
  thresholds.sort((a, b) => a - b);
  let indices = sampleHistIndices(data, width, (v) => v > 0);
  return thresholds.reduce((binned: number[], threshold, t) => {
    if (t > 0 && thresholds[t - 1] === threshold) {
      return binned.concat(binned.slice(-1));
    }
    const outside_indices = indices.filter((i) => data[i] > threshold);
    const pixel_count = indices.length - outside_indices.length;
    indices = outside_indices;
    binned.push(pixel_count);
    return binned;
  }, []);
}

/** Equal-width bins over sampled finite min…max (floats, sub-integer values). */
export function histogramLinearFromPixels(
  data: ArrayLike<number>,
  width: number,
): { yValues: number[]; min: number; max: number } {
  const indices = sampleHistIndices(data, width, Number.isFinite);
  if (indices.length === 0) {
    return { yValues: [], min: 0, max: 1 };
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const i of indices) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    max = min === 0 ? 1 : min + Math.abs(min) * 1e-6;
  }
  const span = max - min;
  const yValues = new Array<number>(HIST_BINS).fill(0);
  for (const i of indices) {
    let b = Math.floor(((data[i] - min) / span) * HIST_BINS);
    if (b >= HIST_BINS) b = HIST_BINS - 1;
    if (b < 0) b = 0;
    yValues[b] += 1;
  }
  return { yValues, min, max };
}

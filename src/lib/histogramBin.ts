/**
 * CPU-heavy histogram curve from a single-channel tile (legacy `bin` logic minus I/O).
 * Shared by the main thread (fallback) and `histogram.worker`.
 */
export function histogramBinFromPixels(
  bits: number,
  width: number,
  data: ArrayLike<number>,
): number[] {
  const n_bins = 50;
  const max_power = bits;
  const thresholds = [
    ...new Set(
      [...new Array(n_bins).keys()].map((x) => {
        return Math.floor(2 ** ((max_power * x) / n_bins));
      }),
    ),
  ];
  thresholds.sort((a, b) => a - b);
  const step = 4;
  const len = data.length;
  let indices = [...new Array(len).keys()]
    .filter((i) => i % step === 0 || Math.floor(i / width) % step === 0)
    .filter((i) => data[i] > 0);
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

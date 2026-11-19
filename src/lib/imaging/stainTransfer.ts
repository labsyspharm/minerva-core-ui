/**
 * How a stain's density reads as a fluorescence-like signal, and back.
 *
 * Optical density, −log₁₀ of the light let through, stretches the dark end:
 * a nucleus passing 10% of the light reads 1, one passing 1% reads 2, and
 * 8-bit noise grows with it. Fluorescence has no such tail. So the H&E split
 * shows each unmixed stain as the light it takes away, `1 − T^k` with
 * `T = 10^(−c)`, and an IF channel drawn as a stain is turned back into
 * density by the inverse.
 *
 * `k = 0.5` best matched deconvolved hematoxylin to the registered DNA
 * channel on two H&E + CyCIF pairs (LSP79799/LSP79801, LSP24533/LSP24534),
 * comparing tissue intensity quantiles: 2–4× closer than density itself on
 * three of four comparisons, and no worse on the fourth.
 */
export const STAIN_SIGNAL_K = 0.5;

/** `STAIN_SIGNAL_K · ln 10`, for shaders that work in natural logs. */
export const STAIN_SIGNAL_K_LN10 = STAIN_SIGNAL_K * Math.LN10;

/** IF-like signal (0…1) of a stain at log₁₀ concentration `c`. */
export function stainSignal(c: number): number {
  return 1 - 10 ** (-STAIN_SIGNAL_K * Math.max(0, c));
}

/**
 * Separated stains read as 16-bit IF channels: their signal as camera-like
 * counts, so the same log histogram, slider and limits apply. Gain and floor
 * follow the registered DNA channel on LSP79801 (DNA ≈ −756 + 10,885·signal
 * over tissue; background around 150–250). Like any IF scale, a convention:
 * DNA's 99th percentile was 6,500 there and 23,000 on LSP24534.
 */
export const STAIN_COUNTS_FLOOR = 200;
export const STAIN_COUNTS_GAIN = 10_000;
export const STAIN_COUNTS_MAX = 65_535;

/** Virtual IF counts for stain signal `signal` (0…1). */
export function stainCounts(signal: number): number {
  return STAIN_COUNTS_FLOOR + STAIN_COUNTS_GAIN * signal;
}

/** Stain signal for virtual IF counts: the inverse of `stainCounts`. */
export function signalFromCounts(counts: number): number {
  return (counts - STAIN_COUNTS_FLOOR) / STAIN_COUNTS_GAIN;
}

/**
 * Share of a stain's full density at IF signal `t` (0…1): the inverse of
 * `stainSignal`, scaled so `t = 1` is the full density. `full` is that
 * density's size in natural-log units (the length of its RGB density vector).
 */
export function stainDensityShare(t: number, full: number): number {
  const kd = STAIN_SIGNAL_K * full;
  if (!(kd > 1e-6)) return t;
  return -Math.log(1 - t * (1 - Math.exp(-kd))) / kd;
}

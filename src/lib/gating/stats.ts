import type { CellFeatureTable } from "./types";

export type ColumnHistogram = {
  bins: Uint32Array;
  binCount: number;
  min: number;
  max: number;
  sampleCount: number;
};

const DEFAULT_BINS = 256;

export function computeColumnHistogram(
  values: Float32Array,
  rowIndices: number[] | null,
  binCount = DEFAULT_BINS,
): ColumnHistogram {
  let min = Infinity;
  let max = -Infinity;
  const indices =
    rowIndices ??
    [...Array(values.length).keys()].filter((i) => Number.isFinite(values[i]));

  for (const i of indices) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    min = 0;
    max = 1;
  }

  const bins = new Uint32Array(binCount);
  const span = max - min || 1;

  for (const i of indices) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    const t = (v - min) / span;
    const b = Math.min(binCount - 1, Math.max(0, Math.floor(t * binCount)));
    bins[b]++;
  }

  let sampleCount = 0;
  for (let b = 0; b < binCount; b++) sampleCount += bins[b];

  return { bins, binCount, min, max, sampleCount };
}

/**
 * Two-component Gaussian mixture via EM (log-space values) for Auto thresholds.
 */
export function fitTwoComponentGmmThresholds(
  values: Float32Array,
  rowIndices: number[] | null,
  maxIter = 40,
): { min: number; max: number } | null {
  const samples: number[] = [];
  const indices = rowIndices ?? [...Array(values.length).keys()];
  for (const i of indices) {
    const v = values[i];
    if (Number.isFinite(v)) samples.push(v);
  }
  if (samples.length < 8) return null;

  samples.sort((a, b) => a - b);
  const n = samples.length;
  let w0 = 0.5;
  let w1 = 0.5;
  let m0 = samples[Math.floor(n * 0.25)];
  let m1 = samples[Math.floor(n * 0.75)];
  let s0 = Math.max(1e-6, (m1 - m0) / 4);
  let s1 = s0;

  for (let iter = 0; iter < maxIter; iter++) {
    let sumW0 = 0;
    let sumW1 = 0;
    let sumX0 = 0;
    let sumX1 = 0;
    let sumSq0 = 0;
    let sumSq1 = 0;

    for (const x of samples) {
      const p0 =
        (w0 * Math.exp(-0.5 * ((x - m0) / s0) ** 2)) /
        (s0 * Math.sqrt(2 * Math.PI));
      const p1 =
        (w1 * Math.exp(-0.5 * ((x - m1) / s1) ** 2)) /
        (s1 * Math.sqrt(2 * Math.PI));
      const denom = p0 + p1 + 1e-12;
      const r0 = p0 / denom;
      const r1 = p1 / denom;
      sumW0 += r0;
      sumW1 += r1;
      sumX0 += r0 * x;
      sumX1 += r1 * x;
      sumSq0 += r0 * x * x;
      sumSq1 += r1 * x * x;
    }

    if (sumW0 < 1e-6 || sumW1 < 1e-6) break;

    w0 = sumW0 / n;
    w1 = sumW1 / n;
    m0 = sumX0 / sumW0;
    m1 = sumX1 / sumW1;
    s0 = Math.max(1e-6, Math.sqrt(Math.max(1e-12, sumSq0 / sumW0 - m0 * m0)));
    s1 = Math.max(1e-6, Math.sqrt(Math.max(1e-12, sumSq1 / sumW1 - m1 * m1)));
  }

  const lo = Math.min(m0, m1);
  const hi = Math.max(m0, m1);
  const pad = (hi - lo) * 0.05;
  return { min: lo - pad, max: hi + pad };
}

export function gatingGmm(
  table: CellFeatureTable,
  column: string,
  selectionRowIndices: number[] | null,
): { min: number; max: number } | null {
  const col = table.columns.get(column);
  if (!col) return null;
  return fitTwoComponentGmmThresholds(col, selectionRowIndices);
}

export function percentileThresholds(
  values: Float32Array,
  rowIndices: number[] | null,
  loPct = 0.001,
  hiPct = 0.999,
): { min: number; max: number } | null {
  const samples: number[] = [];
  const indices = rowIndices ?? [...Array(values.length).keys()];
  for (const i of indices) {
    const v = values[i];
    if (Number.isFinite(v)) samples.push(v);
  }
  if (samples.length === 0) return null;
  samples.sort((a, b) => a - b);
  const n = samples.length;
  const iLo = Math.max(0, Math.floor(loPct * (n - 1)));
  const iHi = Math.min(n - 1, Math.ceil(hiPct * (n - 1)));
  return { min: samples[iLo], max: samples[iHi] };
}

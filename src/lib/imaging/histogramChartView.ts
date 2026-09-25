const HISTOGRAM_TRIM_FRACTION = 0.005 as const;

type HistogramChartView = {
  readonly yValues: readonly number[];
  readonly startBin: number;
  readonly scaleInput: {
    distScale: "linear" | "log";
    distMin: number;
    distMax: number;
    dtypeMax: number;
  };
};

type DistSlice = {
  YValues: readonly number[];
  XScale: string;
  LowerRange: number;
  UpperRange: number;
};

/**
 * Smallest index i where sum(y[0..i]) >= fraction * sum(y).
 * Empty leading bins add 0. If total is 0, return 0. Crossing bin stays visible.
 */
function firstTrimBin(yValues: readonly number[], fraction: number): number {
  let total = 0;
  for (const y of yValues) total += y;
  if (total === 0) return 0;
  const threshold = fraction * total;
  let sum = 0;
  for (let i = 0; i < yValues.length; i++) {
    sum += yValues[i];
    if (sum >= threshold) return i;
  }
  return 0;
}

export function resolveHistogramChartView(
  dist: DistSlice,
  opts: {
    eightBit: boolean;
    dtypeMax: number;
    expanded: boolean;
    lowerLimit: number;
  },
): HistogramChartView {
  const y = dist.YValues;
  const fullScale: "linear" | "log" = opts.eightBit
    ? "linear"
    : dist.XScale === "linear"
      ? "linear"
      : "log";
  const fullMin = opts.eightBit ? 0 : dist.LowerRange;
  const fullMax = opts.eightBit ? 255 : dist.UpperRange;
  const span = fullMax - fullMin;
  const trimAt = y.length === 0 ? 0 : firstTrimBin(y, HISTOGRAM_TRIM_FRACTION);
  const valueBin =
    y.length === 0 || span === 0
      ? 0
      : Math.min(
          y.length,
          Math.max(
            0,
            Math.floor(((opts.lowerLimit - fullMin) / span) * y.length),
          ),
        );
  const start = opts.expanded ? 0 : Math.min(trimAt, valueBin);
  const distMin =
    y.length === 0 ? fullMin : fullMin + span * (start / y.length);
  return {
    yValues: start > 0 ? y.slice(start) : y,
    startBin: start,
    scaleInput: {
      distScale: fullScale,
      distMin,
      distMax: fullMax,
      dtypeMax: opts.dtypeMax,
    },
  };
}

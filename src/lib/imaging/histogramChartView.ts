const HISTOGRAM_TRIM_FRACTION = 0.005 as const;

type HistogramChartView = {
  readonly yValues: readonly number[];
  readonly startBin: number;
  readonly scaleInput: {
    distScale: "linear" | "log";
    distMin: number;
    distMax: number;
    dtypeMin: number;
    dtypeMax: number;
  };
};

type DistSlice = {
  YValues?: readonly number[] | null;
  XScale?: string | null;
  LowerRange?: number | null;
  UpperRange?: number | null;
};

/**
 * Smallest index where the cumulative count reaches 0.5% of the total.
 * Empty leading bins add 0. If the total is 0, return 0. The crossing bin stays visible.
 */
function firstTrimBin(yValues: readonly number[]): number {
  let total = 0;
  for (const y of yValues) total += y;
  if (total === 0) return 0;
  const threshold = HISTOGRAM_TRIM_FRACTION * total;
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
    floatRange?: { min: number; max: number } | null;
    dtypeMax: number;
    expanded: boolean;
    lowerLimit: number;
  },
): HistogramChartView {
  const y = dist.YValues ?? [];
  const full =
    opts.floatRange ?? (opts.dtypeMax === 255 ? { min: 0, max: 255 } : null);
  const fullScale: "linear" | "log" =
    full || dist.XScale === "linear" ? "linear" : "log";
  const fullMin = full?.min ?? dist.LowerRange ?? 0;
  const fullMax = full?.max ?? dist.UpperRange ?? 0;
  const span = fullMax - fullMin;
  const trimAt = firstTrimBin(y);
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
      dtypeMin: full?.min ?? 0,
      dtypeMax: full?.max ?? opts.dtypeMax,
    },
  };
}

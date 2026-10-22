export type FloatRange = { min: number; max: number };

export function isFloatDtype(dtype: string | undefined): boolean {
  return dtype != null && /float/i.test(dtype);
}

/** Samples this close to 0 or 1 still count as the unit interval. */
const UNIT_INTERVAL_SLACK = 1e-3;

/**
 * A span that stays inside 0…1 (plus a little float noise) is the unit
 * interval. The slider then runs 0…1 even when the sampled max is under 1.
 */
function snapUnitInterval(range: FloatRange): FloatRange {
  if (
    range.min >= -UNIT_INTERVAL_SLACK &&
    range.max <= 1 + UNIT_INTERVAL_SLACK
  ) {
    return { min: 0, max: 1 };
  }
  return range;
}

/**
 * Min and max of finite samples. Null when there is no span
 * (no finite samples, or every finite sample is the same value).
 */
export function finiteSampleRange(
  samples: ArrayLike<number>,
): FloatRange | null {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!(max > min)) return null;
  return snapUnitInterval({ min, max });
}

/** Map a sample into 0…65535 across `range`. Non-finite → 0. */
export function quantizeFloatToUint16(v: number, range: FloatRange): number {
  if (!Number.isFinite(v)) return 0;
  const t = (v - range.min) / (range.max - range.min);
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return Math.round(x * 65535);
}

/** Inverse of {@link quantizeFloatToUint16}. */
export function dequantizeFromUint16(q: number, range: FloatRange): number {
  return range.min + (q / 65535) * (range.max - range.min);
}

/**
 * Domain for a float channel: the fit's stored span, or the histogram's
 * linear axis when that was binned first.
 */
export function channelFloatRange(channel: {
  floatRange?: { min?: number; max?: number } | null;
  sourceDataTypeId?: string;
  sourceDistribution?: {
    XScale?: string | null;
    LowerRange?: number | null;
    UpperRange?: number | null;
  } | null;
}): FloatRange | null {
  const stored = channel.floatRange;
  if (
    stored?.min != null &&
    stored.max != null &&
    Number.isFinite(stored.min) &&
    Number.isFinite(stored.max) &&
    stored.max > stored.min
  ) {
    return snapUnitInterval({ min: stored.min, max: stored.max });
  }
  if (!isFloatDtype(channel.sourceDataTypeId)) return null;
  const dist = channel.sourceDistribution;
  if (
    dist?.XScale === "linear" &&
    dist.LowerRange != null &&
    dist.UpperRange != null &&
    dist.UpperRange > dist.LowerRange
  ) {
    return snapUnitInterval({
      min: dist.LowerRange,
      max: dist.UpperRange,
    });
  }
  return null;
}

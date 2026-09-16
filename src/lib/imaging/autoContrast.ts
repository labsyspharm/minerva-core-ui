import { warmupPsudoPalette } from "@/lib/imaging/psudoPalette";

/** Auto-contrast for OME channels via `psudo.channel_gmm` (schema field still `gmmContrastLimits`). */

export type ContrastLimits = { lower: number; upper: number };

function sanitizeGmmLimits(vmin: number, vmax: number): ContrastLimits | null {
  if (!Number.isFinite(vmin) || !Number.isFinite(vmax)) return null;
  const lower = Math.max(0, Math.min(65535, Math.round(vmin)));
  const upperRaw = Math.max(0, Math.min(65535, Math.round(vmax)));
  const upper = upperRaw <= lower ? Math.min(65535, lower + 1) : upperRaw;
  if (upper <= lower) return null;
  return { lower, upper };
}

/** DEV diagnostics for why `channel_gmm` may refuse a plane. */
function summarizeUint16ForGmm(u16: Uint16Array): {
  pixels: number;
  positiveCount: number;
  uniquePositive: number;
  positiveMin: number | null;
  positiveMax: number | null;
} {
  const pixels = u16.length;
  let positiveCount = 0;
  let positiveMin = Number.POSITIVE_INFINITY;
  let positiveMax = Number.NEGATIVE_INFINITY;
  const seen = new Set<number>();
  for (let i = 0; i < pixels; i++) {
    const v = u16[i];
    if (v <= 0) continue;
    positiveCount++;
    if (v < positiveMin) positiveMin = v;
    if (v > positiveMax) positiveMax = v;
    if (seen.size < 64) seen.add(v);
  }
  return {
    pixels,
    positiveCount,
    uniquePositive: seen.size,
    positiveMin: positiveCount > 0 ? positiveMin : null,
    positiveMax: positiveCount > 0 ? positiveMax : null,
  };
}

/**
 * Fallback when `psudo.channel_gmm` returns empty / throws (degenerate planes).
 * 0.1% / 99.9% ranks; if a heavy zero peak would pin lower at 0, fit on
 * positive pixels instead.
 */
function approximateAutoContrastFromUint16Histogram(
  u16: Uint16Array,
): ContrastLimits | null {
  const n = u16.length;
  if (n === 0) return null;

  const hist = new Uint32Array(65536);
  let positive = 0;
  for (let i = 0; i < n; i++) {
    const v = u16[i];
    hist[v]++;
    if (v > 0) positive++;
  }

  const zeroHeavy = hist[0] / n >= 0.001 && positive >= 64;
  const mass = zeroHeavy ? positive : n;
  const startV = zeroHeavy ? 1 : 0;

  const idxLo = Math.max(0, Math.min(mass - 1, Math.floor(0.001 * (mass - 1))));
  const idxHi = Math.min(mass - 1, Math.ceil(0.999 * (mass - 1)));

  const valuePastSortedIndex = (idx: number): number => {
    let cum = 0;
    for (let v = startV; v < 65536; v++) {
      cum += hist[v];
      if (cum > idx) return v;
    }
    return 65535;
  };

  return sanitizeGmmLimits(
    valuePastSortedIndex(idxLo),
    valuePastSortedIndex(idxHi),
  );
}

/** Fit `channel_gmm` on an already-loaded coarsest plane. Returns null on failure. */
export async function fitChannelGmmContrastFromUint16(
  u16: Uint16Array,
): Promise<ContrastLimits | null> {
  if (u16.length === 0) return null;
  const stats = import.meta.env.DEV ? summarizeUint16ForGmm(u16) : null;

  try {
    if (import.meta.env.DEV && stats) {
      console.log("[psudo] channel_gmm input", stats);
    }
    const psudo = await import("psudo");
    await warmupPsudoPalette();
    if (import.meta.env.DEV) {
      console.log("[psudo] channel_gmm start", { pixels: u16.length });
    }
    const t0 = performance.now();
    const result = await psudo.channel_gmm(u16);
    const ms = Math.round(performance.now() - t0);
    if (result && result.length >= 2) {
      const limits = sanitizeGmmLimits(result[0], result[1]);
      if (limits) {
        if (import.meta.env.DEV) {
          console.log("[psudo] channel_gmm done", {
            ms,
            pixels: u16.length,
            lower: limits.lower,
            upper: limits.upper,
          });
        }
        return limits;
      }
    }
    if (import.meta.env.DEV) {
      console.log("[psudo] channel_gmm empty", {
        ms,
        ...(stats ?? { pixels: u16.length }),
      });
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[psudo] channel_gmm failed; using histogram fallback", {
        ...(stats ?? {}),
        error: e,
      });
    }
  }

  const fallback = approximateAutoContrastFromUint16Histogram(u16);
  if (import.meta.env.DEV && fallback) {
    console.log("[psudo] auto contrast (histogram fallback)", {
      ...(stats ?? { pixels: u16.length }),
      lower: fallback.lower,
      upper: fallback.upper,
    });
  }
  return fallback;
}

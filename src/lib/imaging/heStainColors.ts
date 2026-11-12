import { Matrix3 } from "@math.gl/core";
import {
  DEFAULT_STAIN_INVERSE,
  type GlslMat3,
  type HeStainFit,
} from "./heStainFit";
import type { RgbColor } from "./sourceChannelStyle";

/** How hematoxylin and eosin look on this slide, as colors on glass. */
export type HeStainColors = { hematoxylin: RgbColor; eosin: RgbColor };

type Vec3 = [number, number, number];

/** Each stain's log₁₀ optical density per unit concentration. */
export type HeStainVectors = { hematoxylin: Vec3; eosin: Vec3 };

type Strengths = { hematoxylin: number; eosin: number };

/** Typical H&E strengths, when the fit read no stained tissue. */
const DEFAULT_STRENGTHS: Strengths = { hematoxylin: 0.6, eosin: 0.3 };

/** The H and E rows of the stain matrix the unmixing `inverse` inverts. */
export function heStainVectors(inverse: GlslMat3): HeStainVectors {
  // Row-major [H; E; residual]; inv(Mᵀ) = inv(M)ᵀ keeps rows as rows.
  const stains = [...new Matrix3(inverse).invert()];
  return {
    hematoxylin: [stains[0], stains[1], stains[2]],
    eosin: [stains[3], stains[4], stains[5]],
  };
}

/** White glass seen through `density` (log10 OD per RGB channel). */
function colorOnGlass(density: Vec3, strength: number): RgbColor {
  const t = (k: number) =>
    Math.round(255 * 10 ** (-strength * Math.max(0, density[k])));
  return { r: t(0), g: t(1), b: t(2) };
}

/** Each stain's optical-density row of the matrix `inverse` inverts, at `strengths`. */
function heColors(inverse: GlslMat3, strengths: Strengths): HeStainColors {
  const stains = heStainVectors(inverse);
  return {
    hematoxylin: colorOnGlass(stains.hematoxylin, strengths.hematoxylin),
    eosin: colorOnGlass(stains.eosin, strengths.eosin),
  };
}

/** Reference H&E (QuPath default vectors at typical strength). */
export const DEFAULT_HE_STAIN_COLORS = heColors(
  DEFAULT_STAIN_INVERSE,
  DEFAULT_STRENGTHS,
);

/**
 * Macenko H and E colors from a slide's fit: each stain's fitted vector at a
 * high percentile of its concentration over the fit's tissue
 * (`HeStainSummary.strength`). Reference colors until there is a fit.
 */
export function heStainColorsForFit(
  fit: HeStainFit | undefined,
): HeStainColors {
  if (!fit) return DEFAULT_HE_STAIN_COLORS;
  return heColors(fit.glslInverse, {
    hematoxylin:
      fit.stains?.hematoxylin.strength ?? DEFAULT_STRENGTHS.hematoxylin,
    eosin: fit.stains?.eosin.strength ?? DEFAULT_STRENGTHS.eosin,
  });
}

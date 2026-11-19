/**
 * Session view model for separating an H&E image into its stains (UI + paint
 * uniforms). Kept separate from the TileLayer / GLSL module so store and
 * channel UI do not import deck.gl shader code.
 */

import { STAIN_COUNTS_FLOOR, stainCounts } from "@/lib/imaging/stainTransfer";

/**
 * The two stains, and the residual: absorption neither explains (dust, pen,
 * dark debris), along the H–E plane's normal.
 */
export type HeDeconvComponent = "hematoxylin" | "eosin" | "residual";

export const HE_DECONV_COMPONENTS: readonly HeDeconvComponent[] = [
  "hematoxylin",
  "eosin",
  "residual",
];

export const HE_DECONV_LABELS: Record<HeDeconvComponent, string> = {
  hematoxylin: "Hematoxylin",
  eosin: "Eosin",
  residual: "Residual",
};

/**
 * How separated stains draw. Fluorescence converts each stain's density to an
 * IF-like signal (`stainSignal`) and glows on black; brightfield draws each
 * stain's own density on white glass, as the slide was scanned.
 */
export type HeSplitMode = "fluorescence" | "brightfield";

/**
 * One separated stain. Color and window are its fluorescence settings; the
 * window is in virtual 16-bit IF counts (`stainCounts`).
 */
export type HeStainView = {
  color: [number, number, number];
  lower: number;
  upper: number;
  visible: boolean;
  /** The window still follows the slide's fit; set until the user moves it. */
  autoContrast?: true;
};

/** An RGB H&E source separated into its stains and residual, and how they draw. */
export type HeDeconvSplit = Record<HeDeconvComponent, HeStainView> & {
  mode: HeSplitMode;
};

const DEFAULT_HE_STAIN: Record<HeDeconvComponent, HeStainView> = {
  hematoxylin: {
    color: [0, 90, 255],
    lower: STAIN_COUNTS_FLOOR,
    upper: stainCounts(1),
    visible: true,
    autoContrast: true,
  },
  eosin: {
    color: [255, 56, 140],
    lower: STAIN_COUNTS_FLOOR,
    upper: stainCounts(1),
    visible: true,
    autoContrast: true,
  },
  // Shown: brightfield needs it for an exact rebuild of the scan; as
  // fluorescence it is what lies off the stains (debris, pen).
  residual: {
    color: [210, 210, 210],
    lower: STAIN_COUNTS_FLOOR,
    upper: stainCounts(1),
    visible: true,
    autoContrast: true,
  },
};

/** Freshly separated stains draw as brightfield, looking as scanned. */
export function defaultHeDeconvSplit(): HeDeconvSplit {
  return {
    mode: "brightfield",
    hematoxylin: { ...DEFAULT_HE_STAIN.hematoxylin },
    eosin: { ...DEFAULT_HE_STAIN.eosin },
    residual: { ...DEFAULT_HE_STAIN.residual },
  };
}

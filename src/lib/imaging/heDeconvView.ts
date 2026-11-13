/**
 * Session view model for separating an H&E image into its stains (UI + paint
 * uniforms). Kept separate from the TileLayer / GLSL module so store and
 * channel UI do not import deck.gl shader code.
 */

export type HeDeconvComponent = "hematoxylin" | "eosin";

export const HE_DECONV_COMPONENTS: readonly HeDeconvComponent[] = [
  "hematoxylin",
  "eosin",
];

export const HE_DECONV_LABELS: Record<HeDeconvComponent, string> = {
  hematoxylin: "Hematoxylin",
  eosin: "Eosin",
};

/**
 * How separated stains draw. Fluorescence converts each stain's density to an
 * IF-like signal (`stainSignal`) and glows on black; brightfield draws each
 * stain's own density on white glass, as the slide was scanned.
 */
export type HeSplitMode = "fluorescence" | "brightfield";

/** Integer contrast sliders map a stain's IF-like signal (`stainSignal`, 0–1) → 0–1000. */
export const HE_CONTRAST_SCALE = 1000;

/** One separated stain. Color and window are its fluorescence settings. */
export type HeStainView = {
  color: [number, number, number];
  lower: number;
  upper: number;
  visible: boolean;
  /** The window still follows the slide's fit; set until the user moves it. */
  autoContrast?: true;
};

/** An RGB H&E source separated into its two stains, and how they draw. */
export type HeDeconvSplit = Record<HeDeconvComponent, HeStainView> & {
  mode: HeSplitMode;
};

const DEFAULT_HE_STAIN: Record<HeDeconvComponent, HeStainView> = {
  hematoxylin: {
    color: [0, 90, 255],
    lower: 0,
    upper: HE_CONTRAST_SCALE,
    visible: true,
    autoContrast: true,
  },
  eosin: {
    color: [255, 56, 140],
    lower: 0,
    upper: HE_CONTRAST_SCALE,
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
  };
}

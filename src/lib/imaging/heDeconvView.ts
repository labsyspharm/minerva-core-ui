/**
 * Session view model for H&E stain split (UI + paint uniforms).
 * Kept separate from the TileLayer / GLSL module so store and channel UI
 * do not import deck.gl shader code.
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

/** Integer contrast sliders map concentration [0, 1] → 0–1000, same as IF 16-bit sliders. */
export const HE_CONTRAST_SCALE = 1000;

export type HeStainView = {
  color: [number, number, number];
  lower: number;
  upper: number;
  visible: boolean;
};

/** RGB H&E source split into two IF-style stain channels. */
export type HeDeconvSplit = Record<HeDeconvComponent, HeStainView>;

const DEFAULT_HE_STAIN: Record<HeDeconvComponent, HeStainView> = {
  hematoxylin: {
    color: [0, 90, 255],
    lower: 0,
    upper: HE_CONTRAST_SCALE,
    visible: true,
  },
  eosin: {
    color: [255, 56, 140],
    lower: 0,
    upper: HE_CONTRAST_SCALE,
    visible: true,
  },
};

export function defaultHeDeconvSplit(): HeDeconvSplit {
  return {
    hematoxylin: { ...DEFAULT_HE_STAIN.hematoxylin },
    eosin: { ...DEFAULT_HE_STAIN.eosin },
  };
}

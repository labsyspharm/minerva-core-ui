import type { Image } from "@/lib/stores/documentSchema";

/** In-flight image opacity while the slider is down; committed on release. */
export type ImageOpacityPreview = {
  imageId: string;
  opacity: number;
};

/** Missing or non-finite values are fully opaque. */
export function clampImageOpacity(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export function opacityForImage(
  images: Image[] | undefined,
  sourceImageId: string | undefined,
  preview: ImageOpacityPreview | null | undefined,
): number {
  if (preview && sourceImageId && preview.imageId === sourceImageId) {
    return clampImageOpacity(preview.opacity);
  }
  const image = sourceImageId
    ? images?.find((im) => im.id === sourceImageId)
    : undefined;
  return clampImageOpacity(image?.opacity);
}

/**
 * Deck.gl 9 stores `layer.opacity` as `pow(opacity, 1/2.2)` and BitmapLayer
 * multiplies by that uniform; pass the inverse to keep the slider linear.
 * Viv's XRLayer ignores that uniform and uses `opacity` as-is.
 */
export function bitmapLayerOpacity(linear: number): number {
  return linear ** 2.2;
}

/**
 * Extra layer props when an image is not fully opaque.
 * Full opacity returns `{}` so existing blend setup is unchanged.
 * `overlay` is an additive fluorescence layer (src factor `one`).
 */
export function imageFadeParameters(overlay: boolean, opacity: number) {
  if (opacity >= 1) return {};
  if (overlay) {
    return {
      parameters: {
        blend: true,
        blendColorOperation: "add",
        blendAlphaOperation: "add",
        blendColorSrcFactor: "src-alpha",
        blendColorDstFactor: "one",
        blendAlphaSrcFactor: "src-alpha",
        blendAlphaDstFactor: "one",
      },
    };
  }
  return {
    refinementStrategy: "no-overlap",
    parameters: {
      blend: true,
      blendColorOperation: "add",
      blendAlphaOperation: "add",
      blendColorSrcFactor: "src-alpha",
      blendColorDstFactor: "one-minus-src-alpha",
      blendAlphaSrcFactor: "one",
      blendAlphaDstFactor: "one-minus-src-alpha",
    },
  };
}

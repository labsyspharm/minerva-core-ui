import type { Image, ImageOrientation } from "@/lib/stores/documentSchema";

/** Wrap degrees into (−180, 180] for the dial / text field. */
export function wrapDisplayDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (Math.abs(d) < 1e-9) return 0;
  if (d <= -180 + 1e-9) return 180;
  return d;
}

type PlacementInput = Partial<ImageOrientation> | null | undefined;

function finiteScale(n: number | undefined): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 1;
}

/** Normalize placement. `scaleX` / `scaleY` are µm/px copied from the image. */
export function effectiveOrientation(o: PlacementInput): ImageOrientation {
  return {
    rotationDegrees: wrapDisplayDeg(o?.rotationDegrees ?? 0),
    flipHorizontal: o?.flipHorizontal ?? false,
    flipVertical: o?.flipVertical ?? false,
    scaleX: finiteScale(o?.scaleX),
    scaleY: finiteScale(o?.scaleY),
  };
}

/** Replace rotation or a flip. */
export function withOrientation(
  o: PlacementInput,
  patch: Partial<
    Pick<
      ImageOrientation,
      "rotationDegrees" | "flipHorizontal" | "flipVertical"
    >
  >,
): ImageOrientation {
  return effectiveOrientation({ ...o, ...patch });
}

export function isIdentityOrientation(o: PlacementInput): boolean {
  const c = effectiveOrientation(o);
  return c.rotationDegrees === 0 && !c.flipHorizontal && !c.flipVertical;
}

export function orientationForImage(
  images: Image[] | undefined,
  sourceImageId: string | undefined,
  preview:
    | { imageId: string; orientation: ImageOrientation }
    | null
    | undefined,
): ImageOrientation | undefined {
  if (!sourceImageId) return undefined;
  if (preview?.imageId === sourceImageId) return preview.orientation;
  const image = images?.find((im) => im.id === sourceImageId);
  return image ? effectiveOrientation(image) : undefined;
}

import type { Image, ImageOrientation } from "@/lib/stores/documentSchema";

/** Wrap degrees into (−180, 180] for the dial / text field. */
export function wrapDisplayDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (Object.is(d, -0) || Math.abs(d) < 1e-9) return 0;
  if (d <= -180 + 1e-9) return 180;
  return d;
}

type PlacementInput = Partial<ImageOrientation> | null | undefined;

/**
 * Fold both-flips into +180° so the dial never reads 0° while the image is
 * upside-down. Scale multipliers are left alone.
 */
export function effectiveOrientation(o: PlacementInput): ImageOrientation {
  let rotationDegrees = o?.rotationDegrees ?? 0;
  let flipHorizontal = o?.flipHorizontal ?? false;
  let flipVertical = o?.flipVertical ?? false;
  if (flipHorizontal && flipVertical) {
    rotationDegrees += 180;
    flipHorizontal = false;
    flipVertical = false;
  }
  const scaleX = o?.scaleX ?? 1;
  const scaleY = o?.scaleY ?? 1;
  return {
    rotationDegrees: wrapDisplayDeg(rotationDegrees),
    flipHorizontal,
    flipVertical,
    scaleX: Number.isFinite(scaleX) && scaleX !== 0 ? scaleX : 1,
    scaleY: Number.isFinite(scaleY) && scaleY !== 0 ? scaleY : 1,
  };
}

/** Fields to persist. Defaults are stored: 0°, no flips, scale 1. */
export function orientationFields(o: PlacementInput): Partial<Image> {
  const c = effectiveOrientation(o);
  return {
    rotationDegrees: c.rotationDegrees,
    flipHorizontal: c.flipHorizontal,
    flipVertical: c.flipVertical,
    scaleX: c.scaleX,
    scaleY: c.scaleY,
  };
}

export function isIdentityOrientation(o: PlacementInput): boolean {
  const c = effectiveOrientation(o);
  return (
    c.rotationDegrees === 0 &&
    !c.flipHorizontal &&
    !c.flipVertical &&
    Math.abs(c.scaleX - 1) < 1e-9 &&
    Math.abs(c.scaleY - 1) < 1e-9
  );
}

export function withRotationDelta(
  o: PlacementInput,
  deltaDeg: number,
): ImageOrientation {
  const cur = effectiveOrientation(o);
  return effectiveOrientation({
    ...cur,
    rotationDegrees: cur.rotationDegrees + deltaDeg,
  });
}

export function withFlipHorizontal(o: PlacementInput): ImageOrientation {
  const cur = effectiveOrientation(o);
  return effectiveOrientation({
    ...cur,
    flipHorizontal: !cur.flipHorizontal,
  });
}

export function withFlipVertical(o: PlacementInput): ImageOrientation {
  const cur = effectiveOrientation(o);
  return effectiveOrientation({
    ...cur,
    flipVertical: !cur.flipVertical,
  });
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

export function withRotationDeg(
  o: PlacementInput,
  rotationDegrees: number,
): ImageOrientation {
  const cur = effectiveOrientation(o);
  return effectiveOrientation({ ...cur, rotationDegrees });
}

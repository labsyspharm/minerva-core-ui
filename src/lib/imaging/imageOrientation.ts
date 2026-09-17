import type { ImageOrientation } from "@/lib/stores/documentSchema";

export const IDENTITY_ORIENTATION: ImageOrientation = {
  rotationDeg: 0,
  flipHorizontal: false,
  flipVertical: false,
};

/** Wrap degrees into (−180, 180] for the dial / text field. */
export function wrapDisplayDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (Object.is(d, -0) || Math.abs(d) < 1e-9) return 0;
  if (d <= -180 + 1e-9) return 180;
  return d;
}

/**
 * Fold both-flips into +180° so the dial never reads 0° while the image is
 * upside-down. Source-space flips otherwise stay as stored flags.
 */
export function canonicalizeOrientation(o: ImageOrientation): ImageOrientation {
  let { rotationDeg, flipHorizontal, flipVertical } = o;
  if (flipHorizontal && flipVertical) {
    rotationDeg += 180;
    flipHorizontal = false;
    flipVertical = false;
  }
  return {
    rotationDeg: wrapDisplayDeg(rotationDeg),
    flipHorizontal,
    flipVertical,
  };
}

export function isIdentityOrientation(
  o: ImageOrientation | null | undefined,
): boolean {
  if (!o) return true;
  const c = canonicalizeOrientation(o);
  return Math.abs(c.rotationDeg) < 1e-9 && !c.flipHorizontal && !c.flipVertical;
}

/** Persistable form: `undefined` when identity (omit from document JSON). */
export function orientationOrOmit(
  o: ImageOrientation | null | undefined,
): ImageOrientation | undefined {
  if (!o) return undefined;
  const c = canonicalizeOrientation(o);
  return isIdentityOrientation(c) ? undefined : c;
}

export function effectiveOrientation(
  o: ImageOrientation | null | undefined,
): ImageOrientation {
  if (!o) return IDENTITY_ORIENTATION;
  return canonicalizeOrientation(o);
}

export function withRotationDelta(
  o: ImageOrientation | null | undefined,
  deltaDeg: number,
): ImageOrientation {
  const cur = effectiveOrientation(o);
  return canonicalizeOrientation({
    ...cur,
    rotationDeg: cur.rotationDeg + deltaDeg,
  });
}

export function withFlipHorizontal(
  o: ImageOrientation | null | undefined,
): ImageOrientation {
  const cur = effectiveOrientation(o);
  return canonicalizeOrientation({
    ...cur,
    flipHorizontal: !cur.flipHorizontal,
  });
}

export function withFlipVertical(
  o: ImageOrientation | null | undefined,
): ImageOrientation {
  const cur = effectiveOrientation(o);
  return canonicalizeOrientation({
    ...cur,
    flipVertical: !cur.flipVertical,
  });
}

export function withRotationDeg(
  o: ImageOrientation | null | undefined,
  rotationDeg: number,
): ImageOrientation {
  const cur = effectiveOrientation(o);
  return canonicalizeOrientation({ ...cur, rotationDeg });
}

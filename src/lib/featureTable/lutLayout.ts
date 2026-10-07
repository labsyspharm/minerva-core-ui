/** WebGL2 guarantees MAX_TEXTURE_SIZE ≥ 2048. */
const LUT_MAX_DIM = 2048;
const INDEX_TEX_MAX = LUT_MAX_DIM * LUT_MAX_DIM;

/** R8 class index. 0 = unnamed. ponytail: 255 names. Upgrade: r16uint. */
export const MAX_CLASS_NAMES = 255;

/** Width is 4-byte aligned so R8 rows satisfy UNPACK_ALIGNMENT. */
export function indexTexSize(
  count: number,
): { width: number; height: number } | null {
  const n = Math.max(1, count | 0);
  if (n > INDEX_TEX_MAX) return null;
  let width = Math.min(LUT_MAX_DIM, n);
  width = Math.max(4, (width + 3) & ~3);
  return { width, height: Math.max(1, Math.ceil(n / width)) };
}

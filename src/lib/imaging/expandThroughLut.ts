/**
 * No imports: `workers/decoder.worker.ts` uses this too, and
 * `cubeRootEncoding` would pull the document schema into the worker.
 */

/** Widen decoded JPEG bytes through a `u8ToU16Lut` table. */
export function expandThroughLut(
  data: ArrayLike<number>,
  lut: Uint16Array,
): Uint16Array<ArrayBuffer> {
  const out = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = lut[data[i] & 0xff];
  }
  return out;
}

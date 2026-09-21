/**
 * QuPath GuiTools.estimateImageType dark/light heuristic.
 * 25/220 of 8-bit max, scaled to 2^bitsPerSample-1 (never the buffer max).
 * More near-white than near-black → brightfield.
 */

export function isBrightfieldRgb(
  data: ArrayLike<number>,
  bitsPerSample = 8,
): boolean {
  const sampleMax =
    data instanceof Uint8Array || data instanceof Uint8ClampedArray
      ? 255
      : 2 ** Math.max(1, Math.floor(bitsPerSample) || 8) - 1;
  const dark = (25 / 255) * sampleMax;
  const light = (220 / 255) * sampleMax;
  const nPixels = Math.floor(data.length / 3);
  const stride = Math.max(1, Math.ceil(nPixels / 10_000));
  let nDark = 0;
  let nLight = 0;
  let nSampled = 0;
  for (let i = 0; i + 2 < data.length; i += 3 * stride) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    nSampled += 1;
    if (r < dark && g < dark && b < dark) nDark += 1;
    else if (r > light && g > light && b > light) nLight += 1;
  }
  const brightfield = nLight > nDark && nDark + nLight > 0;
  console.info("[minerva] rgb detect: high/low pixels", {
    nDark,
    nLight,
    nMid: nSampled - nDark - nLight,
    nSampled,
    nPixels,
    stride,
    dark,
    light,
    sampleMax,
    bitsPerSample,
    dtype: data.constructor?.name,
    brightfield,
  });
  return brightfield;
}

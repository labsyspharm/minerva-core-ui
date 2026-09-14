/**
 * QuPath GuiTools.estimateImageType dark/light heuristic on 8-bit RGB.
 * More near-white (r,g,b > 220) than near-black (< 25) → brightfield.
 */

export function isBrightfieldRgb(data: ArrayLike<number>): boolean {
  let nDark = 0;
  let nLight = 0;
  for (let i = 0; i + 2 < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 25 && g < 25 && b < 25) nDark += 1;
    else if (r > 220 && g > 220 && b > 220) nLight += 1;
  }
  return nLight > nDark && nDark + nLight > 0;
}

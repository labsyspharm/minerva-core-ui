import type { z } from "zod";
import type { ClassVisibilitySchema } from "@/lib/stores/documentSchema";

/** Six colors for cell-outline random coloring (CPU + GPU bitmask shader). */
export const CELL_OUTLINE_RGB = [
  [82, 249, 0], // #52f900
  [0, 251, 255], // #00fbff
  [255, 0, 40], // #ff0028
  [255, 188, 0], // #ffbc00
  [145, 169, 255], // #91a9ff
  [255, 0, 255], // #ff00ff
] as const;

/** Same XOR palette index as the mask fragment shader `randomColor`. */
export function defaultClassColor(
  classId: number,
  colorSeed: number,
): { r: number; g: number; b: number } {
  const i = ((classId ^ colorSeed) >>> 0) % CELL_OUTLINE_RGB.length;
  const [r, g, b] = CELL_OUTLINE_RGB[i];
  return { r, g, b };
}

export type ClassVisibility = z.infer<typeof ClassVisibilitySchema>;

export type MaskGpuStyle = {
  /** R8, class index per cell id. 0 = unnamed. */
  index: Uint8Array;
  width: number;
  height: number;
  /** RGBA8, row of class colors. Texel 0 unused. */
  palette: Uint8Array;
  missHidden: boolean;
  indexRev: string;
  rev: string;
};

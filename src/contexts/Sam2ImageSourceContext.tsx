/**
 * Context to provide SAM2 image fetcher to magic wand tool.
 */

import * as React from "react";
import type { ViewRect } from "@/lib/samViewport";

export type GetCropForSam2 = (viewRect: ViewRect) => Promise<{
  float32Array: Float32Array;
  shape: [number, number, number, number];
}>;

export const Sam2ImageSourceContext =
  React.createContext<GetCropForSam2 | null>(null);

export function useSam2ImageSource(): GetCropForSam2 | null {
  return React.useContext(Sam2ImageSourceContext);
}

/**
 * GPU gating overlay (BitmapLayer + custom shader).
 * Primary rendering uses CPU colormap in `gatingMaskLayers.ts`; this layer remains
 * for future texture-uniform parity with Gater frag.glsl.
 */
import { BitmapLayer } from "@deck.gl/layers";

export class GatingLabelBitmapLayer extends BitmapLayer {
  static layerName = "GatingLabelBitmapLayer";
}

export type { GatingLabelLayerProps } from "./GatingLabelLayerTypes";

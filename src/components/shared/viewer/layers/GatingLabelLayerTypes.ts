import type { BitmapLayer } from "@deck.gl/layers";
import type { GatingTexturePack } from "@/lib/gating/gatingTextures";
import type { GateDefinition, GatingDrawMode } from "@/lib/gating/types";

export type GatingLabelLayerProps = BitmapLayer["props"] & {
  texturePack: GatingTexturePack;
  gates: GateDefinition[];
  drawMode: GatingDrawMode;
  evalAnd: boolean;
};

import type { Layer } from "@deck.gl/core";
import { MaskExtension } from "@deck.gl/extensions";
import { BitmapLayer } from "@hms-dbmi/viv";

/**
 * Viv draws packed-RGB tiles (H&E) through its BitmapLayer and creates those
 * tile layers with `extensions: []`, which drops a MaskExtension set on the
 * MultiscaleImageLayer above them. The `maskId` still arrives, so put the
 * extension back. Import once for the side effect.
 */
const MASK_EXTENSIONS = [new MaskExtension()];

type VivBitmapThis = { props: { maskId?: string; extensions?: unknown[] } };

const proto = BitmapLayer.prototype as unknown as {
  renderLayers: (this: VivBitmapThis) => Layer | null;
};
const vivRenderLayers = proto.renderLayers;
proto.renderLayers = function () {
  const layer = vivRenderLayers.call(this);
  if (!layer || !this.props.maskId || this.props.extensions?.length) {
    return layer;
  }
  return layer.clone({ extensions: MASK_EXTENSIONS } as never);
};

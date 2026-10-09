import { XRLayer } from "@hms-dbmi/viv";

/**
 * Viv samples tiles below full resolution with LINEAR filtering, which it
 * gets by copying them into 32-bit float textures. Many iOS devices cannot
 * filter float textures (no `OES_texture_float_linear`), so those tiles draw
 * black. Every Viv tile samples NEAREST instead: no float copy, half the
 * texture memory, and the same path on every device. Import once for the
 * side effect.
 */
type XRLayerThis = { props: { interpolation?: string } };

const proto = XRLayer.prototype as unknown as Record<
  "getShaders" | "dataToTexture",
  (this: XRLayerThis, ...args: unknown[]) => unknown
>;

for (const method of ["getShaders", "dataToTexture"] as const) {
  const viv = proto[method];
  proto[method] = function (...args) {
    if (this.props.interpolation !== "linear") return viv.apply(this, args);
    // Props are frozen: hand Viv a view of the layer that reads "nearest".
    const props = Object.create(this.props, {
      interpolation: { value: "nearest" },
    });
    return viv.apply(Object.create(this, { props: { value: props } }), args);
  };
}

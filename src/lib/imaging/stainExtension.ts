import type { Layer } from "@deck.gl/core";
import { VivLayerExtension } from "@hms-dbmi/viv";

/**
 * Lowest transmittance a picked stain color may ask for. A pure hue has a 0
 * component, which would be infinite optical density.
 */
export const STAIN_TRANSMITTANCE_FLOOR = 0.05;

type Rgb = readonly [number, number, number];

/**
 * Optical density per RGB channel that turns white glass into `color`
 * (0–255) at full signal. Beer–Lambert: transmittance is `exp(-density)`.
 */
export function stainDensity(color: Rgb): [number, number, number] {
  const od = (v: number) =>
    -Math.log(Math.max(STAIN_TRANSMITTANCE_FLOOR, v / 255));
  return [od(color[0]), od(color[1]), od(color[2])];
}

/** `background` (0–255) seen through `color` at signal `c` (`0…1`), as the shader draws it. */
export function stainOver(
  background: Rgb,
  color: Rgb,
  c: number,
): [number, number, number] {
  const od = stainDensity(color);
  const t = (i: 0 | 1 | 2) => Math.round(background[i] * Math.exp(-c * od[i]));
  return [t(0), t(1), t(2)];
}

/** Typical brightfield colors a stain lands on, for the color picker preview. */
export const STAIN_PREVIEW_BACKGROUNDS: { label: string; rgb: Rgb }[] = [
  { label: "Glass", rgb: [255, 255, 255] },
  { label: "Eosin", rgb: [236, 158, 199] },
  { label: "Hematoxylin", rgb: [86, 64, 145] },
];

/** Expanded once per channel by Viv's shader assembler. */
const CHANNEL = "VIV_CHANNEL_INDEX";
const moduleName = "stainModule";

const fs = `uniform ${moduleName}Uniforms {
  float opacity;
  vec3 density${CHANNEL};
} ${moduleName};

vec4 stain_transmittance(float[NUM_CHANNELS] intensity) {
  vec3 densities[NUM_CHANNELS] = vec3[NUM_CHANNELS](
    ${moduleName}.density${CHANNEL},
  );
  vec3 od = vec3(0.);
  for (int i = 0; i < NUM_CHANNELS; i++) {
    od += clamp(intensity[i], 0., 1.) * densities[i];
  }
  float a = ${moduleName}.opacity;
  return vec4(exp(-od) * a, a);
}
`;

const stainModule = {
  name: moduleName,
  uniformTypes: {
    opacity: "f32",
    [`density${CHANNEL}`]: "vec3<f32>",
  },
  fs,
  inject: {
    "fs:DECKGL_MUTATE_COLOR": "rgba = stain_transmittance(intensity);",
  },
};

type StainLayerProps = {
  colors?: number[][];
  channelsVisible?: boolean[];
  selections?: unknown[];
  opacity?: number;
};

/**
 * Replaces Viv's additive palette: each channel is a stain whose color at
 * full signal is its channel color, and the layer outputs premultiplied
 * transmittance `exp(-Σ cᵢ·ODᵢ)`. Pair with {@link stainLayerParameters} so
 * it multiplies whatever is drawn below (H&E).
 */
export class StainExtension extends VivLayerExtension {
  static extensionName = "StainExtension";

  getVivShaderTemplates() {
    return { modules: [stainModule] };
  }

  /** Deck calls this with `this` bound to the layer (base class is a no-op). */
  updateState(this: Layer) {
    const props = this.props as StainLayerProps;
    const { colors = [], channelsVisible = [], opacity = 1 } = props;
    const uniforms: Record<string, number | number[]> = { opacity };
    const n = props.selections?.length ?? colors.length;
    for (let i = 0; i < n; i++) {
      const color = colors[i];
      uniforms[`density${i}`] =
        channelsVisible[i] !== false && color
          ? stainDensity([color[0], color[1], color[2]])
          : [0, 0, 0];
    }
    for (const model of this.getModels()) {
      model.shaderInputs.setProps({ [moduleName]: uniforms });
    }
  }
}

/** Shared so deck sees the same `extensions` array across renders. */
export const STAIN_EXTENSIONS = [new StainExtension()];

/**
 * Blend state for a stain layer. Over something: `dst · mix(1, T, α)`,
 * from premultiplied `(T·α, α)`. Nothing below: plain premultiplied over,
 * so the stains show on the (transparent → page) background like glass.
 */
export function stainLayerParameters(somethingBelow: boolean) {
  return {
    refinementStrategy: "no-overlap" as const,
    parameters: somethingBelow
      ? {
          blend: true,
          blendColorOperation: "add",
          blendColorSrcFactor: "dst",
          blendColorDstFactor: "one-minus-src-alpha",
          blendAlphaOperation: "add",
          blendAlphaSrcFactor: "zero",
          blendAlphaDstFactor: "one",
        }
      : {
          blend: true,
          blendColorOperation: "add",
          blendColorSrcFactor: "one",
          blendColorDstFactor: "one-minus-src-alpha",
          blendAlphaOperation: "add",
          blendAlphaSrcFactor: "one",
          blendAlphaDstFactor: "one-minus-src-alpha",
        },
  };
}

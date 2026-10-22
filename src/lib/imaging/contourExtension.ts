import { padColorsForUBO, VivLayerExtension } from "@hms-dbmi/viv";

/** Expanded per channel by Viv (`VIV_CHANNEL_INDEX`). */
const CHANNEL = "VIV_CHANNEL_INDEX";

/** Default isolines across the contrast window. */
export const CONTOUR_LEVELS_DEFAULT = 8;
export const CONTOUR_LEVELS_MAX = 16;

/**
 * Smoothing radius steps, in full-resolution image pixels. Powers of two, so
 * each step lands on a pyramid level (see `contourTiles`).
 */
export const CONTOUR_SMOOTHING_STEPS = [2, 4, 8, 16, 32, 64, 128];
export const CONTOUR_SMOOTHING_DEFAULT = 16;

/**
 * Edge buffer stitched around each contour tile, in texels of the sampled
 * level. It is also the kernel's largest radius: the kernel reads this far
 * past the tile edge, so a bigger kernel needs a bigger buffer.
 */
export const CONTOUR_APRON = 4;
/** Smallest kernel radius in sampled texels; below it lines follow single texels. */
export const CONTOUR_MIN_RADIUS = 1.5;

/**
 * KDE-style isolines. Each fragment evaluates a smoothed field (a compact
 * `(1 - r²/R²)³` kernel, normalized) and its analytic gradient, then draws
 * the nearest level by distance `|s - t| / |∇s|`. The field is smooth, so the
 * lines are curves, and tiles agree at their seams because each texture
 * carries `CONTOUR_APRON` texels from its neighbors.
 */
const contourModule = {
  name: "contourModule",
  uniformTypes: {
    opacity: "f32",
    levels: "f32",
    radius: "f32",
    tileWindow: "vec4<f32>",
    [`color${CHANNEL}`]: "vec3<f32>",
  },
  fs: `uniform contourModuleUniforms {
  float opacity;
  float levels;
  float radius;
  vec4 tileWindow;
  vec3 color${CHANNEL};
} contourModule;

// Coverage of the isoline nearest to s (0..1 across the contrast window),
// given its gradient per texel.
float contour_line(float s, vec2 grad, float texelsPerPx) {
  // n lines split the contrast window into n + 1 equal bands.
  float bands = contourModule.levels + 1.0;
  float u = s * bands;
  float k = clamp(floor(u + 0.5), 1.0, contourModule.levels);
  float distPx = abs(u - k) / max(length(grad) * bands, 1e-6) / texelsPerPx;
  return 1.0 - smoothstep(0.75, 1.75, distPx);
}
`,
};

/** Every field is set: the contour layer passes colors and visibility, `defaultProps` the rest. */
type ContourHost = {
  props: Partial<{
    colors: [number, number, number][];
    channelsVisible: boolean[];
    contourLevels: number;
    contourRadius: number;
    contourWindow: [number, number, number, number];
    opacity: number;
  }>;
  getModels(): {
    shaderInputs: { setProps(props: Record<string, unknown>): void };
  }[];
};

const perChannel = (n: number, line: (i: number) => string) =>
  Array.from({ length: n }, (_, i) => line(i)).join("\n");

/**
 * One kernel pass for all channels: the weights depend only on position, so
 * each tap computes them once and accumulates every channel's sample.
 * Contrast limits are XRLayer's own `channelIntensity` uniforms.
 */
function mainStart(n: number): string {
  // tileWindow.xy: tile origin inside the buffered texture; .zw: tile extent.
  return `vec2 contourC = contourModule.tileWindow.xy + vTexCoord * contourModule.tileWindow.zw - 0.5;
float contourPx = max(0.5 * (length(dFdx(contourC)) + length(dFdy(contourC))), 1e-4);
ivec2 contourI = ivec2(floor(contourC));
int contourReach = int(ceil(contourModule.radius));
float contourInv = 1.0 / (contourModule.radius * contourModule.radius);
float contourSw = 0.0;
vec2 contourSgw = vec2(0.0);
${perChannel(n, (i) => `float contourSv${i} = 0.0;\nvec2 contourSgv${i} = vec2(0.0);`)}
for (int dy = 1 - contourReach; dy <= contourReach; dy++) {
  for (int dx = 1 - contourReach; dx <= contourReach; dx++) {
    ivec2 q = contourI + ivec2(dx, dy);
    vec2 r = vec2(q) - contourC;
    float x = dot(r, r) * contourInv;
    if (x >= 1.0) continue;
    float m = 1.0 - x;
    float w = m * m * m;
    vec2 gw = 6.0 * m * m * contourInv * r;
    contourSw += w;
    contourSgw += gw;
${perChannel(
  n,
  (i) => `    float v${i} = float(texelFetch(channel${i}, q, 0).r);
    contourSv${i} += w * v${i};
    contourSgv${i} += gw * v${i};`,
)}
  }
}
vec3 contourRgb = vec3(0.0);
${perChannel(
  n,
  (i) => `{
  vec2 lim = channelIntensity.contrastLimits${i};
  float span = 1.0 / max(0.0005, lim.y - lim.x);
  float raw = contourSv${i} / contourSw;
  vec2 grad = (contourSgv${i} - raw * contourSgw) / contourSw * span;
  contourRgb += contour_line((raw - lim.x) * span, grad, contourPx) * contourModule.color${i};
}`,
)}
fragColor = vec4(min(contourRgb, vec3(1.0)), contourModule.opacity);
`;
}

/**
 * Replaces `ColorPaletteExtension` on a contour layer from
 * `withContourLayers`: every channel on it is drawn as isolines.
 */
class ContourExtension extends VivLayerExtension {
  static extensionName = "ContourExtension";
  static defaultProps = {
    contourLevels: {
      type: "number",
      value: CONTOUR_LEVELS_DEFAULT,
      compare: true,
    },
    contourRadius: { type: "number", value: CONTOUR_MIN_RADIUS, compare: true },
    contourWindow: { type: "array", value: [0, 0, 1, 1], compare: true },
  };

  // Sampler uniforms live on the layer shader, so the per-channel code is
  // injected into main rather than into the module preamble.
  getVivShaderTemplates(this: { getNumChannels?: () => number }) {
    const n = this.getNumChannels?.() ?? 0;
    if (n < 1) return { modules: [] };
    return {
      modules: [
        {
          ...contourModule,
          inject: { "fs:#main-start": mainStart(n) },
        },
      ],
    };
  }

  updateState(this: ContourHost) {
    const { colors, channelsVisible, opacity } = this.props;
    if (!colors?.length) return;
    const padded = padColorsForUBO({
      colors: colors as never,
      channelsVisible,
    }) as unknown as [number, number, number][];
    const contour: Record<string, unknown> = {
      opacity,
      levels: this.props.contourLevels,
      radius: this.props.contourRadius,
      tileWindow: this.props.contourWindow,
    };
    for (let i = 0; i < colors.length; i++) contour[`color${i}`] = padded[i];
    for (const model of this.getModels()) {
      model.shaderInputs.setProps({ contourModule: contour });
    }
  }
}

export const contourExtension = new ContourExtension();

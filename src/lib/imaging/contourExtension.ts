import {
  expandShaderModule,
  getDefaultPalette,
  padColorsForUBO,
  VivLayerExtension,
} from "@hms-dbmi/viv";

/** Expanded per channel by Viv (`VIV_CHANNEL_INDEX`). */
const CHANNEL = "VIV_CHANNEL_INDEX";

const LEVELS = 8;

/**
 * Isolines through bilinear cell crossings, so neighboring pixels share endpoints.
 *
 * ponytail: the cell on a tile boundary has no neighbor texel, so a line can
 * still break on the tile grid. A 1-texel halo in the tile texture would close it.
 */
const contourModule = {
  name: "contourModule",
  uniformTypes: {
    opacity: "f32",
    [`contour${CHANNEL}`]: "f32",
    [`contrastLimits${CHANNEL}`]: "vec2<f32>",
    [`color${CHANNEL}`]: "vec3<f32>",
  },
  fs: `uniform contourModuleUniforms {
  float opacity;
  float contour${CHANNEL};
  vec2 contrastLimits${CHANNEL};
  vec3 color${CHANNEL};
} contourModule;

float norm_raw(float raw, vec2 limits) {
  return clamp((raw - limits.x) / max(0.0005, limits.y - limits.x), 0.0, 1.0);
}

float norm_texel(highp SAMPLER_TYPE chan, vec2 limits, ivec2 coord, ivec2 size) {
  ivec2 c = clamp(coord, ivec2(0), size - ivec2(1));
  return norm_raw(float(texelFetch(chan, c, 0).r), limits);
}

float segment_dist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float denom = dot(ab, ab);
  float h = denom > 0.0 ? clamp(dot(p - a, ab) / denom, 0.0, 1.0) : 0.0;
  return length(p - (a + ab * h));
}

bool edge_crosses(float a, float b, float t) {
  return (a < t && b >= t) || (b < t && a >= t);
}

float level_dist(vec2 f, float t, float v00, float v10, float v01, float v11) {
  bool cb = edge_crosses(v00, v10, t);
  bool cr = edge_crosses(v10, v11, t);
  bool ct = edge_crosses(v01, v11, t);
  bool cl = edge_crosses(v00, v01, t);
  vec2 pb = vec2(cb ? (t - v00) / (v10 - v00) : 0.0, 0.0);
  vec2 pr = vec2(1.0, cr ? (t - v10) / (v11 - v10) : 0.0);
  vec2 pt = vec2(ct ? (t - v01) / (v11 - v01) : 0.0, 1.0);
  vec2 pl = vec2(0.0, cl ? (t - v00) / (v01 - v00) : 0.0);
  int n = int(cb) + int(cr) + int(ct) + int(cl);
  if (n < 2) return 1e3;
  if (n == 4) {
    float mid = 0.25 * (v00 + v10 + v01 + v11);
    if ((mid >= t) == (v00 >= t)) {
      return min(segment_dist(f, pb, pl), segment_dist(f, pr, pt));
    }
    return min(segment_dist(f, pb, pr), segment_dist(f, pl, pt));
  }
  float dist = 1e3;
  if (cb && cr) dist = min(dist, segment_dist(f, pb, pr));
  if (cb && ct) dist = min(dist, segment_dist(f, pb, pt));
  if (cb && cl) dist = min(dist, segment_dist(f, pb, pl));
  if (cr && ct) dist = min(dist, segment_dist(f, pr, pt));
  if (cr && cl) dist = min(dist, segment_dist(f, pr, pl));
  if (ct && cl) dist = min(dist, segment_dist(f, pt, pl));
  return dist;
}

float contour_channel(highp SAMPLER_TYPE chan, vec2 limits, vec2 uv, float texelsPerPx) {
  ivec2 size = textureSize(chan, 0);
  vec2 p = uv * vec2(size) - 0.5;
  ivec2 i0 = ivec2(floor(p));
  vec2 f = p - vec2(i0);
  float v00 = norm_texel(chan, limits, i0, size);
  float v10 = norm_texel(chan, limits, i0 + ivec2(1, 0), size);
  float v01 = norm_texel(chan, limits, i0 + ivec2(0, 1), size);
  float v11 = norm_texel(chan, limits, i0 + ivec2(1, 1), size);
  float best = 1e3;
  for (int k = 1; k <= ${LEVELS}; k++) {
    best = min(best, level_dist(f, float(k) / float(${LEVELS}), v00, v10, v01, v11));
  }
  return 1.0 - smoothstep(1.25, 2.25, best / texelsPerPx);
}

void accum_channel(
  inout vec3 rgb,
  highp SAMPLER_TYPE chan,
  vec2 limits,
  vec3 color,
  vec2 uv,
  float texelsPerPx,
  float contour
) {
  if (contour > 0.5) {
    rgb += contour_channel(chan, limits, uv, texelsPerPx) * color;
  } else {
    rgb += norm_raw(float(texture(chan, uv).r), limits) * color;
  }
}
`,
};

type ShaderHost = {
  getNumChannels?: () => number;
};

type ContourHost = {
  props: {
    colors?: [number, number, number][] | null;
    channelsVisible?: boolean[] | null;
    contrastLimits?: [number, number][] | null;
    contourEnabled?: number[] | null;
    opacity?: number;
    selections?: unknown[] | null;
  };
  getModels(): {
    shaderInputs: { setProps(props: Record<string, unknown>): void };
  }[];
};

function mainStart(numChannels: number): string {
  const calls = Array.from(
    { length: numChannels },
    (_, i) =>
      `accum_channel(contourRgb, channel${i}, contourModule.contrastLimits${i}, contourModule.color${i}, vTexCoord, contourPx, contourModule.contour${i});`,
  ).join("\n");
  return `float contourPx = max(
  length(vec2(dFdx(vTexCoord.x), dFdy(vTexCoord.x))) * float(textureSize(channel0, 0).x),
  length(vec2(dFdx(vTexCoord.y), dFdy(vTexCoord.y))) * float(textureSize(channel0, 0).y)
);
contourPx = max(contourPx, 1e-4);
vec3 contourRgb = vec3(0.0);
${calls}
fragColor = vec4(min(contourRgb, vec3(1.0)), contourModule.opacity);
`;
}

/** Replaces `ColorPaletteExtension` while any channel on the layer uses contours. */
class ContourExtension extends VivLayerExtension {
  static extensionName = "ContourExtension";
  static defaultProps = {
    contourEnabled: { type: "array", value: [] as number[], compare: true },
  };

  getVivShaderTemplates() {
    return { modules: [contourModule] };
  }

  // Sampler uniforms live on the layer shader, so the per-channel calls are
  // injected into main rather than into the module preamble.
  getShaders(this: ShaderHost) {
    const n = this.getNumChannels?.() ?? 0;
    if (n < 1) return { modules: [] };
    return {
      modules: [
        expandShaderModule(
          {
            ...contourModule,
            inject: { "fs:#main-start": mainStart(n) },
          } as never,
          n,
        ),
      ],
    };
  }

  updateState(this: ContourHost) {
    const selections = this.props.selections ?? [];
    const numChannels = selections.length;
    if (numChannels < 1) return;
    const colors =
      this.props.colors ??
      (getDefaultPalette(numChannels) as unknown as [number, number, number][]);
    const channelsVisible =
      this.props.channelsVisible ?? colors.map(() => true);
    const padded = padColorsForUBO({
      colors: colors as never,
      channelsVisible,
    }) as unknown as [number, number, number][];
    const limits = this.props.contrastLimits ?? [];
    const enabled = this.props.contourEnabled ?? [];
    const contour: Record<string, unknown> = {
      opacity: this.props.opacity ?? 1,
    };
    for (let i = 0; i < numChannels; i++) {
      const pair = limits[i];
      contour[`contrastLimits${i}`] = pair ? [pair[0], pair[1]] : [0, 1];
      contour[`color${i}`] = padded[i];
      contour[`contour${i}`] = enabled[i] ? 1 : 0;
    }
    for (const model of this.getModels()) {
      model.shaderInputs.setProps({ contourModule: contour });
    }
  }
}

export const contourExtension = new ContourExtension();

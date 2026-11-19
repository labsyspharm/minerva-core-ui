import type { Layer } from "@deck.gl/core";
import { COORDINATE_SYSTEM, picking, project32 } from "@deck.gl/core";
import { DTYPE_VALUES } from "@hms-dbmi/viv";
import type { Matrix4 } from "@math.gl/core";
import {
  defaultHeDeconvSplit,
  type HeSplitMode,
  type HeStainView,
} from "@/lib/imaging/heDeconvView";
import { heStainVectors } from "@/lib/imaging/heStainColors";
import {
  DEFAULT_STAIN_INVERSE,
  type GlslMat3,
  rgb8ScaleFromDtype,
} from "@/lib/imaging/heStainFit";
import { imageFadeParameters } from "@/lib/imaging/imageOpacity";
import type {
  SupportedDtype,
  SupportedTypedArray,
} from "@/lib/imaging/loaderTypes";
import {
  createLoaderPyramidTileLayer,
  layerGetShaders,
  XRLayerBase,
} from "@/lib/imaging/pyramidTileLayer";
import {
  STAIN_SIGNAL_K_LN10,
  signalFromCounts,
} from "@/lib/imaging/stainTransfer";
import type { Loader } from "@/lib/imaging/viv";

type HeTileData = {
  data: SupportedTypedArray[];
  width: number;
  height: number;
};

const HE_VS = `#version 300 es
#define SHADER_NAME he-deconv-layer-vertex-shader

in vec2 texCoords;
in vec3 positions;
in vec3 positions64Low;
in vec3 instancePickingColors;
out vec2 vTexCoord;

void main(void) {
  geometry.worldPosition = positions;
  geometry.uv = texCoords;
  geometry.pickingColor = instancePickingColors;
  gl_Position = project_position_to_clipspace(positions, positions64Low, vec3(0.), geometry.position);
  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
  vTexCoord = texCoords;
  vec4 color = vec4(0.);
  DECKGL_FILTER_COLOR(color, geometry);
}
`;

// As the stain-deconvolution fiddle (and he_deconv.ipynb, but for the residual):
//   optical_density(rgb8) = max(0, -log10(max(rgb8, 1) / 255))
//   STAIN_MATRIX rows = unit(H), unit(E), unit(H × E) (as scikit-image)
//   concentrations = od @ inv(STAIN_MATRIX)
// GLSL columns = numpy rows so `M * v` == `v @ M`. As fluorescence, each stain
// then shows as the light it takes away, 1 - 10^(-k·c) (stainTransfer.ts),
// before its window. As brightfield, its own density darkens white glass.
const HE_FS = `#version 300 es
#define SHADER_NAME he-deconv-layer-fragment-shader

precision highp float;
precision highp int;
precision highp SAMPLER_TYPE;

uniform SAMPLER_TYPE channel0;
uniform SAMPLER_TYPE channel1;
uniform SAMPLER_TYPE channel2;

in vec2 vTexCoord;
out vec4 fragColor;

const float LN10 = 2.302585092994046;
const float BACKGROUND = 255.0;
const float STAIN_SIGNAL_K_LN10 = ${STAIN_SIGNAL_K_LN10.toFixed(7)};

float samplePlane(SAMPLER_TYPE plane, vec2 uv) {
  return float(texture(plane, uv).r);
}

vec3 optical_density(vec3 rgb8) {
  return max(vec3(0.0), -log(max(rgb8, vec3(1.0)) / BACKGROUND) / LN10);
}

float stain_signal(float conc) {
  return 1.0 - exp(-STAIN_SIGNAL_K_LN10 * max(conc, 0.0));
}

float windowed(float raw, vec2 contrast) {
  return clamp((raw - contrast.x) / max(contrast.y - contrast.x, 1.0e-6), 0.0, 1.0);
}

void main() {
  vec3 rgb8 = vec3(
    samplePlane(channel0, vTexCoord),
    samplePlane(channel1, vTexCoord),
    samplePlane(channel2, vTexCoord)
  ) * heDeconv.uToRgb8;
  vec3 conc = heDeconv.uStainInverse * optical_density(rgb8);
  vec3 rgb;
  if (heDeconv.uBrightfield > 0.5) {
    // Signed, not clamped: amounts below zero are real corrections (the
    // residual off the H–E plane goes both ways). All three together rebuild
    // the scan; glass caps at white.
    vec3 od =
      conc.x * heDeconv.uHStain +
      conc.y * heDeconv.uEStain +
      conc.z * heDeconv.uRStain;
    rgb = min(exp(-LN10 * od), vec3(1.0));
  } else {
    rgb =
      windowed(stain_signal(conc.x), heDeconv.uHContrast) * heDeconv.uHColor +
      windowed(stain_signal(conc.y), heDeconv.uEContrast) * heDeconv.uEColor +
      windowed(stain_signal(conc.z), heDeconv.uRContrast) * heDeconv.uRColor;
  }
  fragColor = vec4(rgb, heDeconv.opacity);

  geometry.uv = vTexCoord;
  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;

/** luma.gl 9.3: custom uniforms live in a UBO module, not `model.setUniforms`. */
const heDeconv = {
  name: "heDeconv",
  fs: `\
uniform heDeconvUniforms {
  float uToRgb8;
  vec2 uHContrast;
  vec2 uEContrast;
  vec2 uRContrast;
  vec3 uHColor;
  vec3 uEColor;
  vec3 uRColor;
  mat3 uStainInverse;
  float opacity;
  float uBrightfield;
  vec3 uHStain;
  vec3 uEStain;
  vec3 uRStain;
} heDeconv;
`,
  uniformTypes: {
    uToRgb8: "f32",
    uHContrast: "vec2<f32>",
    uEContrast: "vec2<f32>",
    uRContrast: "vec2<f32>",
    uHColor: "vec3<f32>",
    uEColor: "vec3<f32>",
    uRColor: "vec3<f32>",
    uStainInverse: "mat3x3<f32>",
    opacity: "f32",
    uBrightfield: "f32",
    uHStain: "vec3<f32>",
    uEStain: "vec3<f32>",
    uRStain: "vec3<f32>",
  },
};

const HE_XR_PROPS = {
  // Same as every Viv tile (vivNearestSampling): textures keep the dtype's
  // integer format; linear would need float textures many iOS GPUs can't filter.
  interpolation: "nearest",
  channelsVisible: [true, true, true],
  contrastLimits: [
    [0, 1],
    [0, 1],
    [0, 1],
  ],
  coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
  pickable: false,
  opacity: 1,
} as const;

/** GLSL sampler for Viv's nearest-sampled texture of `dtype` (see DTYPE_VALUES). */
function heSamplerType(dtype: unknown): string {
  return (
    DTYPE_VALUES[dtype as SupportedDtype]?.sampler ?? DTYPE_VALUES.Uint8.sampler
  );
}

function stainContrast(stain: HeStainView): [number, number] {
  return [signalFromCounts(stain.lower), signalFromCounts(stain.upper)];
}

function stainColor(stain: HeStainView): [number, number, number] {
  if (!stain.visible) return [0, 0, 0];
  return [stain.color[0] / 255, stain.color[1] / 255, stain.color[2] / 255];
}

type Vec3 = [number, number, number];

const NO_STAIN: Vec3 = [0, 0, 0];
const DEFAULT_STAIN = defaultHeDeconvSplit();
const DEFAULT_H_COLOR = stainColor(DEFAULT_STAIN.hematoxylin);
const DEFAULT_E_COLOR = stainColor(DEFAULT_STAIN.eosin);
const DEFAULT_R_COLOR = stainColor(DEFAULT_STAIN.residual);
const DEFAULT_VECTORS = heStainVectors(DEFAULT_STAIN_INVERSE);

class HeDeconvXrLayer extends XRLayerBase {
  static layerName = "HeDeconvXrLayer";
  static defaultProps = {
    ...HE_XR_PROPS,
    uToRgb8: 1,
    uHContrast: [0, 1],
    uEContrast: [0, 1],
    uRContrast: [0, 1],
    uHColor: DEFAULT_H_COLOR,
    uEColor: DEFAULT_E_COLOR,
    uRColor: DEFAULT_R_COLOR,
    uStainInverse: DEFAULT_STAIN_INVERSE,
    uBrightfield: 0,
    uHStain: DEFAULT_VECTORS.hematoxylin,
    uEStain: DEFAULT_VECTORS.eosin,
    uRStain: DEFAULT_VECTORS.residual,
  };

  getNumChannels() {
    return 3;
  }

  getNumPlanes() {
    return 1;
  }

  getShaders() {
    return layerGetShaders.call(this, {
      vs: HE_VS,
      fs: HE_FS,
      modules: [project32, picking, heDeconv],
      // Sampler must match the texture XRLayer.dataToTexture made for this
      // dtype (Uint8 → r8uint → usampler2D), or every draw is GL_INVALID_OPERATION.
      // VivShaderAssembler hook signatures use float[NUM_CHANNELS]; XRLayer
      // normally injects these via expandShaderModule, which this subclass skips.
      defines: {
        SAMPLER_TYPE: heSamplerType(this.props.dtype),
        NUM_CHANNELS: "3",
        NUM_PLANES: "1",
      },
    });
  }

  updateState(params: unknown) {
    super.updateState(params);
    const { model } = this.state;
    if (!model) return;
    const props = this.props as typeof this.props & {
      uToRgb8: number;
      uHContrast: [number, number];
      uEContrast: [number, number];
      uRContrast: [number, number];
      uHColor: Vec3;
      uEColor: Vec3;
      uRColor: Vec3;
      uStainInverse: GlslMat3;
      uBrightfield: number;
      uHStain: Vec3;
      uEStain: Vec3;
      uRStain: Vec3;
    };
    model.shaderInputs.setProps({
      heDeconv: {
        uToRgb8: props.uToRgb8 ?? 1,
        uHContrast: props.uHContrast ?? [0, 1],
        uEContrast: props.uEContrast ?? [0, 1],
        uRContrast: props.uRContrast ?? [0, 1],
        uHColor: props.uHColor ?? DEFAULT_H_COLOR,
        uEColor: props.uEColor ?? DEFAULT_E_COLOR,
        uRColor: props.uRColor ?? DEFAULT_R_COLOR,
        uStainInverse: props.uStainInverse ?? DEFAULT_STAIN_INVERSE,
        opacity: this.props.opacity ?? 1,
        uBrightfield: props.uBrightfield ?? 0,
        uHStain: props.uHStain ?? DEFAULT_VECTORS.hematoxylin,
        uEStain: props.uEStain ?? DEFAULT_VECTORS.eosin,
        uRStain: props.uRStain ?? DEFAULT_VECTORS.residual,
      },
    });
  }
}

/** Deinterleave RGB for XRLayer textures. Unmixing happens in the fragment shader. */
function splitInterleavedRgb(
  data: SupportedTypedArray,
  width: number,
  height: number,
): SupportedTypedArray[] | null {
  const n = width * height;
  if (n <= 0 || data.length < n * 3) return null;
  const Ctor = data.constructor as {
    new (length: number): SupportedTypedArray;
  };
  const r = new Ctor(n);
  const g = new Ctor(n);
  const b = new Ctor(n);
  for (let i = 0; i < n; i++) {
    const s = i * 3;
    r[i] = data[s];
    g[i] = data[s + 1];
    b[i] = data[s + 2];
  }
  return [r, g, b];
}

/**
 * Hematoxylin, eosin and residual in one TileLayer. Mode/color/contrast/visibility are
 * uniforms so one RGB fetch covers both stains (avoids additive LOD flash).
 */
export function createHeDeconvLayer(args: {
  id: string;
  loader: Loader;
  parentIndex: number;
  mode: HeSplitMode;
  hematoxylin: HeStainView;
  eosin: HeStainView;
  residual: HeStainView;
  overlay: boolean;
  /** `layerModelMatrix` for the image, like its Viv layer. */
  modelMatrix: Matrix4;
  /** Image opacity (`opacityForImage`), 0–1. */
  opacity: number;
  stainInverse?: GlslMat3;
}): Layer | null {
  const planes = args.loader.data;
  if (!planes?.length) return null;
  const finest = planes[0];
  const parentIndex = args.parentIndex;
  const dtype = finest.dtype;
  const uToRgb8 = rgb8ScaleFromDtype(dtype);
  const uHContrast = stainContrast(args.hematoxylin);
  const uEContrast = stainContrast(args.eosin);
  const uRContrast = stainContrast(args.residual);
  const uHColor = stainColor(args.hematoxylin);
  const uEColor = stainColor(args.eosin);
  const uRColor = stainColor(args.residual);
  const uStainInverse = args.stainInverse ?? DEFAULT_STAIN_INVERSE;
  const uBrightfield = args.mode === "brightfield" ? 1 : 0;
  const vectors = heStainVectors(uStainInverse);
  const uHStain = args.hematoxylin.visible ? vectors.hematoxylin : NO_STAIN;
  const uEStain = args.eosin.visible ? vectors.eosin : NO_STAIN;
  const uRStain = args.residual.visible ? vectors.residual : NO_STAIN;
  // Opaque: best-available covers holes. Additive: no-overlap or LODs flash 2×.
  const { overlay, opacity } = args;
  const refinementStrategy =
    overlay || opacity < 1 ? "no-overlap" : "best-available";
  // Match createMultiscaleLayer: additive onto earlier images, faded by alpha.
  const parameters =
    opacity < 1
      ? imageFadeParameters(overlay, opacity).parameters
      : overlay
        ? {
            blendColorOperation: "add",
            blendAlphaOperation: "add",
            blendColorSrcFactor: "one",
            blendColorDstFactor: "one",
            blendAlphaSrcFactor: "one",
            blendAlphaDstFactor: "one",
          }
        : undefined;

  return createLoaderPyramidTileLayer<HeTileData>({
    id: args.id,
    planes,
    modelMatrix: args.modelMatrix,
    refinementStrategy,
    updateTriggers: {
      getTileData: [parentIndex],
      renderSubLayers: [
        dtype,
        uToRgb8,
        ...uHContrast,
        ...uEContrast,
        ...uRContrast,
        ...uHColor,
        ...uEColor,
        ...uRColor,
        ...uStainInverse,
        uBrightfield,
        ...uHStain,
        ...uEStain,
        ...uRStain,
        opacity,
        overlay,
        args.modelMatrix,
      ],
    },
    getTileData: async ({ plane, x, y, signal }) => {
      const tile = await plane.getTile({
        x,
        y,
        selection: { t: 0, z: 0, c: parentIndex },
        signal,
      });
      if (!tile?.data?.length || tile.width <= 0 || tile.height <= 0) {
        return null;
      }
      const split = splitInterleavedRgb(tile.data, tile.width, tile.height);
      if (!split) return null;
      return { data: split, width: tile.width, height: tile.height };
    },
    renderSubLayer: ({
      subLayerProps,
      layerId,
      tileData,
      bounds,
      tileId,
      modelMatrix,
    }) =>
      new HeDeconvXrLayer({
        // Carries the selection-mask extension and its `maskId` to each tile.
        ...subLayerProps,
        id: `${layerId}-xr-${tileId}`,
        channelData: tileData,
        bounds,
        modelMatrix,
        dtype,
        uToRgb8,
        uHContrast,
        uEContrast,
        uRContrast,
        uHColor,
        uEColor,
        uRColor,
        uStainInverse,
        uBrightfield,
        uHStain,
        uEStain,
        uRStain,
        ...HE_XR_PROPS,
        opacity,
        ...(parameters ? { parameters } : {}),
      }) as unknown as Layer,
  });
}

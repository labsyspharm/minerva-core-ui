import type { Layer } from "@deck.gl/core";
import { COORDINATE_SYSTEM, picking, project32 } from "@deck.gl/core";
import { DTYPE_VALUES } from "@hms-dbmi/viv";
import type { Matrix4 } from "@math.gl/core";
import {
  defaultHeDeconvSplit,
  HE_CONTRAST_SCALE,
  type HeStainView,
} from "@/lib/imaging/heDeconvView";
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
import { planeSize } from "@/lib/imaging/loaderTypes";
import {
  ADDITIVE_BLEND_PARAMETERS,
  createLoaderPyramidTileLayer,
  layerGetShaders,
  XRLayerBase,
} from "@/lib/imaging/pyramidTileLayer";
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

// Direct translation of he_deconv.ipynb:
//   optical_density(rgb8) = max(0, -log10(max(rgb8, 1) / 255))
//   STAIN_MATRIX rows = unit(H), unit(E), unit(H × E)
//   concentrations = od @ inv(STAIN_MATRIX)
// GLSL columns = numpy rows so `M * v` == `v @ M`.
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

float samplePlane(SAMPLER_TYPE plane, vec2 uv) {
  return float(texture(plane, uv).r);
}

vec3 optical_density(vec3 rgb8) {
  return max(vec3(0.0), -log(max(rgb8, vec3(1.0)) / BACKGROUND) / LN10);
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
  vec3 rgb =
    windowed(conc.x, heDeconv.uHContrast) * heDeconv.uHColor +
    windowed(conc.y, heDeconv.uEContrast) * heDeconv.uEColor;
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
  vec3 uHColor;
  vec3 uEColor;
  mat3 uStainInverse;
  float opacity;
} heDeconv;
`,
  uniformTypes: {
    uToRgb8: "f32",
    uHContrast: "vec2<f32>",
    uEContrast: "vec2<f32>",
    uHColor: "vec3<f32>",
    uEColor: "vec3<f32>",
    uStainInverse: "mat3x3<f32>",
    opacity: "f32",
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
  return [stain.lower / HE_CONTRAST_SCALE, stain.upper / HE_CONTRAST_SCALE];
}

function stainColor(stain: HeStainView): [number, number, number] {
  if (!stain.visible) return [0, 0, 0];
  return [stain.color[0] / 255, stain.color[1] / 255, stain.color[2] / 255];
}

const DEFAULT_STAIN = defaultHeDeconvSplit();
const DEFAULT_H_COLOR = stainColor(DEFAULT_STAIN.hematoxylin);
const DEFAULT_E_COLOR = stainColor(DEFAULT_STAIN.eosin);

class HeDeconvXrLayer extends XRLayerBase {
  static layerName = "HeDeconvXrLayer";
  static defaultProps = {
    ...HE_XR_PROPS,
    uToRgb8: 1,
    uHContrast: [0, 1],
    uEContrast: [0, 1],
    uHColor: DEFAULT_H_COLOR,
    uEColor: DEFAULT_E_COLOR,
    uStainInverse: DEFAULT_STAIN_INVERSE,
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
      uHColor: [number, number, number];
      uEColor: [number, number, number];
      uStainInverse: GlslMat3;
    };
    model.shaderInputs.setProps({
      heDeconv: {
        uToRgb8: props.uToRgb8 ?? 1,
        uHContrast: props.uHContrast ?? [0, 1],
        uEContrast: props.uEContrast ?? [0, 1],
        uHColor: props.uHColor ?? DEFAULT_H_COLOR,
        uEColor: props.uEColor ?? DEFAULT_E_COLOR,
        uStainInverse: props.uStainInverse ?? DEFAULT_STAIN_INVERSE,
        opacity: this.props.opacity ?? 1,
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
 * Hematoxylin + eosin in one TileLayer. Color/contrast/visibility are uniforms
 * so one RGB fetch covers both stains (avoids additive LOD flash).
 */
export function createHeDeconvLayer(args: {
  id: string;
  loader: Loader;
  parentIndex: number;
  hematoxylin: HeStainView;
  eosin: HeStainView;
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
  const { width: planeW, height: planeH } = planeSize(finest);
  if (planeW <= 0 || planeH <= 0) return null;
  const parentIndex = args.parentIndex;
  const dtype = finest.dtype;
  const uToRgb8 = rgb8ScaleFromDtype(dtype);
  const uHContrast = stainContrast(args.hematoxylin);
  const uEContrast = stainContrast(args.eosin);
  const uHColor = stainColor(args.hematoxylin);
  const uEColor = stainColor(args.eosin);
  const uStainInverse = args.stainInverse ?? DEFAULT_STAIN_INVERSE;
  // Opaque: best-available covers holes. Additive: no-overlap or LODs flash 2×.
  const { overlay, opacity } = args;
  const refinementStrategy =
    overlay || opacity < 1 ? "no-overlap" : "best-available";
  // Match createMultiscaleLayer: additive onto earlier images, faded by alpha.
  const parameters =
    opacity < 1
      ? imageFadeParameters(overlay, opacity).parameters
      : overlay
        ? ADDITIVE_BLEND_PARAMETERS
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
        ...uHColor,
        ...uEColor,
        ...uStainInverse,
        opacity,
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
    renderSubLayer: ({ layerId, tileData, bounds, tileId, modelMatrix }) =>
      new HeDeconvXrLayer({
        id: `${layerId}-xr-${tileId}`,
        channelData: tileData,
        bounds,
        modelMatrix,
        dtype,
        uToRgb8,
        uHContrast,
        uEContrast,
        uHColor,
        uEColor,
        uStainInverse,
        ...HE_XR_PROPS,
        opacity,
        ...(parameters ? { parameters } : {}),
      }) as unknown as Layer,
  });
}

import type { Layer } from "@deck.gl/core";
import { COORDINATE_SYSTEM, picking, project32 } from "@deck.gl/core";
import {
  DEFAULT_MASK_VISUALIZATION,
  type MaskVisualization,
} from "@/lib/imaging/channelKind";
import type { SupportedTypedArray } from "@/lib/imaging/loaderTypes";
import { planeSize } from "@/lib/imaging/loaderTypes";
import {
  createLoaderPyramidTileLayer,
  layerGetShaders,
  XRLayerBase,
} from "@/lib/imaging/pyramidTileLayer";
import type { Loader } from "@/lib/imaging/viv";

type MaskTileData = {
  data: Uint32Array[];
  width: number;
  height: number;
};

const MASK_VS = `#version 300 es
#define SHADER_NAME mask-bitmask-layer-vertex-shader

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

// XRLayer binds channel0; only channel0 is used for labels.
const MASK_FS = `#version 300 es
#define SHADER_NAME mask-bitmask-layer-fragment-shader

precision highp float;
precision highp int;
precision highp SAMPLER_TYPE;

uniform SAMPLER_TYPE channel0;

in vec2 vTexCoord;
out vec4 fragColor;

uint hashLabel(uint x) {
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}

vec3 randomColor(uint label) {
  uint h = hashLabel(label ^ uint(maskViz.uColorSeed));
  return vec3(
    float(50u + (h & 0x9fu)) / 255.0,
    float(50u + ((h >> 8u) & 0x9fu)) / 255.0,
    float(50u + ((h >> 16u) & 0x9fu)) / 255.0
  );
}

bool isInteriorEdge(uint label, vec2 coord) {
  uint n = uint(texture(channel0, coord + vec2(0.0, maskViz.uTexelSize.y)).r);
  uint s = uint(texture(channel0, coord - vec2(0.0, maskViz.uTexelSize.y)).r);
  uint e = uint(texture(channel0, coord + vec2(maskViz.uTexelSize.x, 0.0)).r);
  uint w = uint(texture(channel0, coord - vec2(maskViz.uTexelSize.x, 0.0)).r);
  return n != label || s != label || e != label || w != label;
}

void main() {
  uint label = uint(texture(channel0, vTexCoord).r);
  if (label == 0u) discard;
  if (maskViz.uOutline != 0 && !isInteriorEdge(label, vTexCoord)) discard;

  vec3 rgb = maskViz.uRandomColors != 0 ? randomColor(label) : vec3(1.0);
  float a = (maskViz.uOutline != 0 ? 235.0 : 200.0) / 255.0;
  fragColor = vec4(rgb, a * maskViz.opacity);

  geometry.uv = vTexCoord;
  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;

const BITMASK_PROPS = {
  dtype: "Uint32",
  interpolation: "nearest",
  channelsVisible: [true],
  contrastLimits: [[0, 1]],
  coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
  pickable: false,
  opacity: 1,
} as const;

/** luma.gl 9.3: custom uniforms live in a UBO module, not `model.setUniforms`. */
const maskViz = {
  name: "maskViz",
  fs: `\
uniform maskVizUniforms {
  int uOutline;
  int uRandomColors;
  float uColorSeed;
  vec2 uTexelSize;
  float opacity;
} maskViz;
`,
  uniformTypes: {
    uOutline: "i32",
    uRandomColors: "i32",
    uColorSeed: "f32",
    uTexelSize: "vec2<f32>",
    opacity: "f32",
  },
};

class MaskBitmaskLayer extends XRLayerBase {
  static layerName = "MaskBitmaskLayer";
  static defaultProps = {
    ...BITMASK_PROPS,
    visualization: DEFAULT_MASK_VISUALIZATION,
  };

  getNumChannels() {
    return 1;
  }

  getNumPlanes() {
    return 1;
  }

  getShaders() {
    return layerGetShaders.call(this, {
      vs: MASK_VS,
      fs: MASK_FS,
      modules: [project32, picking, maskViz],
      // VivShaderAssembler hook signatures use float[NUM_CHANNELS]; XRLayer
      // normally injects these via expandShaderModule, which this subclass skips.
      defines: {
        SAMPLER_TYPE: "usampler2D",
        NUM_CHANNELS: "1",
        NUM_PLANES: "1",
      },
    });
  }

  updateState(params: unknown) {
    super.updateState(params);
    const { model } = this.state;
    if (!model) return;
    const channelData = this.props.channelData as MaskTileData | undefined;
    const w = Math.max(1, channelData?.width ?? 1);
    const h = Math.max(1, channelData?.height ?? 1);
    const viz =
      (this.props.visualization as MaskVisualization | undefined) ??
      DEFAULT_MASK_VISUALIZATION;
    model.shaderInputs.setProps({
      maskViz: {
        uOutline: viz.style === "outline" ? 1 : 0,
        uRandomColors: viz.color === "random" ? 1 : 0,
        uColorSeed: viz.colorSeed ?? 0,
        uTexelSize: [1 / w, 1 / h],
        opacity: this.props.opacity ?? 1,
      },
    });
  }
}

function asLabelUint32(data: SupportedTypedArray): Uint32Array {
  if (data instanceof Uint32Array) return data;
  const out = new Uint32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    out[i] = Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
  }
  return out;
}

/** Tiled GPU bitmask overlay; stretches mask pixels into the viewer frame. */
export function createMaskTileLayer(args: {
  id: string;
  loader: Loader;
  channelIndex: number;
  visualization: MaskVisualization;
  worldWidth: number;
  worldHeight: number;
}): Layer | null {
  const planes = args.loader.data;
  if (!planes?.length) return null;
  const finest = planes[0];
  const { width: maskW, height: maskH } = planeSize(finest);
  if (maskW <= 0 || maskH <= 0) return null;
  if (args.worldWidth <= 0 || args.worldHeight <= 0) return null;

  const { visualization: viz, channelIndex } = args;

  return createLoaderPyramidTileLayer<MaskTileData>({
    id: args.id,
    planes,
    scaleX: args.worldWidth / maskW,
    scaleY: args.worldHeight / maskH,
    updateTriggers: {
      getTileData: [channelIndex],
      renderSubLayers: [viz.style, viz.color, viz.colorSeed ?? 0],
    },
    getTileData: async ({ plane, x, y, signal }) => {
      const tile = await plane.getTile({
        x,
        y,
        selection: { t: 0, z: 0, c: channelIndex },
        signal,
      });
      if (!tile?.data?.length || tile.width <= 0 || tile.height <= 0) {
        return null;
      }
      const labels = asLabelUint32(tile.data);
      if (labels.length < tile.width * tile.height) return null;
      return { data: [labels], width: tile.width, height: tile.height };
    },
    renderSubLayer: ({ layerId, tileData, bounds, tileId }) =>
      new MaskBitmaskLayer({
        id: `${layerId}-bitmask-${tileId}`,
        channelData: tileData,
        bounds,
        visualization: viz,
        ...BITMASK_PROPS,
      }) as unknown as Layer,
  });
}

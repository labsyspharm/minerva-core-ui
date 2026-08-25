import type { Layer } from "@deck.gl/core";
import { COORDINATE_SYSTEM, picking, project32 } from "@deck.gl/core";
import { TileLayer } from "@deck.gl/geo-layers";
import { XRLayer } from "@hms-dbmi/viv";
import {
  DEFAULT_MASK_VISUALIZATION,
  type MaskVisualization,
} from "@/lib/imaging/channelKind";
import type {
  LoaderPlane,
  SupportedTypedArray,
} from "@/lib/imaging/loaderTypes";
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

// Viv types XRLayer as a constructable const; subclass at runtime (Vitessce pattern).
type XRLayerInstance = {
  props: Record<string, unknown>;
  state: {
    textures?: Record<string, unknown> | null;
    model?: {
      shaderInputs: { setProps: (props: Record<string, unknown>) => void };
    } | null;
  };
  updateState(params: unknown): void;
};
const XRLayerBase = XRLayer as unknown as new (
  props?: Record<string, unknown>,
) => XRLayerInstance;
const layerGetShaders = Object.getPrototypeOf(XRLayerBase.prototype)
  .getShaders as (
  this: XRLayerInstance,
  opts?: Record<string, unknown>,
) => Record<string, unknown>;

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

function planeSize(plane: LoaderPlane): { width: number; height: number } {
  const xi = plane.labels.indexOf("x");
  const yi = plane.labels.indexOf("y");
  return {
    width: xi >= 0 ? plane.shape[xi] : 0,
    height: yi >= 0 ? plane.shape[yi] : 0,
  };
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

  const scaleX = args.worldWidth / maskW;
  const scaleY = args.worldHeight / maskH;
  const { visualization: viz, channelIndex } = args;

  return new TileLayer<MaskTileData>({
    id: args.id,
    tileSize: finest.tileSize,
    minZoom: -(planes.length - 1),
    maxZoom: 0,
    extent: [0, 0, maskW, maskH],
    refinementStrategy: "best-available",
    pickable: false,
    updateTriggers: {
      getTileData: [channelIndex],
      renderSubLayers: [viz.style, viz.color, viz.colorSeed ?? 0],
    },
    getTileData: async ({ index, signal }) => {
      const level = Math.min(
        planes.length - 1,
        Math.max(0, Math.round(-index.z)),
      );
      try {
        const tile = await planes[level].getTile({
          x: index.x,
          y: index.y,
          selection: { t: 0, z: 0, c: channelIndex },
          signal,
        });
        if (!tile?.data?.length || tile.width <= 0 || tile.height <= 0) {
          return null;
        }
        const labels = asLabelUint32(tile.data);
        if (labels.length < tile.width * tile.height) return null;
        return { data: [labels], width: tile.width, height: tile.height };
      } catch (e) {
        if (signal?.aborted || e === "__vivSignalAborted") return null;
        console.error(e);
        return null;
      }
    },
    renderSubLayers: (props) => {
      const tileData = props.data;
      if (!tileData?.data?.[0] || tileData.width <= 0 || tileData.height <= 0) {
        return null;
      }
      const bbox = props.tile.bbox;
      if (!("left" in bbox)) return null;
      const { left, bottom, right, top } = bbox;
      if ([left, bottom, right, top].some((v) => v < 0)) return null;
      const { tileSize } = finest;
      return new MaskBitmaskLayer({
        id: `${args.id}-bitmask-${props.tile.id}`,
        channelData: tileData,
        bounds: [
          left * scaleX,
          (tileData.height < tileSize ? maskH : bottom) * scaleY,
          (tileData.width < tileSize ? maskW : right) * scaleX,
          top * scaleY,
        ],
        visualization: viz,
        ...BITMASK_PROPS,
      }) as unknown as Layer;
    },
  });
}

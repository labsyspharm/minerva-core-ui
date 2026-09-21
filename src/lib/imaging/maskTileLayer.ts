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
import { CELL_OUTLINE_RGB, type MaskGpuStyle } from "@/lib/imaging/maskLayers";
import { type Loader, TILE_CACHE_PROPS } from "@/lib/imaging/viv";
import { layerModelMatrix } from "@/lib/imaging/worldFrame";

const CELL_OUTLINE_COUNT = CELL_OUTLINE_RGB.length;
const CELL_OUTLINE_VEC3: [number, number, number][] = CELL_OUTLINE_RGB.map(
  ([r, g, b]) => [r / 255, g / 255, b / 255],
);

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

vec3 randomColor(uint label) {
  uint i = (label ^ uint(maskViz.uColorSeed)) % ${CELL_OUTLINE_COUNT}u;
  if (i == 0u) return maskViz.uPalette0;
  if (i == 1u) return maskViz.uPalette1;
  if (i == 2u) return maskViz.uPalette2;
  if (i == 3u) return maskViz.uPalette3;
  if (i == 4u) return maskViz.uPalette4;
  return maskViz.uPalette5;
}

uint labelAt(vec2 coord) {
  return uint(texture(channel0, coord).r);
}

bool isOutline(uint label, vec2 coord) {
  vec2 t = 1.0 / vec2(textureSize(channel0, 0));
  return
    labelAt(coord + vec2( t.x, 0.0)) != label ||
    labelAt(coord + vec2(-t.x, 0.0)) != label ||
    labelAt(coord + vec2(0.0,  t.y)) != label ||
    labelAt(coord + vec2(0.0, -t.y)) != label;
}

void main() {
  uint label = labelAt(vTexCoord);
  if (label == 0u) discard;
  if (maskViz.uOutline != 0 && !isOutline(label, vTexCoord)) discard;

  vec3 rgb;
  int w = int(classStyle.uLutSize.x);
  int h = int(classStyle.uLutSize.y);
  int y = int(label) / w;
  uint cls = 0u;
  if (y < h) {
    cls = uint(round(texelFetch(classIndex, ivec2(int(label) % w, y), 0).r * 255.0));
  }
  if (cls == 0u) {
    if (classStyle.uMissHidden != 0) discard;
    rgb = maskViz.uRandomColors != 0 ? randomColor(label) : vec3(1.0);
  } else {
    vec4 c = texelFetch(classPalette, ivec2(int(cls), 0), 0);
    if (c.a == 0.0) discard;
    rgb = maskViz.uRandomColors != 0 ? c.rgb : vec3(1.0);
  }
  float a = (maskViz.uOutline != 0 ? 230.0 : 170.0) / 255.0;
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
  float opacity;
  vec3 uPalette0;
  vec3 uPalette1;
  vec3 uPalette2;
  vec3 uPalette3;
  vec3 uPalette4;
  vec3 uPalette5;
} maskViz;
`,
  uniformTypes: {
    uOutline: "i32",
    uRandomColors: "i32",
    uColorSeed: "f32",
    opacity: "f32",
    uPalette0: "vec3<f32>",
    uPalette1: "vec3<f32>",
    uPalette2: "vec3<f32>",
    uPalette3: "vec3<f32>",
    uPalette4: "vec3<f32>",
    uPalette5: "vec3<f32>",
  },
};

const classStyleMod = {
  name: "classStyle",
  fs: `\
uniform sampler2D classIndex;
uniform sampler2D classPalette;
uniform classStyleUniforms {
  vec2 uLutSize;
  int uMissHidden;
} classStyle;
`,
  uniformTypes: {
    uLutSize: "vec2<f32>",
    uMissHidden: "i32",
  },
};

const DUMMY_RGBA = new Uint8Array([0, 0, 0, 0]);
const DUMMY_R8 = new Uint8Array([0]);

function styleKey(style: MaskGpuStyle | undefined): string {
  return style ? `${style.indexRev}:${style.rev}` : "";
}

type GpuTexture = {
  destroy?: () => void;
  delete?: () => void;
};

// Index texture is stable per CSV; palette is tiny and changes with vis/color.
const TEX_CACHE_MAX = 4;
const indexTexCache = new Map<string, GpuTexture>();
const paletteTexCache = new Map<string, GpuTexture>();

function rememberTex(
  cache: Map<string, GpuTexture>,
  key: string,
  tex: GpuTexture,
): GpuTexture {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  while (cache.size >= TEX_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest == null) break;
    const evicted = cache.get(oldest);
    evicted?.destroy?.();
    evicted?.delete?.();
    cache.delete(oldest);
  }
  cache.set(key, tex);
  return tex;
}

const NEAREST_SAMPLER = {
  minFilter: "nearest",
  magFilter: "nearest",
  addressModeU: "clamp-to-edge",
  addressModeV: "clamp-to-edge",
} as const;

function makeTexture(
  device: XRLayerInstance["context"]["device"],
  data: Uint8Array,
  width: number,
  height: number,
  format: "r8unorm" | "rgba8unorm",
): GpuTexture {
  try {
    return device.createTexture({
      data,
      width,
      height,
      format,
      mipmaps: false,
      sampler: NEAREST_SAMPLER,
    });
  } catch (e) {
    console.warn("[featureTable] class texture create failed", e);
    return device.createTexture({
      data: format === "r8unorm" ? DUMMY_R8 : DUMMY_RGBA,
      width: 1,
      height: 1,
      format,
      mipmaps: false,
      sampler: NEAREST_SAMPLER,
    });
  }
}

// Viv types XRLayer as a constructable const; subclass at runtime (Vitessce pattern).
type XRLayerInstance = {
  props: Record<string, unknown>;
  context: {
    device: { createTexture: (props: Record<string, unknown>) => GpuTexture };
  };
  state: {
    textures?: Record<string, unknown> | null;
    model?: {
      shaderInputs: { setProps: (props: Record<string, unknown>) => void };
      setBindings?: (props: Record<string, unknown>) => void;
    } | null;
    classIndexTexture?: GpuTexture;
    classPaletteTexture?: GpuTexture;
    classStyleKey?: string;
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
      modules: [project32, picking, maskViz, classStyleMod],
      defines: {
        SAMPLER_TYPE: "usampler2D",
        NUM_CHANNELS: "1",
        NUM_PLANES: "1",
      },
    });
  }

  finalizeState() {
    this.state.classIndexTexture = undefined;
    this.state.classPaletteTexture = undefined;
    const proto = Object.getPrototypeOf(XRLayerBase.prototype) as {
      finalizeState?: (this: XRLayerInstance) => void;
    };
    proto.finalizeState?.call(this);
  }

  writeMaskViz() {
    const { model } = this.state;
    if (!model) return;
    const viz =
      (this.props.visualization as MaskVisualization | undefined) ??
      DEFAULT_MASK_VISUALIZATION;
    const opacity = Math.min(1, Math.max(0, viz.opacity ?? 1));
    const style = this.props.classStyle as MaskGpuStyle | undefined;
    model.shaderInputs.setProps({
      maskViz: {
        uOutline: viz.style === "outline" ? 1 : 0,
        uRandomColors: viz.color === "random" ? 1 : 0,
        uColorSeed: viz.colorSeed ?? 0,
        opacity,
        uPalette0: CELL_OUTLINE_VEC3[0],
        uPalette1: CELL_OUTLINE_VEC3[1],
        uPalette2: CELL_OUTLINE_VEC3[2],
        uPalette3: CELL_OUTLINE_VEC3[3],
        uPalette4: CELL_OUTLINE_VEC3[4],
        uPalette5: CELL_OUTLINE_VEC3[5],
      },
      classStyle: {
        uLutSize: style ? [style.width, style.height] : [1, 1],
        uMissHidden: style?.missHidden ? 1 : 0,
      },
    });
  }

  updateState(params: unknown) {
    super.updateState(params);
    const { model } = this.state;
    if (!model) return;
    this.ensureClassTextures(this.props.classStyle as MaskGpuStyle | undefined);
    this.writeMaskViz();
    model.setBindings?.({
      classIndex: this.state.classIndexTexture,
      classPalette: this.state.classPaletteTexture,
    });
  }

  ensureClassTextures(style: MaskGpuStyle | undefined) {
    const key = styleKey(style);
    if (this.state.classStyleKey === key && this.state.classIndexTexture)
      return;
    const device = this.context.device;
    const indexKey = style
      ? `i:${style.indexRev}:${style.width}x${style.height}`
      : "";
    const paletteKey = style ? `p:${style.rev}` : "";
    let index = indexTexCache.get(indexKey);
    if (!index) {
      index = style
        ? makeTexture(device, style.index, style.width, style.height, "r8unorm")
        : makeTexture(device, DUMMY_R8, 1, 1, "r8unorm");
    }
    this.state.classIndexTexture = rememberTex(indexTexCache, indexKey, index);
    let palette = paletteTexCache.get(paletteKey);
    if (!palette) {
      palette = style
        ? makeTexture(
            device,
            style.palette,
            Math.max(1, style.palette.length / 4),
            1,
            "rgba8unorm",
          )
        : makeTexture(device, DUMMY_RGBA, 1, 1, "rgba8unorm");
    }
    this.state.classPaletteTexture = rememberTex(
      paletteTexCache,
      paletteKey,
      palette,
    );
    this.state.classStyleKey = key;
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

export function createMaskTileLayer(args: {
  id: string;
  loader: Loader;
  channelIndex: number;
  visualization: MaskVisualization;
  classStyle?: MaskGpuStyle;
  visible?: boolean;
}): Layer | null {
  const planes = args.loader.data;
  if (!planes?.length) return null;
  const finest = planes[0];
  const { width: maskW, height: maskH } = planeSize(finest);
  if (maskW <= 0 || maskH <= 0) return null;

  const modelMatrix = layerModelMatrix(args.loader);
  const { visualization: viz, channelIndex, classStyle } = args;
  const visible = args.visible !== false;

  return new TileLayer<MaskTileData>({
    id: args.id,
    tileSize: finest.tileSize,
    minZoom: Math.round(-(planes.length - 1)),
    maxZoom: 0,
    zoomOffset: Math.round(Math.log2(modelMatrix.getScale()[0] || 1)),
    extent: [0, 0, maskW, maskH],
    modelMatrix,
    visible,
    maxRequests: 10,
    refinementStrategy: "best-available",
    pickable: false,
    ...TILE_CACHE_PROPS,
    updateTriggers: {
      getTileData: [channelIndex],
      renderSubLayers: [
        viz.style,
        viz.color,
        viz.colorSeed ?? 0,
        viz.opacity ?? 1,
        styleKey(classStyle),
        visible,
      ],
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
      const { left, top } = bbox;
      if ([left, top].some((v) => v < 0)) return null;
      const scale = 2 ** Math.round(-props.tile.index.z);
      return new MaskBitmaskLayer({
        id: `${args.id}-bitmask-${props.tile.id}`,
        channelData: tileData,
        modelMatrix,
        visible,
        bounds: [
          left,
          top + tileData.height * scale,
          left + tileData.width * scale,
          top,
        ],
        visualization: viz,
        classStyle,
        ...BITMASK_PROPS,
      }) as unknown as Layer;
    },
  });
}

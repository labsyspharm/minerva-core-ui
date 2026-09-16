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
import type { Loader } from "@/lib/imaging/viv";
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

bool isInteriorEdge(uint label, vec2 coord) {
  uint n = uint(texture(channel0, coord + vec2(0.0, maskViz.uTexelSize.y)).r);
  uint s = uint(texture(channel0, coord - vec2(0.0, maskViz.uTexelSize.y)).r);
  uint e = uint(texture(channel0, coord + vec2(maskViz.uTexelSize.x, 0.0)).r);
  uint w = uint(texture(channel0, coord - vec2(maskViz.uTexelSize.x, 0.0)).r);
  return n != label || s != label || e != label || w != label;
}

uint unpackId(vec4 p) {
  return uint(round(p.r * 255.0))
    | (uint(round(p.g * 255.0)) << 8u)
    | (uint(round(p.b * 255.0)) << 16u)
    | (uint(round(p.a * 255.0)) << 24u);
}

// ponytail: 8 linear probes at load ≤ 0.5 (table ≥ 2× entries). A miss
// falls through to hash / missHidden. Not a 512-id hidden-uniform cap.
// Upgrade: longer probe or cuckoo if 4k-override tables collide.
vec4 probeOverride(uint label) {
  uint tableSize = uint(classStyle.uOverrideCount);
  if (tableSize == 0u) return vec4(-1.0);
  uint slot = (label * 2654435761u) % tableSize;
  for (int k = 0; k < 8; k++) {
    uint i = (slot + uint(k)) % tableSize;
    uint id = unpackId(texelFetch(overrideTex, ivec2(int(i), 0), 0));
    if (id == 0u) return vec4(-1.0);
    if (id == label) return texelFetch(overrideTex, ivec2(int(i), 1), 0);
  }
  return vec4(-1.0);
}

void main() {
  uint label = uint(texture(channel0, vTexCoord).r);
  if (label == 0u) discard;
  if (maskViz.uOutline != 0 && !isInteriorEdge(label, vTexCoord)) discard;

  vec3 rgb;
  int strategy = classStyle.uClassStrategy;
  if (strategy == 0) {
    rgb = maskViz.uRandomColors != 0 ? randomColor(label) : vec3(1.0);
  } else if (strategy == 1) {
    int w = int(classStyle.uLutSize.x);
    vec4 c = texelFetch(classLut, ivec2(int(label) % w, int(label) / w), 0);
    if (c.a == 0.0) discard;
    rgb = maskViz.uRandomColors != 0 ? c.rgb : vec3(1.0);
  } else {
    vec4 ov = probeOverride(label);
    if (ov.a >= 0.0) {
      if (ov.a == 0.0) discard;
      rgb = maskViz.uRandomColors != 0 ? ov.rgb : vec3(1.0);
    } else if (classStyle.uMissHidden != 0) {
      discard;
    } else {
      rgb = maskViz.uRandomColors != 0 ? randomColor(label) : vec3(1.0);
    }
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
  vec2 uTexelSize;
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
    uTexelSize: "vec2<f32>",
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
uniform sampler2D classLut;
uniform sampler2D overrideTex;
uniform classStyleUniforms {
  int uClassStrategy;
  vec2 uLutSize;
  int uMissHidden;
  int uOverrideCount;
} classStyle;
`,
  uniformTypes: {
    uClassStrategy: "i32",
    uLutSize: "vec2<f32>",
    uMissHidden: "i32",
    uOverrideCount: "i32",
  },
};

const DUMMY_RGBA = new Uint8Array([0, 0, 0, 0]);

function sparseToRgba8(overrides: Uint32Array, size: number): Uint8Array {
  const data = new Uint8Array(size * 2 * 4);
  for (let i = 0; i < size; i++) {
    const id = overrides[i * 2];
    const rgba = overrides[i * 2 + 1];
    const o = i * 4;
    data[o] = id & 255;
    data[o + 1] = (id >>> 8) & 255;
    data[o + 2] = (id >>> 16) & 255;
    data[o + 3] = (id >>> 24) & 255;
    const p = (size + i) * 4;
    data[p] = rgba & 255;
    data[p + 1] = (rgba >>> 8) & 255;
    data[p + 2] = (rgba >>> 16) & 255;
    data[p + 3] = (rgba >>> 24) & 255;
  }
  return data;
}

function styleKey(style: MaskGpuStyle | undefined): string {
  if (!style || style.strategy === "plane") return "plane";
  if (style.strategy === "denseLut") {
    return `dense:${style.width}x${style.height}:${style.rev}`;
  }
  return `sparse:${style.overrides.length}:${style.missHidden}:${style.rev}`;
}

type GpuTexture = {
  destroy?: () => void;
  delete?: () => void;
};

function destroyTex(tex: GpuTexture | undefined) {
  tex?.destroy?.();
  tex?.delete?.();
}

// ponytail: one LUT per vis+palette, shared by all tiles. LRU of 4.
const CLASS_TEX_CACHE_MAX = 4;
const classTexCache = new Map<
  string,
  { lut: GpuTexture; override: GpuTexture }
>();

function rememberClassTextures(
  key: string,
  lut: GpuTexture,
  override: GpuTexture,
): { lut: GpuTexture; override: GpuTexture } {
  const hit = classTexCache.get(key);
  if (hit) {
    classTexCache.delete(key);
    classTexCache.set(key, hit);
    return hit;
  }
  while (classTexCache.size >= CLASS_TEX_CACHE_MAX) {
    const oldest = classTexCache.keys().next().value;
    if (oldest == null) break;
    const old = classTexCache.get(oldest);
    classTexCache.delete(oldest);
    destroyTex(old?.lut);
    destroyTex(old?.override);
  }
  const entry = { lut, override };
  classTexCache.set(key, entry);
  return entry;
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
    classLutTexture?: GpuTexture;
    overrideTexture?: GpuTexture;
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
    classStyle: { strategy: "plane" } as MaskGpuStyle,
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
    this.state.classLutTexture = undefined;
    this.state.overrideTexture = undefined;
    const proto = Object.getPrototypeOf(XRLayerBase.prototype) as {
      finalizeState?: (this: XRLayerInstance) => void;
    };
    proto.finalizeState?.call(this);
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
    const opacity = Math.min(1, Math.max(0, viz.opacity ?? 1));
    const style =
      (this.props.classStyle as MaskGpuStyle | undefined) ??
      ({ strategy: "plane" } satisfies MaskGpuStyle);
    this.ensureClassTextures(style);
    let uClassStrategy = 0;
    let uLutSize: [number, number] = [1, 1];
    let uMissHidden = 0;
    let uOverrideCount = 0;
    if (style.strategy === "denseLut") {
      uClassStrategy = 1;
      uLutSize = [style.width, style.height];
    } else if (style.strategy === "sparse") {
      uClassStrategy = 2;
      uMissHidden = style.missHidden ? 1 : 0;
      uOverrideCount = style.overrides.length / 2;
    }
    model.shaderInputs.setProps({
      maskViz: {
        uOutline: viz.style === "outline" ? 1 : 0,
        uRandomColors: viz.color === "random" ? 1 : 0,
        uColorSeed: viz.colorSeed ?? 0,
        uTexelSize: [1 / w, 1 / h],
        opacity,
        uPalette0: CELL_OUTLINE_VEC3[0],
        uPalette1: CELL_OUTLINE_VEC3[1],
        uPalette2: CELL_OUTLINE_VEC3[2],
        uPalette3: CELL_OUTLINE_VEC3[3],
        uPalette4: CELL_OUTLINE_VEC3[4],
        uPalette5: CELL_OUTLINE_VEC3[5],
      },
      classStyle: {
        uClassStrategy,
        uLutSize,
        uMissHidden,
        uOverrideCount,
      },
    });
    model.setBindings?.({
      classLut: this.state.classLutTexture,
      overrideTex: this.state.overrideTexture,
    });
  }

  ensureClassTextures(style: MaskGpuStyle) {
    const key = styleKey(style);
    if (this.state.classStyleKey === key && this.state.classLutTexture) return;
    const cached = classTexCache.get(key);
    if (cached) {
      rememberClassTextures(key, cached.lut, cached.override);
      this.state.classLutTexture = cached.lut;
      this.state.overrideTexture = cached.override;
      this.state.classStyleKey = key;
      return;
    }
    const device = this.context.device;
    const make = (data: Uint8Array, width: number, height: number) => {
      try {
        return device.createTexture({
          data,
          width,
          height,
          format: "rgba8unorm",
          mipmaps: false,
          sampler: {
            minFilter: "nearest",
            magFilter: "nearest",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
          },
        });
      } catch (e) {
        console.warn("[classTable] class texture create failed", e);
        return device.createTexture({
          data: DUMMY_RGBA,
          width: 1,
          height: 1,
          format: "rgba8unorm",
          mipmaps: false,
          sampler: {
            minFilter: "nearest",
            magFilter: "nearest",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
          },
        });
      }
    };
    let lut: GpuTexture;
    let override: GpuTexture;
    if (style.strategy === "denseLut") {
      lut = make(style.rgba, style.width, style.height);
      override = make(DUMMY_RGBA, 1, 1);
    } else if (style.strategy === "sparse") {
      const size = Math.max(1, style.overrides.length / 2);
      lut = make(DUMMY_RGBA, 1, 1);
      override = make(sparseToRgba8(style.overrides, size), size, 2);
    } else {
      lut = make(DUMMY_RGBA, 1, 1);
      override = make(DUMMY_RGBA, 1, 1);
    }
    const entry = rememberClassTextures(key, lut, override);
    this.state.classLutTexture = entry.lut;
    this.state.overrideTexture = entry.override;
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
}): Layer | null {
  const planes = args.loader.data;
  if (!planes?.length) return null;
  const finest = planes[0];
  const { width: maskW, height: maskH } = planeSize(finest);
  if (maskW <= 0 || maskH <= 0) return null;

  const modelMatrix = layerModelMatrix(args.loader);
  const { visualization: viz, channelIndex, classStyle } = args;

  return new TileLayer<MaskTileData>({
    id: args.id,
    tileSize: finest.tileSize,
    minZoom: -(planes.length - 1),
    maxZoom: 0,
    extent: [0, 0, maskW, maskH],
    modelMatrix,
    refinementStrategy: "best-available",
    pickable: false,
    updateTriggers: {
      getTileData: [channelIndex],
      renderSubLayers: [
        viz.style,
        viz.color,
        viz.colorSeed ?? 0,
        viz.opacity ?? 1,
        styleKey(classStyle),
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
      const { left, bottom, right, top } = bbox;
      if ([left, bottom, right, top].some((v) => v < 0)) return null;
      const { tileSize } = finest;
      return new MaskBitmaskLayer({
        id: `${args.id}-bitmask-${props.tile.id}`,
        channelData: tileData,
        modelMatrix,
        bounds: [
          left,
          tileData.height < tileSize ? maskH : bottom,
          tileData.width < tileSize ? maskW : right,
          top,
        ],
        visualization: viz,
        classStyle,
        ...BITMASK_PROPS,
      }) as unknown as Layer;
    },
  });
}

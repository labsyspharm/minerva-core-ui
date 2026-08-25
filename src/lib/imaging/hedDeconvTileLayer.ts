import type { Layer } from "@deck.gl/core";
import { COORDINATE_SYSTEM, picking, project32 } from "@deck.gl/core";
import { TileLayer } from "@deck.gl/geo-layers";
import { XRLayer } from "@hms-dbmi/viv";
import { DEFAULT_STAIN_INVERSE, type GlslMat3 } from "@/lib/imaging/heStainFit";
import type {
  LoaderPlane,
  SupportedTypedArray,
} from "@/lib/imaging/loaderTypes";
import {
  type Loader,
  loaderPixelSizeXY,
  VIV_TILE_DEBOUNCE_MS,
  VIV_TILE_MAX_REQUESTS,
} from "@/lib/imaging/viv";

type HeTileData = {
  data: SupportedTypedArray[];
  width: number;
  height: number;
};

/** Displayed outputs of `deconv_he`. Residual is computed for unmixing, not shown. */
export type HeDeconvComponent = "hematoxylin" | "eosin";

export const HE_DECONV_COMPONENTS: readonly HeDeconvComponent[] = [
  "hematoxylin",
  "eosin",
];

export const HE_DECONV_LABELS: Record<HeDeconvComponent, string> = {
  hematoxylin: "Hematoxylin",
  eosin: "Eosin",
};

/** Integer contrast sliders map concentration [0, 1] → 0–1000, same as IF 16-bit sliders. */
export const HE_CONTRAST_SCALE = 1000;

export type HeStainView = {
  color: [number, number, number];
  lower: number;
  upper: number;
  visible: boolean;
};

/** RGB H&E source split into two IF-style stain channels. */
export type HeDeconvSplit = Record<HeDeconvComponent, HeStainView>;

const DEFAULT_HE_STAIN: Record<HeDeconvComponent, HeStainView> = {
  hematoxylin: {
    color: [0, 90, 255],
    lower: 0,
    upper: HE_CONTRAST_SCALE,
    visible: true,
  },
  eosin: {
    color: [255, 56, 140],
    lower: 0,
    upper: HE_CONTRAST_SCALE,
    visible: true,
  },
};

export function defaultHeDeconvSplit(): HeDeconvSplit {
  return {
    hematoxylin: { ...DEFAULT_HE_STAIN.hematoxylin },
    eosin: { ...DEFAULT_HE_STAIN.eosin },
  };
}

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
uniform SAMPLER_TYPE channel3;
uniform SAMPLER_TYPE channel4;
uniform SAMPLER_TYPE channel5;

uniform float uToRgb8;
uniform vec2 uHContrast;
uniform vec2 uEContrast;
uniform vec3 uHColor;
uniform vec3 uEColor;
uniform mat3 uStainInverse;
uniform float opacity;

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
  ) * uToRgb8;
  vec3 conc = uStainInverse * optical_density(rgb8);
  vec3 rgb =
    windowed(conc.x, uHContrast) * uHColor +
    windowed(conc.y, uEContrast) * uEColor;
  fragColor = vec4(rgb, opacity);

  geometry.uv = vTexCoord;
  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;

const HE_XR_PROPS = {
  interpolation: "linear",
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

type XRLayerInstance = {
  props: Record<string, unknown>;
  state: {
    textures?: Record<string, unknown> | null;
    model?: {
      setUniforms: (
        u: Record<string, unknown>,
        opts?: { disableWarnings?: boolean },
      ) => unknown;
      setBindings: (b: Record<string, unknown>) => unknown;
      draw: (pass: unknown) => void;
    } | null;
  };
  context: { renderPass: unknown };
};
const XRLayerBase = XRLayer as unknown as new (
  props?: Record<string, unknown>,
) => XRLayerInstance;
const layerGetShaders = Object.getPrototypeOf(XRLayerBase.prototype)
  .getShaders as (
  this: XRLayerInstance,
  opts?: Record<string, unknown>,
) => Record<string, unknown>;

function stainContrast(stain: HeStainView): [number, number] {
  return [stain.lower / HE_CONTRAST_SCALE, stain.upper / HE_CONTRAST_SCALE];
}

function stainColor(stain: HeStainView): [number, number, number] {
  if (!stain.visible) return [0, 0, 0];
  return [stain.color[0] / 255, stain.color[1] / 255, stain.color[2] / 255];
}

class HeDeconvXrLayer extends XRLayerBase {
  static layerName = "HeDeconvXrLayer";
  static defaultProps = {
    ...HE_XR_PROPS,
    uToRgb8: 1,
    uHContrast: [0, 1],
    uEContrast: [0, 1],
    uHColor: [0, 0.35, 1],
    uEColor: [1, 0.22, 0.55],
    uStainInverse: DEFAULT_STAIN_INVERSE,
  };

  getShaders() {
    return layerGetShaders.call(this, {
      vs: HE_VS,
      fs: HE_FS,
      modules: [project32, picking],
      // Linear interpolation uploads integer dtypes as Float32.
      defines: { SAMPLER_TYPE: "sampler2D" },
    });
  }

  draw(opts: { uniforms: Record<string, unknown> }) {
    const { textures, model } = this.state;
    if (!textures || !model) return;
    const props = this.props as typeof this.props & {
      uToRgb8: number;
      uHContrast: [number, number];
      uEContrast: [number, number];
      uHColor: [number, number, number];
      uEColor: [number, number, number];
      uStainInverse: GlslMat3;
    };
    model.setUniforms(
      {
        ...opts.uniforms,
        uToRgb8: props.uToRgb8,
        uHContrast: props.uHContrast,
        uEContrast: props.uEContrast,
        uHColor: props.uHColor,
        uEColor: props.uEColor,
        uStainInverse: props.uStainInverse,
        opacity: this.props.opacity ?? 1,
      },
      { disableWarnings: true },
    );
    model.setBindings(textures);
    model.draw(this.context.renderPass);
  }
}

function planeSize(plane: LoaderPlane): { width: number; height: number } {
  const xi = plane.labels.indexOf("x");
  const yi = plane.labels.indexOf("y");
  return {
    width: xi >= 0 ? plane.shape[xi] : 0,
    height: yi >= 0 ? plane.shape[yi] : 0,
  };
}

/** Map texture samples to 8-bit counts so OD matches `optical_density(rgb8, 255)`. */
function toRgb8FromDtype(dtype: string): number {
  if (dtype.startsWith("Float")) return 255;
  return 1;
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

const HE_OVERLAY_PROPS = {
  parameters: {
    blendColorOperation: "add",
    blendAlphaOperation: "add",
    blendColorSrcFactor: "one",
    blendColorDstFactor: "one",
    blendAlphaSrcFactor: "one",
    blendAlphaDstFactor: "one",
  },
};

/**
 * Hematoxylin + eosin in one TileLayer. Independent color/contrast/visibility
 * are shader uniforms so zoom does not fetch the RGB pyramid twice or add
 * overlapping LODs (which flashes with additive blend).
 */
export function createHeDeconvLayer(args: {
  id: string;
  loader: Loader;
  parentIndex: number;
  hematoxylin: HeStainView;
  eosin: HeStainView;
  overlay: boolean;
  stainInverse?: GlslMat3;
}): Layer | null {
  const planes = args.loader.data;
  if (!planes?.length) return null;
  const finest = planes[0];
  const { width: planeW, height: planeH } = planeSize(finest);
  if (planeW <= 0 || planeH <= 0) return null;
  const world = loaderPixelSizeXY(args.loader);
  const worldW = world?.sizeX ?? planeW;
  const worldH = world?.sizeY ?? planeH;
  const scaleX = worldW / planeW;
  const scaleY = worldH / planeH;
  const parentIndex = args.parentIndex;
  const dtype = finest.dtype;
  const uToRgb8 = toRgb8FromDtype(dtype);
  const uHContrast = stainContrast(args.hematoxylin);
  const uEContrast = stainContrast(args.eosin);
  const uHColor = stainColor(args.hematoxylin);
  const uEColor = stainColor(args.eosin);
  const uStainInverse = args.stainInverse ?? DEFAULT_STAIN_INVERSE;
  // Viv: opaque uses best-available (parents cover holes); additive overlay
  // must be no-overlap or cached LODs stack and flash 2× bright.
  const refinementStrategy = args.overlay ? "no-overlap" : "best-available";

  return new TileLayer<HeTileData>({
    id: args.id,
    tileSize: finest.tileSize,
    minZoom: -(planes.length - 1),
    maxZoom: 0,
    extent: [0, 0, planeW, planeH],
    refinementStrategy,
    debounceTime: VIV_TILE_DEBOUNCE_MS,
    maxRequests: VIV_TILE_MAX_REQUESTS,
    pickable: false,
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
          selection: { t: 0, z: 0, c: parentIndex },
          signal,
        });
        if (!tile?.data?.length || tile.width <= 0 || tile.height <= 0) {
          return null;
        }
        const split = splitInterleavedRgb(tile.data, tile.width, tile.height);
        if (!split) return null;
        return { data: split, width: tile.width, height: tile.height };
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
      return new HeDeconvXrLayer({
        id: `${args.id}-xr-${props.tile.id}`,
        channelData: tileData,
        bounds: [
          left * scaleX,
          (tileData.height < tileSize ? planeH : bottom) * scaleY,
          (tileData.width < tileSize ? planeW : right) * scaleX,
          top * scaleY,
        ],
        dtype,
        uToRgb8,
        uHContrast,
        uEContrast,
        uHColor,
        uEColor,
        uStainInverse,
        ...HE_XR_PROPS,
        ...(args.overlay ? HE_OVERLAY_PROPS : {}),
      }) as unknown as Layer;
    },
  });
}

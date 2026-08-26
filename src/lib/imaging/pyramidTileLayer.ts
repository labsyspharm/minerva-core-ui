/**
 * Custom Viv loader pyramids: non-dyadic zoom mapping + shared TileLayer /
 * XRLayer subclass scaffolding (H&E deconv, mask bitmask).
 */
import type { Layer } from "@deck.gl/core";
import { TileLayer } from "@deck.gl/geo-layers";
import { XRLayer } from "@hms-dbmi/viv";
import type { LoaderPlane } from "@/lib/imaging/loaderTypes";
import { planeSize } from "@/lib/imaging/loaderTypes";

// --- Non-dyadic pyramid ↔ deck.gl TileLayer zoom ---

type TileIndex = { x: number; y: number; z: number };

function pyramidScales(levelWidths: number[]): number[] {
  if (!levelWidths.length) return [1];
  const baseWidth = levelWidths[0];
  if (!(baseWidth > 0)) return levelWidths.map(() => 1);
  return levelWidths.map((width) => {
    if (!(width > 0)) return 1;
    return Math.max(1, Math.round(baseWidth / width));
  });
}

function pyramidMinZoom(scales: number[]): number {
  const coarsest = scales[scales.length - 1] ?? 1;
  if (!(coarsest > 1)) return 0;
  return -Math.floor(Math.log2(coarsest));
}

function snapToPyramidLevel(z: number, scales: number[]): number {
  const requested = 2 ** -Math.round(z);
  for (let i = 0; i < scales.length; i++) {
    if (scales[i] >= requested) return i;
  }
  return Math.max(0, scales.length - 1);
}

function nativePyramidTile(
  index: TileIndex,
  scales: number[],
): { level: number; x: number; y: number } {
  const level = snapToPyramidLevel(index.z, scales);
  const factor = scales[level] / 2 ** -Math.round(index.z);
  return {
    level,
    x: Math.floor(index.x / factor),
    y: Math.floor(index.y / factor),
  };
}

function pyramidTilePixelBounds(args: {
  index: TileIndex;
  dataWidth: number;
  dataHeight: number;
  tileSize: number;
  scales: number[];
}): [number, number, number, number] {
  const { x, y, level } = nativePyramidTile(args.index, args.scales);
  const scale = args.scales[level];
  const boundLeft = x * args.tileSize * scale;
  const boundTop = y * args.tileSize * scale;
  return [
    boundLeft,
    boundTop + args.dataHeight * scale,
    boundLeft + args.dataWidth * scale,
    boundTop,
  ];
}

function scalePixelBounds(
  bounds: [number, number, number, number],
  scaleX: number,
  scaleY: number,
): [number, number, number, number] {
  if (scaleX === 1 && scaleY === 1) return bounds;
  return [
    bounds[0] * scaleX,
    bounds[1] * scaleY,
    bounds[2] * scaleX,
    bounds[3] * scaleY,
  ];
}

// --- Viv XRLayer subclass (Vitessce pattern) ---

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

export const XRLayerBase = XRLayer as unknown as new (
  props?: Record<string, unknown>,
) => XRLayerInstance;

export const layerGetShaders = Object.getPrototypeOf(XRLayerBase.prototype)
  .getShaders as (
  this: XRLayerInstance,
  opts?: Record<string, unknown>,
) => Record<string, unknown>;

// --- TileLayer factory ---

type PyramidTileData = {
  data: unknown[];
  width: number;
  height: number;
};

/** Additive blend params shared by OME intensity overlays and H&E deconv overlays. */
export const ADDITIVE_BLEND_PARAMETERS = {
  blendColorOperation: "add",
  blendAlphaOperation: "add",
  blendColorSrcFactor: "one",
  blendColorDstFactor: "one",
  blendAlphaSrcFactor: "one",
  blendAlphaDstFactor: "one",
} as const;

export function createLoaderPyramidTileLayer<T extends PyramidTileData>(args: {
  id: string;
  planes: LoaderPlane[];
  scaleX?: number;
  scaleY?: number;
  refinementStrategy?: "best-available" | "no-overlap";
  debounceTime?: number;
  maxRequests?: number;
  pickable?: boolean;
  updateTriggers: Record<string, unknown>;
  getTileData: (ctx: {
    level: number;
    x: number;
    y: number;
    plane: LoaderPlane;
    signal?: AbortSignal;
  }) => Promise<T | null>;
  renderSubLayer: (ctx: {
    layerId: string;
    tileData: T;
    bounds: [number, number, number, number];
    tileId: string | number;
  }) => Layer | null;
}): Layer | null {
  const { planes } = args;
  if (!planes?.length) return null;
  const finest = planes[0];
  const { width, height } = planeSize(finest);
  if (width <= 0 || height <= 0) return null;
  const scaleX = args.scaleX ?? 1;
  const scaleY = args.scaleY ?? 1;
  const scales = pyramidScales(planes.map((plane) => planeSize(plane).width));

  return new TileLayer<T>({
    id: args.id,
    tileSize: finest.tileSize,
    minZoom: pyramidMinZoom(scales),
    maxZoom: 0,
    extent: [0, 0, width, height],
    refinementStrategy: args.refinementStrategy ?? "best-available",
    ...(args.debounceTime !== undefined
      ? { debounceTime: args.debounceTime }
      : {}),
    ...(args.maxRequests !== undefined
      ? { maxRequests: args.maxRequests }
      : {}),
    pickable: args.pickable ?? false,
    updateTriggers: args.updateTriggers,
    getTileData: async ({ index, signal }) => {
      const { level, x, y } = nativePyramidTile(index, scales);
      try {
        return await args.getTileData({
          level,
          x,
          y,
          plane: planes[level],
          signal,
        });
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
      if (left < 0 || top < 0) return null;
      const bounds = scalePixelBounds(
        pyramidTilePixelBounds({
          index: props.tile.index,
          dataWidth: tileData.width,
          dataHeight: tileData.height,
          tileSize: finest.tileSize,
          scales,
        }),
        scaleX,
        scaleY,
      );
      return args.renderSubLayer({
        layerId: args.id,
        tileData,
        bounds,
        tileId: props.tile.id,
      });
    },
  });
}

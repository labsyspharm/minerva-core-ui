import { _Tileset2D as Tileset2D } from "@deck.gl/geo-layers";
import type {
  ChannelGroup,
  Channel as SourceChannel,
} from "@/lib/stores/documentStore";
import type { Roi } from "../shapes/roiParser";
import { isMobileDevice } from "../viewer/isMobileDevice";
import {
  applyVisibilityTransition,
  buildCompositedIntensityLayers,
} from "./channelCompositor";
import { isImageChannel, MAX_VIV_INTENSITY_CHANNELS } from "./channelKind";
import type { LoaderPlane } from "./loaderTypes";
import {
  effectiveDisplayColor,
  effectiveSourceColor,
  effectiveSourceLimits,
} from "./sourceChannelStyle";

/**
 * CPU raster bytes Deck may keep per layer; each cached tile also holds its
 * GPU textures. Phones and tablets keep only the tiles on screen: iOS kills a
 * tab long before desktop memory runs out.
 */
const VIV_TILE_MAX_CACHE_BYTE_SIZE = isMobileDevice() ? 0 : 512 * 1024 * 1024;

function rasterTileByteLength(data: unknown): number {
  if (data == null) return 0;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  if (Array.isArray(data)) {
    let n = 0;
    for (const ch of data) n += rasterTileByteLength(ch);
    return n;
  }
  return 0;
}

/** Viv's getTileData omits `byteLength`; Deck needs it for maxCacheByteSize. */
function stampDeckTileByteLength(tile: {
  content?: { data?: unknown; byteLength?: number } | null;
}): void {
  const c = tile.content;
  if (c == null || Number.isFinite(c.byteLength)) return;
  c.byteLength = rasterTileByteLength(c.data);
}

type TileIndicesOpts = Parameters<Tileset2D["getTileIndices"]>[0];

/** Deck's tile list overhangs a rotated image; viv draws blank tiles there. */
class ImageTileset2D extends Tileset2D {
  getTileIndices(opts: TileIndicesOpts) {
    const indices = super.getTileIndices(opts);
    const { extent, tileSize } = this.opts;
    if (!extent) return indices;
    return indices.filter(({ x, y, z }) => {
      const size = tileSize / 2 ** z;
      return x >= 0 && y >= 0 && x * size < extent[2] && y * size < extent[3];
    });
  }

  /**
   * Deck 9.3.3 drops unselected tiles here without subtracting their bytes,
   * then counts each reloaded tile again in `onTileLoad`. A few channel-group
   * changes made the 512 MB budget read full while ~50 MB was held, and the
   * cache shrank to the tiles on screen.
   */
  reloadAll() {
    super.reloadAll();
    (this as unknown as { _cacheByteSize: number })._cacheByteSize = 0;
  }
}

/** Placeholder levels above the on-screen tiles: the coarsest, and this far up. */
const PLACEHOLDER_LEVELS_UP = 3;

/**
 * Also selects coarse ancestors of the on-screen tiles, ahead of them, so
 * Deck loads them first and draws them under the fine tiles. A tile still
 * loading shows blur instead of black. Only for opaque layers (Deck's
 * `best-available`): a faded or additive layer would show both levels.
 */
export class PlaceholderTileset2D extends ImageTileset2D {
  getTileIndices(opts: TileIndicesOpts) {
    const indices = super.getTileIndices(opts);
    if (
      this.opts.refinementStrategy !== "best-available" ||
      indices.length === 0
    ) {
      return indices;
    }
    const z = indices[0].z;
    const coarsest = opts.minZoom ?? z;
    if (coarsest >= z) return indices;
    const levels = [coarsest, Math.max(coarsest, z - PLACEHOLDER_LEVELS_UP)];
    const placeholders = new Map<string, (typeof indices)[number]>();
    for (const level of levels) {
      const scale = 2 ** (z - level);
      for (const { x, y } of indices) {
        const parent = {
          x: Math.floor(x / scale),
          y: Math.floor(y / scale),
          z: level,
        };
        placeholders.set(this.getTileId(parent), parent);
      }
    }
    return [...placeholders.values(), ...indices];
  }
}

/** Omit maxCacheSize so Deck's count cap is Infinity when a byte budget is set. */
export const TILE_CACHE_PROPS = {
  maxCacheByteSize: VIV_TILE_MAX_CACHE_BYTE_SIZE,
  onTileLoad: stampDeckTileByteLength,
  TilesetClass: ImageTileset2D,
};

type Selection = Record<"z" | "t" | "c", number>;
type Color = [number, number, number];
type Limit = [number, number];

export type Loader = {
  data: LoaderPlane[];
  metadata: Metadata;
};

type Settings = {
  channelsVisible: boolean[];
  selections: Selection[];
  contrastLimits: Limit[];
  loader: Loader | null;
  colors: Color[];
  /** Parallel to selections — source channel ids for live preview mapping. */
  sourceChannelIds?: string[];
};

type OmeChannelMeta = {
  ID: string;
  SamplesPerPixel: number;
  Name: string;
};

type TiffDatum = {
  IFD: number;
  PlaneCount: number;
  FirstT: number;
  FirstC: number;
  FirstZ: number;
  UUID: {
    FileName: string;
  };
};

type Pixels = {
  Channels: OmeChannelMeta[];
  ID: string;
  DimensionOrder: string;
  Type: string;
  SizeT: number;
  SizeC: number;
  SizeZ: number;
  SizeY: number;
  SizeX: number;
  PhysicalSizeX: number;
  PhysicalSizeY: number;
  PhysicalSizeXUnit: string;
  PhysicalSizeYUnit: string;
  PhysicalSizeZUnit: string;
  BigEndian: boolean;
  TiffData: TiffDatum[];
};

type Metadata = {
  ID: string;
  AquisitionDate: string;
  Description: string;
  Pixels: Pixels;
  /** Present when OME-XML embeds ROIs; Viv's OmeTiff metadata often omits this. */
  ROIs?: Roi[];
};

/** Full-resolution pixel size from OME metadata or finest pyramid level (>1 rejects placeholders). */
export function loaderPixelSizeXY(loader: Loader): {
  sizeX: number;
  sizeY: number;
} | null {
  const px = loader.metadata?.Pixels;
  const metaX = Number(px?.SizeX);
  const metaY = Number(px?.SizeY);
  if (
    Number.isFinite(metaX) &&
    Number.isFinite(metaY) &&
    metaX > 1 &&
    metaY > 1
  ) {
    return { sizeX: Math.round(metaX), sizeY: Math.round(metaY) };
  }
  const level = loader.data?.[0];
  if (!level?.labels || !level?.shape) return null;
  const xi = level.labels.indexOf("x");
  const yi = level.labels.indexOf("y");
  if (xi < 0 || yi < 0) return null;
  const sizeX = Number(level.shape[xi]);
  const sizeY = Number(level.shape[yi]);
  if (
    !Number.isFinite(sizeX) ||
    !Number.isFinite(sizeY) ||
    sizeX <= 1 ||
    sizeY <= 1
  ) {
    return null;
  }
  return { sizeX: Math.round(sizeX), sizeY: Math.round(sizeY) };
}

const toDefaultSettings = (n: number) => {
  const chan_range = [...Array(n).keys()];
  const n_shown = 3;
  const n_sub = n_shown;
  return {
    loader: null,
    selections: chan_range
      .map((c) => {
        return { z: 0, t: 0, c: c };
      })
      .slice(0, n_sub),
    colors: chan_range
      .map((c) => {
        return [
          [0, 0, 255],
          [0, 255, 0],
          [255, 0, 0],
        ][c % 3] as Color;
      })
      .slice(0, n_sub),
    contrastLimits: chan_range.map(() => [0, 65535] as Limit).slice(0, n_sub),
    channelsVisible: chan_range
      .map((n) => {
        return n < n_shown;
      })
      .slice(0, n_sub),
    sourceChannelIds: [] as string[],
  };
};

type ToSettingsOpts = {
  SourceChannels: SourceChannel[];
  channelGroups?: ChannelGroup[];
};

const toSettings = (opts: ToSettingsOpts) => {
  return (
    activeChannelGroupId: string | null,
    modality: string,
    loader: Loader | undefined,
    channelVisibilities?: Record<string, boolean>,
    loaderSourceImageId?: string,
    channelGroupRowVisibilities: Record<string, boolean> = {},
  ) => {
    const { SourceChannels, channelGroups = [] } = opts;
    if (!loader) return toDefaultSettings(3);
    const sourceImageMatches = (image_id: string) =>
      loaderSourceImageId !== undefined && loaderSourceImageId !== ""
        ? image_id === loaderSourceImageId
        : image_id === modality;

    // Intensity only; masks use createMaskTileLayer.
    const onLoader = SourceChannels.filter(
      (sc) => sourceImageMatches(sc.imageId) && isImageChannel(sc),
    );

    const activeGroup = activeChannelGroupId
      ? channelGroups.find((g) => g.id === activeChannelGroupId)
      : undefined;

    const filled = applyVisibilityTransition(
      SourceChannels,
      channelGroups,
      channelVisibilities ?? {},
      channelGroupRowVisibilities,
      Object.keys(channelVisibilities ?? {}).length === 0
        ? { kind: "fresh" }
        : { kind: "sync" },
    );
    const composited = buildCompositedIntensityLayers({
      onLoader,
      activeGroup,
      channelGroups,
      stackVisibilities: filled.channelVisibilities,
      groupRowVisibilities: filled.channelGroupRowVisibilities,
      hasVisibilityMap: true,
    });

    if (composited.length > MAX_VIV_INTENSITY_CHANNELS && import.meta.env.DEV) {
      console.warn(
        `[viv] ${composited.length} visible intensity channels exceeds ` +
          `MAX_VIV_INTENSITY_CHANNELS=${MAX_VIV_INTENSITY_CHANNELS}; ` +
          "extra channels are hidden until you toggle some off.",
      );
    }

    const layers = composited.slice(0, MAX_VIV_INTENSITY_CHANNELS);
    const selections: Selection[] = [];
    const colors: Color[] = [];
    const contrastLimits: Limit[] = [];
    const channelsVisible: boolean[] = [];
    const sourceChannelIds: string[] = [];

    for (const { sc, gc } of layers) {
      const [lo, hi] = gc
        ? [gc.lowerLimit, gc.upperLimit]
        : effectiveSourceLimits(sc);
      const { r, g, b } = gc
        ? effectiveDisplayColor(sc, SourceChannels, gc)
        : effectiveSourceColor(sc, SourceChannels);
      selections.push({ z: 0, t: 0, c: sc.index });
      colors.push([r, g, b]);
      contrastLimits.push([lo, hi]);
      channelsVisible.push(true);
      sourceChannelIds.push(sc.id);
    }

    return {
      selections,
      colors,
      contrastLimits,
      channelsVisible,
      sourceChannelIds,
      loader,
    };
  };
};

export { toSettings, type Selection, type Color, type Limit };

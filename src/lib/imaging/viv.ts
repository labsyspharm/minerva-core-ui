import type {
  ChannelGroup,
  Channel as SourceChannel,
} from "@/lib/stores/documentStore";
import type { Roi } from "../shapes/roiParser";
import {
  applyVisibilityTransition,
  buildCompositedIntensityLayers,
} from "./channelCompositor";
import {
  isGmmEligible,
  isImageChannel,
  MAX_VIV_INTENSITY_CHANNELS,
} from "./channelKind";
import type { LoaderPlane } from "./loaderTypes";
import {
  effectiveDisplayColor,
  effectiveSourceColor,
  effectiveSourceLimits,
} from "./sourceChannelStyle";

/** CPU raster bytes Deck may keep per layer (not GPU textures). */
const VIV_TILE_MAX_CACHE_BYTE_SIZE = 512 * 1024 * 1024;

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

/** Omit maxCacheSize so Deck's count cap is Infinity when a byte budget is set. */
export const TILE_CACHE_PROPS = {
  maxCacheByteSize: VIV_TILE_MAX_CACHE_BYTE_SIZE,
  onTileLoad: stampDeckTileByteLength,
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

/** Stable Viv channel slots: flip visibility instead of dropping selections. */
function mergeStickyIntensityOccupancy(args: {
  visibleSourceIds: readonly string[];
  stickySourceIds: readonly string[];
  maxChannels: number;
  loaderSourceIds: ReadonlySet<string>;
}): { sourceChannelIds: string[]; channelsVisible: boolean[] } {
  const preferredVisible = args.visibleSourceIds.slice(0, args.maxChannels);
  const visibleSet = new Set(preferredVisible);

  const ids = args.stickySourceIds.filter((id) => args.loaderSourceIds.has(id));
  for (const id of preferredVisible) {
    if (!ids.includes(id)) ids.push(id);
  }

  while (ids.length > args.maxChannels) {
    let dropAt = -1;
    for (let i = ids.length - 1; i >= 0; i--) {
      if (!visibleSet.has(ids[i])) {
        dropAt = i;
        break;
      }
    }
    if (dropAt < 0) dropAt = ids.length - 1;
    ids.splice(dropAt, 1);
  }

  return {
    sourceChannelIds: ids,
    channelsVisible: ids.map((id) => visibleSet.has(id)),
  };
}

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
    stickySourceChannelIds: readonly string[] = [],
    hideUntilGmm = false,
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

    const byId = new Map(composited.map((layer) => [layer.sc.id, layer]));
    const onLoaderById = new Map(onLoader.map((sc) => [sc.id, sc]));
    const { sourceChannelIds, channelsVisible } = mergeStickyIntensityOccupancy(
      {
        visibleSourceIds: composited.map((layer) => layer.sc.id),
        stickySourceIds: stickySourceChannelIds,
        maxChannels: MAX_VIV_INTENSITY_CHANNELS,
        loaderSourceIds: new Set(onLoader.map((sc) => sc.id)),
      },
    );

    const selections: Selection[] = [];
    const colors: Color[] = [];
    const contrastLimits: Limit[] = [];

    for (let i = 0; i < sourceChannelIds.length; i++) {
      const id = sourceChannelIds[i];
      const visibleLayer = byId.get(id);
      const sc = visibleLayer?.sc ?? onLoaderById.get(id);
      if (!sc) {
        throw new Error(`[viv] sticky source ${id} missing from loader`);
      }
      const gc =
        visibleLayer?.gc ??
        activeGroup?.channels.find((row) => row.channelId === id) ??
        null;
      const [lo, hi] = gc
        ? [gc.lowerLimit, gc.upperLimit]
        : effectiveSourceLimits(sc);
      const { r, g, b } = gc
        ? effectiveDisplayColor(sc, SourceChannels, gc)
        : effectiveSourceColor(sc, SourceChannels);
      selections.push({ z: 0, t: 0, c: sc.index });
      colors.push([r, g, b]);
      contrastLimits.push([lo, hi]);
      if (
        hideUntilGmm &&
        isGmmEligible(sc, SourceChannels) &&
        sc.gmmContrastLimits == null
      ) {
        channelsVisible[i] = false;
      }
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

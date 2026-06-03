import type {
  ChannelGroup,
  Channel as SourceChannel,
} from "@/lib/stores/documentStore";
import type { LoaderPlane } from "../authoring/config";
import type { Roi } from "../shapes/roiParser";
import { buildCompositedIntensityLayers } from "./channelCompositor";
import { isImageChannel } from "./channelKind";
import {
  effectiveSourceColor,
  effectiveSourceLimits,
} from "./sourceChannelStyle";

/**
 * Viv's `XRLayer` shader compiles with a fixed `MAX_CHANNELS_PER_LAYER` (6).
 * Passing more than that crashes the WebGL draw with “undefined channels passed
 * in, but only 6 are allowed”. We cap visible intensity layers at this limit
 * and warn so the panel can surface a hint.
 */
export const MAX_VIV_INTENSITY_CHANNELS = 6;

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
  ROIs: Roi[];
};

export type Config = {
  toSettings: (
    activeChannelGroupId: string | null,
    modality: string,
    l?: Loader,
    channelVisibilities?: Record<string, boolean>,
    /** When set (OME multi-image UUID), channel visibility matches this instead of `modality`. */
    loaderSourceImageId?: string,
    channelGroupRowVisibilities?: Record<string, boolean>,
  ) => Settings;
};

/** Full-resolution pixel width/height from OME metadata or the finest pyramid level. */
export function loaderPixelSizeXY(loader: Loader): {
  sizeX: number;
  sizeY: number;
} | null {
  const px = loader.metadata?.Pixels;
  if (
    px &&
    typeof px.SizeX === "number" &&
    typeof px.SizeY === "number" &&
    px.SizeX > 0 &&
    px.SizeY > 0
  ) {
    return { sizeX: px.SizeX, sizeY: px.SizeY };
  }
  const level = loader.data?.[0];
  if (!level) return null;
  const xi = level.labels.indexOf("x");
  const yi = level.labels.indexOf("y");
  if (xi < 0 || yi < 0) return null;
  const sizeX = level.shape[xi];
  const sizeY = level.shape[yi];
  if (sizeX <= 0 || sizeY <= 0) return null;
  return { sizeX, sizeY };
}

const toDefaultSettings = (n) => {
  const chan_range = [...Array(n).keys()];
  const n_shown = 3;
  const n_sub = n_shown; //TODO
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
    _activeChannelGroupId: string | null,
    modality: string,
    loader: Loader | undefined,
    channelVisibilities?: Record<string, boolean>,
    loaderSourceImageId?: string,
    channelGroupRowVisibilities: Record<string, boolean> = {},
  ) => {
    const { SourceChannels, channelGroups = [] } = opts;
    // Defaults
    if (!loader) return toDefaultSettings(3);
    const full_level = loader.data[0];
    const { labels, shape } = full_level;
    const c_idx = labels.indexOf("c");
    const sourceImageMatches = (image_id: string) =>
      loaderSourceImageId !== undefined && loaderSourceImageId !== ""
        ? image_id === loaderSourceImageId
        : image_id === modality;

    // Only intensity sources on this loader image. Masks are rendered by
    // ImageViewer via a separate BitmapLayer and must NOT be added to the
    // XRLayer channel slots.
    const onLoader = SourceChannels.filter(
      (sc) => sourceImageMatches(sc.imageId) && isImageChannel(sc),
    );

    const activeGroup = _activeChannelGroupId
      ? channelGroups.find((g) => g.id === _activeChannelGroupId)
      : undefined;

    const hasVisibilityMap =
      channelVisibilities != null &&
      Object.keys(channelVisibilities).length > 0;
    const composited = buildCompositedIntensityLayers({
      onLoader,
      activeGroup,
      stackVisibilities: channelVisibilities ?? {},
      groupRowVisibilities: channelGroupRowVisibilities,
      hasVisibilityMap,
    });

    // Viv's XRLayer hard caps at MAX_VIV_INTENSITY_CHANNELS visible channels.
    const layersAll = composited;
    const layers = layersAll.slice(0, MAX_VIV_INTENSITY_CHANNELS);
    if (layersAll.length > MAX_VIV_INTENSITY_CHANNELS && import.meta.env.DEV) {
      console.warn(
        `[viv] ${layersAll.length} visible intensity channels exceeds ` +
          `MAX_VIV_INTENSITY_CHANNELS=${MAX_VIV_INTENSITY_CHANNELS}; ` +
          "extra channels are hidden until you toggle some off.",
      );
    }

    const selections: Selection[] = [];
    const colors: Color[] = [];
    const contrastLimits: Limit[] = [];
    const channelsVisible: boolean[] = [];
    const sourceChannelIds: string[] = [];

    for (let i = 0; i < layers.length; i++) {
      const { sc, gc } = layers[i];
      const [lo, hi] = gc
        ? [gc.lowerLimit, gc.upperLimit]
        : effectiveSourceLimits(sc);
      const { r, g, b } = gc ? gc.color : effectiveSourceColor(sc, i);
      selections.push({ z: 0, t: 0, c: sc.index });
      colors.push([r, g, b]);
      contrastLimits.push([lo, hi]);
      channelsVisible.push(true);
      sourceChannelIds.push(sc.id);
    }

    const n_channels = c_idx >= 0 ? shape[c_idx] || 0 : 1;
    const out = {
      ...toDefaultSettings(n_channels),
      selections,
      colors,
      contrastLimits,
      channelsVisible,
      sourceChannelIds,
      loader,
    };
    return out;
  };
};

export { toSettings, type Selection, type Color, type Limit };

import type { LoaderPlane } from "../authoring/config";
import type { Roi } from "../shapes/roiParser";

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
};

type Channel = {
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
  Channels: Channel[];
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
  };
};

const _hexToRGB = (hex: string) => {
  // Remove leading # if it exists
  hex = hex.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return [r, g, b];
};

const toSettings = (opts) => {
  return (
    activeChannelGroupId,
    modality,
    loader,
    channelVisibilities,
    loaderSourceImageId,
  ) => {
    const { Groups, SourceChannels } = opts;
    const group =
      Groups.find(({ id }) => id === activeChannelGroupId) || Groups[0];
    const { channels } = group || { channels: [] };
    // Defaults
    if (!loader) return toDefaultSettings(3);
    const full_level = loader.data[0];
    const { labels, shape } = full_level;
    const c_idx = labels.indexOf("c");
    const sourceImageMatches = (image_id: string) =>
      loaderSourceImageId !== undefined && loaderSourceImageId !== ""
        ? image_id === loaderSourceImageId
        : image_id === modality;
    // TODO Simplify mapping of channel names to indices!
    const selections: Selection[] = channels.map((channel) => {
      const _source_channels = SourceChannels.map(
        (source_channel) => source_channel.id,
      );
      const source_channel = SourceChannels.find(
        (source_channel) => source_channel.id === channel.channelId,
      );
      const c = source_channel?.index || 0;
      return { z: 0, t: 0, c };
    });
    const colors: Color[] = channels.map((c, _i: number) => {
      return [c.color.r, c.color.g, c.color.b];
    });
    const contrastLimits: Limit[] = channels.map((c) => {
      return [c.lowerLimit, c.upperLimit];
    });
    const channelsVisible: boolean[] = channels.map((c, _i: number) => {
      const source_channel = SourceChannels.find(
        (source_channel) => source_channel.id === c.channelId,
      );
      if (!source_channel) return false;
      const { name } = source_channel;
      const image_id = source_channel.imageId;
      const _brightfield = modality === "Brightfield";
      //if (!channelVisibilities || brightfield ) {
      if (!channelVisibilities) {
        return sourceImageMatches(image_id);
      }
      return sourceImageMatches(image_id) && channelVisibilities?.[name];
    });
    const n_channels = shape[c_idx] || 0;
    const out = {
      ...toDefaultSettings(n_channels),
      selections,
      colors,
      contrastLimits,
      channelsVisible,
      loader,
    };
    return out;
  };
};

export { toSettings, type Selection, type Color, type Limit };

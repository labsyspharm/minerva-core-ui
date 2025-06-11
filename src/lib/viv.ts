import type { Group } from "../lib/exhibit";
import type { HashState } from "../lib/hashUtil";

type Selection = Record<"z" | "t" | "c", number>;
type Color = [number, number, number];
type Limit = [number, number];

type Settings = {
  channelsVisible: boolean[];
  selections: Selection[];
  contrastLimits: Limit[];
  colors: Color[];
};

type Channel = {
  ID: string;
  SamplesPerPixel: number;
  Name: string;
}

type TiffDatum = {
  IFD: number;
  PlaneCount: number;
  FirstT: number;
  FirstC: number;
  FirstZ: number;
  UUID: {
    FileName: string;
  };
}

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
}

type Metadata = {
  ID: string;
  AquisitionDate: string;
  Description: string;
  Pixels: Pixels;
}

export type Loader = {
  data: any[];
  metadata: any;
}

export type Config = {
  toSettings: (h: HashState, l?: Loader, g?: any) => Settings;
};

const toDefaultSettings = (n) => {
  const chan_range = [...Array(n).keys()];
  const n_shown = 3;
  const n_sub = n_shown; //TODO
  return {
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
        ][c % 3];
      })
      .slice(0, n_sub),
    contrastLimits: chan_range.map(() => [0, 65535]).slice(0, n_sub),
    channelsVisible: chan_range
      .map((n) => {
        return n < n_shown;
      })
      .slice(0, n_sub),
  };
};

const hexToRGB = (hex: string) => {
  // Remove leading # if it exists
  hex = hex.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return [r, g, b];
};

const toSettings = (opts, brightfield) => {
  return (hash, loaders=[], groups=[]) => {
    const { g } = hash;
    const { marker_names } = opts;
    const loadersData = loaders.map(loader => loader.data);
    // Defaults
    if (!loadersData.length) {
      return toDefaultSettings(brightfield ? 1 : 3);
    }
    const group = (groups || (opts.groups as Group[])).find(
      (group) => group.g === g
    );
    const channels = group?.channels || [];
    // TODO -- not needed if separate channel lists
    //      -- offset solution is currently a hack
    const selections: Selection[] = channels.map(channel => {
        const c = marker_names.indexOf(channel.name) - channel.offset;
        return { ...channel, c, z: 0, t: 0 };
    }).filter(channel => {
      if (brightfield && channel.offset === 0) {
        return false;
      }
      if (!brightfield && channel.offset > 0) {
        return false;
      }
      if (channel.c < 0) {
        console.error(`Missing channel "${channel.name}"`);
        return false;
      }
      return true;
    }).map(
      ({c, z, t, color, contrast}) => ({
        c, z, t, color, contrast
      })
    );
    const n_channels = selections.length;
    const colors: Color[] = selections.map((c) => {
      return c.color ? hexToRGB(c.color) : [0, 0, 0];
    });
    const contrastLimits: Limit[] = selections.map(c => {
      return c.contrast; 
    });
    const channelsVisible = selections.map( c => true );
    const out = {
      ...toDefaultSettings(n_channels),
      selections, colors, contrastLimits, channelsVisible,
    };
    return out;
  };
};

export { toSettings, Selection, Color, Limit };

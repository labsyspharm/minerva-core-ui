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
    const group = (groups || (opts.groups as Group[])).find(
      (group) => group.g === g
    );
    const channels = group?.channels || [];
    // Defaults
    if (!loadersData.length) {
      return toDefaultSettings(3);
    }
    const full_level = loadersData[brightfield? 1 : 0][0];
    if (!loadersData.length) {
      return toDefaultSettings(3);
    }
    const { labels, shape } = full_level;
    const c_idx = labels.indexOf("c");
    const n_channels = shape[c_idx] || 0;
    // TODO Improve mapping of channel names to indices!
    const selections: Selection[] = channels.filter((channel, i) => {
      const c = marker_names.indexOf(channel.name) - channel.offset;
      if (c < 0) {
        console.error(`Missing channel "${channels[i].name}"`);
        return false;
      }
      if (c >= n_channels) {
        return false;
      }
      return true;
    }).map(channel => {
      const c = marker_names.indexOf(channel.name) - channel.offset;
      return { ...channel, z: 0, t: 0, c };
    });
    const colors: Color[] = selections.map((c) => {
      return c.color ? hexToRGB(c.color) : [0, 0, 0];
    });
    const contrastLimits: Limit[] = selections.map(c => {
      return c.contrast; 
    });
    // TODO -- make less hard-coded
    const channelsVisible: boolean[] = selections.map(
      c => brightfield ? c.offset > 1 : c.offset == 0
    );
    if (brightfield) {
      /* TODO -- debug only red channel with brightfield H&E
      // at present, only accessing the red channel is possible
      // due to missing specification of RGB rendering for this layer
      // the workaround on lib/config.ts line 300 is not sufficient
      */ 
      return {
        ...toDefaultSettings(1),
        selections: selections.filter((_,i) => i==0),
        colors: colors.filter((_,i) => i==0),
        contrastLimits: contrastLimits.filter((_,i) => i==0),
        channelsVisible: channelsVisible.filter((_,i) => i==0),
      }
    }
    const out = {
      ...toDefaultSettings(n_channels),
      selections,
      colors,
      contrastLimits,
      channelsVisible,
    };
    return out;
  };
};

export { toSettings, Selection, Color, Limit };

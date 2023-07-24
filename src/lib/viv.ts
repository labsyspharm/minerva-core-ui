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

export type Config = {
  toSettings: (h: HashState, l?: any) => Settings;
};

const toDefaultSettings = (n) => {
  const chan_range = [...Array(n).keys()];
  const n_shown = 3;
  const n_sub = n_shown; //TODO
  return {
    selections: chan_range.map((c) => {
      return { z: 0, t: 0, c: c }
    }).slice(0, n_sub),
    colors: chan_range.map((c) => {
      return [
        [0, 0, 255],
        [0, 255, 0],
        [255, 0, 0],
      ][c%3];
    }).slice(0, n_sub),
    contrastLimits: chan_range.map(() => [0, 65535]).slice(0, n_sub),
    channelsVisible: chan_range.map((n) => {
      return n < n_shown;
    }).slice(0, n_sub),
  }
}

const toSettings = (opts) => {
  return (hash, loader) => {
    const { g } = hash;
    const groups = opts.groups as Group[];
    const group = groups.find((group) => group.g === g);
    const channels = group?.channels || [];
    // Defaults
    if (!loader) return toDefaultSettings(3);
    const full_level = loader[0];
    if (!loader) return toDefaultSettings(3);
    const { labels, shape } = full_level;
    const c_idx = labels.indexOf("c");
    const selections: Selection[] = [];
    const colors: Color[] = [];
    const contrastLimits: Limit[] = [];
    const channelsVisible: boolean[] = [];

    const n_channels = shape[c_idx] || 0;
    const out = toDefaultSettings(n_channels);
    return out;
  };
};

export { toSettings, Selection, Color, Limit };

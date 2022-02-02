import { useHash } from "../lib/hashUtil";

import type { Group } from "../lib/exhibit";

type Selection = Record<"z" | "t" | "c", number>;
type Color = [number, number, number];
type Limit = [number, number];

type Settings = {
  channelsVisible: boolean[],
  selections: Selection[],
  contrastLimits: Limit[],
  colors: Color[]
}

export type Config = {
  settings: Settings
}

const toSettings = (opts) => {
  const { g } = useHash();
  const groups = opts.groups as Group[];
  const group = groups.find(group => group.g === g)
  const channels = group?.channels || [];
  console.log({channels})
  return {
    selections: [
      { z: 0, t: 0, c: 0 },
      { z: 0, t: 0, c: 1 },
      { z: 0, t: 0, c: 2 },
    ],
    colors: [
      [0, 0, 255],
      [0, 255, 0],
      [255, 0, 0],
    ],
    contrastLimits: [
      [0, 65535],
      [0, 65535],
      [0, 65535],
    ],
    channelsVisible: [true, true, true],
  }
}

export {
  toSettings
}

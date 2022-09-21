// Types
import type { HashState } from "./hashUtil";

export type Waypoint = {
  name: string;
  audio?: string;
  markdown: string;
  g: HashState["g"];
  v: HashState["v"];
  lensing?: any,
};

export type Story = {
  waypoints: Waypoint[];
};

export type Channel = {
  color: string;
  name: string;
};

export type Group = {
  name: string;
  path: string;
  g: HashState["g"];
  channels: Channel[];
};

export interface Exhibit {
  stories: Story[];
  groups: Group[];
}

export type ConfigGroup = {
  Name: string;
  Path: string;
  Colors: string[];
  Channels: string[];
};

export interface Config {
  Groups?: ConfigGroup[];
  Stories?: {
    Waypoints: {
      Description: string;
      Group: string;
      Name: string;
      Zoom: number;
      Pan: number[];
      Lensing: any;
    }[];
  }[];
}

const readStories = (config: Config): Story[] => {
  const stories = config.Stories || [];
  const groups = config.Groups || [];
  const groupNames = groups.map((group) => {
    return group.Name;
  });
  const indexGroupName = (name) => {
    return groupNames.indexOf(name);
  };

  return stories.map((story) => {
    return {
      waypoints: story.Waypoints.map((waypoint) => {
        const [x, y] = waypoint.Pan.slice(0, 2);
        return {
          name: waypoint.Name,
          markdown: waypoint.Description,
          g: indexGroupName(waypoint.Group),
          v: [waypoint.Zoom, x, y],
          //
          lensing: Object.assign(waypoint.Lensing, {
            g: indexGroupName(waypoint.Lensing.group),
          }),
          //
        };
      }),
    };
  });
};

const readChannels = (group: ConfigGroup): Channel[] => {
  const colors = group.Colors || [];
  const names = group.Channels || [];
  const named = names.slice(0, colors.length);

  return [...named.keys()].map((k) => {
    return {
      name: names[k],
      color: colors[k],
    };
  });
};

const readGroups = (config: Config): Group[] => {
  const groups = config.Groups || [];
  return groups.map((group, g) => {
    return {
      g,
      name: group.Name,
      path: group.Path,
      channels: readChannels(group),
    };
  });
};

const readConfig = (config: Config): Exhibit => {
  return {
    stories: readStories(config),
    groups: readGroups(config),
  };
};

export { readConfig };

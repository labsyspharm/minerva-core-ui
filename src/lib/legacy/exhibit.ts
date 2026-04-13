// Types

export type Waypoint = {
  name: string;
  audio?: string;
  markdown: string;
  g: number;
  v: number[];
  lensing?: {
    group: string;
  };
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
  g: number;
  channels: Channel[];
};

export interface Exhibit {
  name: string;
  stories: Story[];
  groups: Group[];
}

export type ConfigGroup = {
  Name: string;
  Path: string;
  Colors: string[];
  Channels: string[];
  Lows: number[];
  Highs: number[];
  Image: {
    Method: string;
  };
};

export interface ExhibitConfig {
  Name?: string;
  Groups?: ConfigGroup[];
  Stories?: {
    Waypoints: {
      Description: string;
      Group: string;
      Name: string;
      Zoom: number;
      Pan: [number, number];
      Lensing?: {
        group: string;
      };
    }[];
  }[];
}

const readStories = (config: ExhibitConfig): Story[] => {
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
        const [x, y] = waypoint.Pan.slice(0, 2) as [number, number];
        const output_waypoint: Waypoint = {
          name: waypoint.Name,
          markdown: waypoint.Description,
          g: indexGroupName(waypoint.Group),
          v: [waypoint.Zoom, x, y],
        };
        if ("Lensing" in waypoint) {
          output_waypoint.lensing = Object.assign(waypoint.Lensing, {
            g: indexGroupName(waypoint.Lensing.group),
          });
        }
        return output_waypoint;
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

const readGroups = (config: ExhibitConfig): Group[] => {
  const groups = config.Groups || [];
  return groups.map((group, g) => {
    return {
      g,
      name: group.Name,
      channels: readChannels(group),
    };
  });
};

const readConfig = (config: ExhibitConfig): Exhibit => {
  return {
    name: config.Name,
    stories: readStories(config),
    groups: readGroups(config),
  };
};

export { readConfig };

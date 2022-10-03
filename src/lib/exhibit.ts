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

interface ReadImageMeta {
  (config: Config, i: number): ImageMetadata;
}
export interface ImageMetadata {
  physical_size_x_unit: string,
  physical_size_y_unit: string,
  physical_size_x: number,
  physical_size_y: number,
  size_x: number,
  size_y: number,
}
export interface Image {
  url: string,
  name: string,
  metadata: ImageMetadata,
  description: string,
  width: number,
  height: number,
  maxLevel: number,
  tilesize: number,
  ext: string,
}
export interface Exhibit {
  images: Image[];
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
  PixelsPerMicron: number;
  Images: {
    Path: string,
    Name: string,
    Description: string, 
    Width: number,
    Height: number,
    MaxLevel: number
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

const readImageMeta: ReadImageMeta = (config, i) => {
  const images = config.Images;
  const image = images[i];
  const size_x = image.Width;
  const size_y = image.Height;
  const ppm = config.PixelsPerMicron;
  const physical_size_x = (size_x / ppm) / 1000;
  const physical_size_y = (size_y / ppm) / 1000;
  return {
    physical_size_x_unit: 'mm',
    physical_size_y_unit: 'mm',
    physical_size_x,
    physical_size_y,
    size_x,
    size_y
  };
}
const readImages = (config: Config): Image[] => {
  const images = config.Images || [];
  return images.map((image, i) => {
    return {
      ext: "jpg",
      tilesize: 1024,
      width: image.Width,
      height: image.Height,
      url: image.Path,
      name: image.Name,
      maxLevel: image.MaxLevel,
      description: image.Description,
      metadata: readImageMeta(config, i)
    };
  });
};

const readConfig = (config: Config): Exhibit => {
  return {
    stories: readStories(config),
    groups: readGroups(config),
    images: readImages(config),
  };
};

export { readConfig };

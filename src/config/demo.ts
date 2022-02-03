import { RasterLayers, Formats, Units } from "./generic";
import type { Index, IndexedImage, Layout } from "./generic";
import type { Config } from "./generic";
import type { ReactChild } from 'react'

type Waypoint<C extends unknown> = {
  [k in "scene" | "image"]: Index["index"]
} & {
  "layers"?: Index["index"][], "name"?: string, "children"?: C[]
};

type Story = {
  name?: string,
  container?: Layout,
  waypoints: Waypoint<ReactChild>[]
}

type NarativeConfig = Config & {
  name?: string,
  stories: Story[]
}

type StoryImage = IndexedImage<Formats.ColorJpeg>;
type AuthorImage = IndexedImage<Formats.OmeTiff>;

const urlToFile = (url: string) => {
  const dir = ["Users","jth30","data"];
  const {file} =  [{
    match: new RegExp("/LUNG_3/"),
    file: ["LUNG-3-PR","LUNG-3-PR_40X.ome.tif"],
  }].find(({match}) => {
    return url.match(match);
  }) || {file: null};
  if (file) {
    return [...dir, ...file].join('/');
  }
  return null;
}

const imageToAuthor = (img: StoryImage) => {
  const pathToFile = urlToFile(img.location);
  if (pathToFile !== null) {
    return {
      ...img,
      format: Formats.OmeTiff,
      location: pathToFile
    }
  }
  return null;
}

const isAuthorImage = (img: unknown): img is AuthorImage => {
  const {format = null} = {
    format: null, ...((typeof img === "object") ? img : {})
  }
  return format === Formats.OmeTiff;
}

/*
 * Examples of Narrative Config Objects
 * ___                  __       ___   ___  
 * |__  \_/  /\   |\/| |__) |    |__  /__. 
 * |___ / \ /~~\  |  | |    |___ |___ .__/ 
 * =======================================
 */

const SCENES: Config["scenes"] = [{
    index: 0,
    name: "scene A",
    layers: [{
      index: 0,
      name: "Channel Group A",
      channels: [{
        index: 0, name: "DNA",
        intensity: {min: 0, max: 65535},
        color: {r: 0, g: 0, b: 255}
      }],
      transfers: [],
      intent: RasterLayers.Intensity,
    }],
    camera: {
      center: {
          x: 0.5,
          y: 0.5,
          unit: Units.HeightRatio
        },
      zoom: 1
    }
}]

const IMAGES: StoryImage[]= [{
    index: 0,
    name: "Channel Group A",
    location: "https://s3.amazonaws.com/www.cycif.org/Nature-protocol-2019/LUNG_3/Nuclei_0__DAPI/",
    metadata: {},
    markers: [{
      index: 0,
      channel_number: 1,
      cycle_number: 1,
      marker_name: "DNA_1",
    }],
    shapes: [{
      width: 14448,
      height: 11101,
      unit: Units.ImagePixel
    }, {
      width: 4.6956,
      height: 3.6078,
      unit: Units.Millimeter
    }],
    intent: RasterLayers.Intensity,
    format: Formats.ColorJpeg
  }]

const STORIES: NarativeConfig["stories"] =  [{
    container: {
      styles: {
        height: "100%",
      }
    },
    waypoints: [{ layers: [0], scene: 0, image: 0 }]
  }]

const storyConfig: NarativeConfig = {
  scenes: SCENES,
  images: IMAGES,
  stories: STORIES
}

const authorConfig: NarativeConfig = {
  scenes: SCENES,
  images: IMAGES.map(imageToAuthor).filter(isAuthorImage),
  stories: STORIES
}

console.log({storyConfig, authorConfig})

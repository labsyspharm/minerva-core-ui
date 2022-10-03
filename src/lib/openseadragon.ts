import * as OSD from "openseadragon";
import { Point } from "openseadragon";

import type { Group } from "./exhibit";
import type { HashState } from "./hashUtil";
import type {Props} from '../components/osdView';

type VoidFn = () => void;

export type Context = {
  clear: VoidFn;
  destroy: VoidFn;
  reset: Reset;
  add: (VoidFn) => void;
  viewport: OSD.Viewport;
};

export type Config = {
  zoomInButton?: HTMLButtonElement;
  zoomOutButton?: HTMLButtonElement;
  element?: HTMLDivElement;
};

type StrKeys = "name" | "description" | "url" | "ext";

export type Image = Record<StrKeys, string> & {
  group: Group["path"];
  maxLevel: number;
  tilesize: number;
  height: number;
  width: number;
};

type Reset = (c: Opts) => void;

export type V = [number, number, number];
export type Cache = {
  contexts: any[],
  redraw: boolean,
  l: number,
  g: number,
  v: V,
}

export type ToCache = () => Partial<Cache>;
export type Update = (c: Partial<Cache>) => void;

type Opts = {
  g: HashState["g"];
  v: HashState["v"];
  updateLens: Update;
  update: Update;
  config: Config;
  props: Props,
  lensingConfig: any;
};

export interface MakeImage {
  (p: Props, g: number)
}
const makeImage: MakeImage = (props: Props, g) => {
  const { path } = props.groups[g] || props.groups[0];
  const image = props.images[0];
  return {
    name: "i0",
    description: "",
    url: "https://s3.amazonaws.com/www.cycif.org/crc02-lens-1/story-alpha",
    group: path,
    width: 58709,
    height: 48460,
    tilesize: 1024,
    ext: "jpg",
    maxLevel: 6,
  } as Image;
};

const makeTileSource = (img: Image) => {
  const { url, group, ext } = img;

  const getTileName = (x, y, level) => {
    return `${group}/${level}_${x}_${y}.${ext}`;
  };

  const getTileUrl = function (l, x, y) {
    const level = img.maxLevel - l;

    const name = getTileName(x, y, level);
    return `${url}/${name}`;
  };

  return {
    // Custom functions
    getTileUrl: getTileUrl,
    // Standard parameters
    tileHeight: img.tilesize,
    tileWidth: img.tilesize,
    width: img.width,
    height: img.height,
    maxLevel: img.maxLevel,
    minLevel: 0,
  };
};

const addChannels = (viewer, img: Image) => {
  viewer.addTiledImage({
    crossOriginPolicy: 'anonymous',
    tileSource: makeTileSource(img),
    width: img.width / img.height,
  });
};

const readViewport = ({ viewport }): V => {
  const { x, y } = viewport.getCenter();
  return [viewport.getZoom(), x, y];
};

// FIXME
const setViewport = ({ viewport }, v, now) => {
  // if (v.some((i) => i < 0)) {
  //   return;
  // }
  // viewport.zoomTo(v[0], undefined, now);
  // viewport.panTo(new Point(v[1], v[2]), now);
  // viewport.applyConstraints(true);
};

const toContext = (viewer, reset, event) => {
  const clear = viewer.removeAllHandlers.bind(viewer);
  const destroy = viewer.destroy.bind(viewer, event);
  const add = viewer.addHandler.bind(viewer, event);
  const { viewport } = viewer;
  const ready = true;
  return {
    destroy,
    add,
    clear,
    viewport,
    reset,
    ready,
  };
};

class Handler {
  toCache: ToCache;

  constructor(toCache: ToCache) {
    this.toCache = toCache;
  }

  handle(update) {
    update(this.toCache());
  }
}

const newContext = (opts: Opts, reset: Reset) => {
  const { g, v, props, config, update } = opts;
  const viewer = OSD({
    immediateRender: true,
    maxZoomPixelRatio: 10,
    visibilityRatio: 0.9,
    showHomeControl: false,
    showFullPageControl: false,
    ...(config as any),
  });
  const img = makeImage(props, g);

  addChannels(viewer, img);
  viewer.world.addHandler("add-item", (e) => {
    e.item.setWidth(img.width / img.height);
  });

  const event = "animation-finish";
  const context = toContext(viewer, reset, event);
  const handler = new Handler(() => {
    return { v: readViewport(context) };
  });
  viewer.addHandler(event, () => {
    handler.handle(update);
    setViewport(viewer, v, true);
  });
  setViewport(viewer, v, true);

  return context;
};

class OpenSeadragon {
  context: Context;

  constructor(opts) {
    this.reset(opts);
  }

  reset(opts) {
    if (this.context) {
      opts.v = readViewport(this.context);
      this.context.destroy();
    }
    const reset = this.reset.bind(this);
    const context = newContext(opts, reset);
    this.context = context;
    return context;
  }
}

const OpenSeadragonContext = (opts) => {
  return new OpenSeadragon(opts).context;
};

export { OpenSeadragonContext, readViewport, Reset, Opts, makeImage, addChannels, toContext, Handler, setViewport };

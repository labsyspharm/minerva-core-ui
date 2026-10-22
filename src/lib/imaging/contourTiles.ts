import type { Layer, LayerExtension } from "@deck.gl/core";
import {
  getImageSize,
  isInterleaved,
  MultiscaleImageLayer,
  SIGNAL_ABORTED,
  XRLayer,
} from "@hms-dbmi/viv";
import { isMobileDevice } from "../viewer/isMobileDevice";
import {
  CONTOUR_APRON,
  CONTOUR_MIN_RADIUS,
  CONTOUR_SMOOTHING_STEPS,
  contourExtension,
} from "./contourExtension";
import {
  imageFadeParameters,
  OME_INTENSITY_OVERLAY_PROPS,
} from "./imageOpacity";
import type { HasTile, LoaderPlane, SupportedTypedArray } from "./loaderTypes";

/** Raw tiles kept for stitching edge buffers; neighboring windows share them. */
const RAW_TILE_BYTE_LIMIT = (isMobileDevice() ? 16 : 64) * 1024 * 1024;

type TileConfig = Parameters<LoaderPlane["getTile"]>[0];
type Selection = TileConfig["selection"];

/** Level sizes and log2 downsampling, as Viv's `getPyramidZoomLevels` negated. */
type Pyramid = {
  planes: LoaderPlane[];
  tileSize: number;
  sizes: { width: number; height: number }[];
  octaves: number[];
};

function pyramidOf(planes: LoaderPlane[]): Pyramid {
  const sizes = planes.map((plane) => getImageSize(plane as never));
  const base = sizes[0].width;
  return {
    planes,
    tileSize: planes[0].tileSize,
    sizes,
    octaves: sizes.map((s) => Math.round(Math.log2(base / s.width))),
  };
}

/**
 * The finest level at or below `level` where the kernel fits the edge buffer.
 * Smoothing is in full-resolution pixels, so the field (and its lines) stays
 * put as Viv swaps levels while zooming.
 */
function sampledLevel(
  octaves: number[],
  level: number,
  smoothing: number,
): number {
  const target = Math.log2(smoothing / CONTOUR_APRON);
  for (let i = level; i < octaves.length; i++) {
    if (octaves[i] >= target - 1e-6) return i;
  }
  return octaves.length - 1;
}

type ContourWindow = {
  /** Pyramid level the texture is read from. */
  level: number;
  /** Texture origin and size on that level, edge buffer included. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Tile origin and extent inside the texture, in texels. */
  window: [number, number, number, number];
  /** Kernel radius in texels of the sampled level. */
  radius: number;
  /** Tile bounds in Viv's world units, as its `renderSubLayers` lays them out. */
  bounds: [number, number, number, number];
};

function contourWindow(
  pyramid: Pyramid,
  level: number,
  x: number,
  y: number,
  smoothing: number,
): ContourWindow {
  const { tileSize, sizes, octaves } = pyramid;
  const sampled = sampledLevel(octaves, level, smoothing);
  const fine = sizes[level];
  const coarse = sizes[sampled];
  const innerWidth = Math.min(tileSize, fine.width - x * tileSize);
  const innerHeight = Math.min(tileSize, fine.height - y * tileSize);
  const rx = coarse.width / fine.width;
  const ry = coarse.height / fine.height;
  const ox = x * tileSize * rx;
  const oy = y * tileSize * ry;
  const ex = innerWidth * rx;
  const ey = innerHeight * ry;
  const x0 = Math.floor(ox);
  const y0 = Math.floor(oy);
  const fx = ox - x0;
  const fy = oy - y0;
  const radius = (smoothing * coarse.width) / sizes[0].width;
  const scale = 2 ** octaves[level];
  const left = x * tileSize * scale;
  const top = y * tileSize * scale;
  return {
    level: sampled,
    left: x0 - CONTOUR_APRON,
    top: y0 - CONTOUR_APRON,
    width: Math.ceil(fx + ex) + 2 * CONTOUR_APRON,
    height: Math.ceil(fy + ey) + 2 * CONTOUR_APRON,
    window: [fx + CONTOUR_APRON, fy + CONTOUR_APRON, ex, ey],
    radius: Math.min(CONTOUR_APRON, Math.max(CONTOUR_MIN_RADIUS, radius)),
    bounds: [left, top + innerHeight * scale, left + innerWidth * scale, top],
  };
}

const planeIds = new WeakMap<LoaderPlane, number>();
let nextPlaneId = 1;
/** LRU across all planes, oldest first. */
const rawTiles = new Map<string, { tile: Promise<HasTile>; bytes: number }>();
let rawBytes = 0;

function rawTile(
  plane: LoaderPlane,
  x: number,
  y: number,
  selection: Selection,
): Promise<HasTile> {
  let id = planeIds.get(plane);
  if (id === undefined) {
    id = nextPlaneId++;
    planeIds.set(plane, id);
  }
  const key = `${id}:${x},${y},${selection.t},${selection.c},${selection.z}`;
  const hit = rawTiles.get(key);
  if (hit) {
    rawTiles.delete(key);
    rawTiles.set(key, hit);
    return hit.tile;
  }
  // No abort signal: neighboring windows await the same fetch.
  const tile = plane.getTile({ x, y, selection });
  const entry = {
    tile,
    bytes: (plane.tileSize ** 2 * Number(plane.dtype.replace(/\D/g, ""))) / 8,
  };
  tile.catch(() => {
    if (rawTiles.get(key) !== entry) return;
    rawTiles.delete(key);
    rawBytes -= entry.bytes;
  });
  rawTiles.set(key, entry);
  rawBytes += entry.bytes;
  for (const [oldKey, old] of rawTiles) {
    if (rawBytes <= RAW_TILE_BYTE_LIMIT) break;
    rawTiles.delete(oldKey);
    rawBytes -= old.bytes;
  }
  return tile;
}

/** Rejects with Viv's abort marker once `signal` fires, freeing the request slot. */
function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(SIGNAL_ABORTED);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(SIGNAL_ABORTED);
    signal.addEventListener("abort", onAbort, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/** Copies the window out of the sampled level's tiles, clamping at image edges. */
async function readWindow(
  pyramid: Pyramid,
  win: ContourWindow,
  selection: Selection,
  signal?: AbortSignal,
): Promise<HasTile> {
  const plane = pyramid.planes[win.level];
  const { tileSize } = pyramid;
  const { width: imageWidth, height: imageHeight } = pyramid.sizes[win.level];
  const clampTo = (v: number, size: number) =>
    Math.min(size - 1, Math.max(0, v));
  // Contiguous source spans of each output row; clamped edge texels are spans of one.
  const runs: { tx: number; src: number; dst: number; len: number }[] = [];
  for (let i = 0; i < win.width; i++) {
    const gx = clampTo(win.left + i, imageWidth);
    const tx = Math.floor(gx / tileSize);
    const lx = gx - tx * tileSize;
    const last = runs[runs.length - 1];
    if (last && last.tx === tx && last.src + last.len === lx) last.len++;
    else runs.push({ tx, src: lx, dst: i, len: 1 });
  }
  const tx0 = runs[0].tx;
  const tx1 = runs[runs.length - 1].tx;
  const ty0 = Math.floor(clampTo(win.top, imageHeight) / tileSize);
  const ty1 = Math.floor(
    clampTo(win.top + win.height - 1, imageHeight) / tileSize,
  );
  const rows: Promise<HasTile[]>[] = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    const row: Promise<HasTile>[] = [];
    for (let tx = tx0; tx <= tx1; tx++) {
      row.push(rawTile(plane, tx, ty, selection));
    }
    rows.push(Promise.all(row));
  }
  const tiles = await abortable(Promise.all(rows), signal);
  const Data = tiles[0][0].data.constructor as new (
    n: number,
  ) => SupportedTypedArray;
  const out = new Data(win.width * win.height);
  for (let j = 0; j < win.height; j++) {
    const gy = clampTo(win.top + j, imageHeight);
    const ty = Math.floor(gy / tileSize);
    const ly = gy - ty * tileSize;
    const tileRow = tiles[ty - ty0];
    for (const run of runs) {
      const tile = tileRow[run.tx - tx0];
      const start = ly * tile.width + run.src;
      (out as Uint16Array).set(
        (tile.data as Uint16Array).subarray(start, start + run.len),
        j * win.width + run.dst,
      );
    }
  }
  return { data: out, width: win.width, height: win.height };
}

/**
 * Smoothing steps that still change the lines on these pyramids, viewed at
 * full resolution. A larger step that lands on the same level with the same
 * capped radius is dropped.
 */
export function contourSmoothingStepsFor(
  planeSets: readonly LoaderPlane[][],
): readonly number[] {
  const pyramids: Pyramid[] = [];
  for (const planes of planeSets) {
    if (planes.length === 0) continue;
    const pyramid = pyramidOf(planes);
    if (pyramid.sizes.some((size) => size.width <= 0 || size.height <= 0)) {
      continue;
    }
    pyramids.push(pyramid);
  }
  if (pyramids.length === 0) return CONTOUR_SMOOTHING_STEPS;
  const prev = pyramids.map(() => "");
  const steps: number[] = [];
  for (const smoothing of CONTOUR_SMOOTHING_STEPS) {
    let changed = steps.length === 0;
    for (let i = 0; i < pyramids.length; i++) {
      const win = contourWindow(pyramids[i], 0, 0, 0, smoothing);
      const key = `${win.level}:${win.radius.toFixed(3)}`;
      if (key !== prev[i]) changed = true;
      prev[i] = key;
    }
    if (changed) steps.push(smoothing);
  }
  return steps;
}

/** The window each stitched texture was cut for; Viv passes the arrays through. */
const windowOfTexture = new WeakMap<object, ContourWindow>();
const contourLoaders = new WeakMap<LoaderPlane[], Map<number, LoaderPlane[]>>();

/**
 * Same pyramid, but each tile comes back as the buffered window of
 * `contourWindow`: read from a coarser level when the smoothing allows it.
 */
function contourLoader(
  loader: LoaderPlane[],
  smoothing: number,
): LoaderPlane[] {
  const bySmoothing = contourLoaders.get(loader) ?? new Map();
  contourLoaders.set(loader, bySmoothing);
  const hit = bySmoothing.get(smoothing);
  if (hit) return hit;
  const pyramid = pyramidOf(loader);
  const wrapped = loader.map((plane, level) =>
    Object.create(plane, {
      getTile: {
        value: async ({ x, y, selection, signal }: TileConfig) => {
          const win = contourWindow(pyramid, level, x, y, smoothing);
          const tile = await readWindow(pyramid, win, selection, signal);
          windowOfTexture.set(tile.data, win);
          return tile;
        },
      },
    }),
  ) as LoaderPlane[];
  bySmoothing.set(smoothing, wrapped);
  return wrapped;
}

type SubLayerProps = {
  tile: { index: { x: number; y: number; z: number } };
  data: { data: object[]; width: number; height: number } | null;
  id: string;
};

/**
 * Viv's `renderSubLayers` sizes the tile from its texture, which here holds
 * the edge buffer and may be a coarser level. Bounds come from the window.
 */
function renderContourSubLayers(props: SubLayerProps) {
  const { tile, data, id } = props;
  const win = data?.data[0] && windowOfTexture.get(data.data[0]);
  if (!win) return null;
  const { bounds } = win;
  return new XRLayer(
    props as never,
    {
      channelData: data,
      bounds,
      id: `contour-tile-${bounds}-${id}`,
      tileId: tile.index,
      interpolation: "nearest",
      contourWindow: win.window,
      contourRadius: win.radius,
    } as never,
  );
}

type ImageLayerProps = {
  loader?: LoaderPlane[];
  selections?: unknown[];
  colors?: unknown[];
  contrastLimits?: unknown[];
  channelsVisible?: boolean[];
  sourceChannelIds?: readonly string[];
  opacity?: number;
};

type ContourMask = { extension: LayerExtension; maskId: string };

/** Contoured channel flags parallel to the layer's channels, or null if none. */
function contouredChannels(
  props: ImageLayerProps,
  contourChannelIds: Record<string, boolean>,
): boolean[] | null {
  const loader = props.loader;
  if (!loader?.length || isInterleaved(loader[0].shape)) return null;
  const flags = props.sourceChannelIds?.map((id) =>
    Boolean(contourChannelIds[id]),
  );
  return flags?.some(Boolean) ? flags : null;
}

/**
 * The layer, clipped by `mask` when set. With contoured channels it becomes
 * two layers: the fill with those channels hidden (still fetched, so toggling
 * does not reload it) and their isolines drawn additively above it.
 */
export function withContourLayers(
  layer: Layer,
  opts: {
    contourChannelIds: Record<string, boolean>;
    levels: number;
    smoothing: number;
    mask?: ContourMask;
  },
): Layer[] {
  const { mask } = opts;
  const clip = (extensions: object[]) =>
    mask
      ? { extensions: [...extensions, mask.extension], maskId: mask.maskId }
      : { extensions };
  const props = layer.props as ImageLayerProps;
  const contoured =
    layer instanceof MultiscaleImageLayer
      ? contouredChannels(props, opts.contourChannelIds)
      : null;
  if (!contoured) {
    return [mask ? layer.clone(clip([]) as never) : layer];
  }
  const keep = <T>(values: readonly T[] | undefined) =>
    (values ?? []).filter((_, i) => contoured[i]);
  const fill = layer.clone({
    ...(mask ? clip([]) : {}),
    channelsVisible: contoured.map(
      (on, i) => !on && (props.channelsVisible?.[i] ?? true),
    ),
  } as never);
  const lines = layer.clone({
    id: `${layer.id}-contour`,
    loader: contourLoader(props.loader as LoaderPlane[], opts.smoothing),
    selections: keep(props.selections),
    colors: keep(props.colors),
    contrastLimits: keep(props.contrastLimits),
    channelsVisible: keep(props.channelsVisible),
    renderSubLayers: renderContourSubLayers,
    contourLevels: opts.levels,
    pickable: false,
    ...OME_INTENSITY_OVERLAY_PROPS,
    ...imageFadeParameters(true, props.opacity ?? 1),
    ...clip([contourExtension]),
  } as never);
  return [fill, lines];
}

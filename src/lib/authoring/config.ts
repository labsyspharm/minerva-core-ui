import { getImageSize } from "@hms-dbmi/viv";
import {
  type FloatRange,
  finiteSampleRange,
  isFloatDtype,
} from "../imaging/floatRange";
import { MAX_HISTOGRAM_TILE_PIXELS } from "../imaging/histogramBin";
import { histogramBinTile } from "../imaging/histogramBinPool";
import type {
  HasTile,
  LoaderPlane,
  VivLoaderPlane,
} from "../imaging/loaderTypes";
import type { Loader } from "../imaging/viv";
import type {
  Channel,
  ChannelGroup,
  ClassView,
  StoryShape,
} from "../stores/documentSchema";

export type {
  HasTile,
  LoaderPlane,
  SupportedDtype,
  SupportedTypedArray,
  VivLoaderPlane,
} from "../imaging/loaderTypes";

type VivImageSizeInput = Parameters<typeof getImageSize>[0];

type WaypointState = {
  Expanded: boolean;
};
type ID = { ID: string };
type NameProperty = { Name: string };
type DistributionProperties = {
  UpperRange: number;
  LowerRange: number;
  YValues: number[];
  XScale: string;
  YScale: string;
};
type WaypointProperties = NameProperty & {
  Content: string;
  Bounds?: {
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  };
  Pan?: [number, number];
  Zoom?: number;
  ViewState?: {
    target: [number, number, number];
    zoom: number;
  };
  /** Square JPEG data URL (`data:image/jpeg;base64,…`), 64×64px; see `waypointThumbnail.ts`. */
  ThumbnailDataUrl?: string;
};

export type MutableFields = (keyof ItemRegistryProps)[];
export type ItemRegistryProps = {
  Name: string;
  ChannelGroups: ChannelGroup[];
  /**
   * Waypoint rows for the exhibit author (`Name`/`Bounds`/…); mirror of
   * Zustand `waypoints` via `waypointsToConfigWaypoints` / `waypointToConfigWaypoint`.
   */
  Stories: ConfigWaypoint[];
  /** Global shape registry → `story.json` root `shapes` / cached `jsonExport.shapes`. */
  Shapes?: StoryShape[];
  SourceChannels: Channel[];
  SourceDistributions: ConfigSourceDistribution[];
};
type SetItems = (user: Partial<ItemRegistryProps>) => void;

type Index = {
  x: number;
  y: number;
  z: number;
  c: number;
};
type Four = [number, number, number, number];
type TileProps = {
  id: string;
  dtype?: string;
  channels: number;
  tileSize: number;
  minZoom?: number;
  maxZoom?: number;
  extent?: Four;
};
type ToTilePlane = (z: number, l: LoaderPlane[]) => LoaderPlane;
type FullState = {
  indices: Index[];
  tileProps: TileProps;
};
type InitIn = {
  planes: LoaderPlane[];
};
type Initialize = (i: InitIn) => FullState;
type BinIn = InitIn & {
  bits: number;
  index: Index;
  /** When set, bin linearly across this span instead of the dtype. */
  range?: FloatRange | null;
};
type Bin = (i: BinIn) => Promise<{ y: number[]; range: FloatRange | null }>;
type CaptureTile = (i: Index, planes: LoaderPlane[]) => Promise<HasTile>;

export type ConfigProps = {
  ItemRegistry: ItemRegistryProps;
  ID: string;
};

export type ConfigSourceDistribution = DistributionProperties & {
  id: string;
};
export type ConfigWaypoint = WaypointProperties & {
  id: string;
  State: WaypointState;
  /** Ordered ids into global `shapes` / story.json `waypoints[].shapeIds`. */
  shapeIds?: string[];
  /** References {@link ChannelGroup.id}. */
  groupId?: string;
  /** Story `waypoints[].name`; distinct from the `Name` title. */
  name?: string;
  /** Story `waypoints[].classViews`. */
  classViews?: ClassView[];
};

type ExtractDistributions = (
  loader: Loader,
) => Promise<Map<number, ConfigSourceDistribution>>;
type ExtractChannels = (
  loader: Loader,
  modality: string,
  /** OME: stable document `Image.id` for flat channels; defaults to `modality` (DICOM / legacy). */
  sourceImageId?: string,
  /** Default persisted kind for every extracted channel (import-only). */
  defaultChannelKind?: "channel" | "mask",
) => {
  SourceChannels: Channel[];
  ChannelGroups: ChannelGroup[];
};

const asID = (k: string): ID => ({ ID: k });

/** Per-tile ceiling for histogram `getTile` (remote OME-TIFF); avoids hung lazy `getDistributions`. */
const HISTOGRAM_TILE_TIMEOUT_MS = 10_000;

/** Limit parallel `getTile`+bin work so remote OME-TIFF is less likely to hit timeouts / throttling. */
const HISTOGRAM_EXTRACT_CONCURRENCY = 6;

/**
 * Bit depth passed to `histogramBinFromPixels` (linear ≤8-bit, log2 >8-bit).
 * Integer dtypes parse from the Viv dtype string; float planes use a nominal depth
 * so we still produce a curve instead of skipping (NaN from `parseInt` on "Float32").
 */
function histogramBitsFromDtype(dtype: string | undefined): number | null {
  if (dtype == null || dtype === "") {
    console.warn("[minerva] histogram: missing plane dtype");
    return null;
  }
  const parsed = parseInt(dtype.replace(/.?int/, ""), 10);
  if (!Number.isNaN(parsed)) return parsed;
  if (isFloatDtype(dtype)) return 16;
  console.warn(
    `[minerva] histogram: unsupported dtype "${dtype}" (expected Uint*/Int* or Float*)`,
  );
  return null;
}

async function mapIndicesInBatches<T>(
  indices: Index[],
  batchSize: number,
  fn: (index: Index) => Promise<T>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < indices.length; i += batchSize) {
    const batch = indices.slice(i, i + batchSize);
    out.push(...(await Promise.all(batch.map(fn))));
  }
  return out;
}

const captureTile: CaptureTile = async (index, planes) => {
  const level = Math.abs(index.z);
  const z_plane = planes[level];
  const { x, y } = index;
  const { width: pw, height: ph } = getImageSize(z_plane as VivImageSizeInput);
  const ts = Math.max(1, z_plane.tileSize);
  const tw = Math.max(0, Math.min(ts, pw - x * ts));
  const th = Math.max(0, Math.min(ts, ph - y * ts));
  if (tw * th > MAX_HISTOGRAM_TILE_PIXELS) {
    return { data: new Uint8Array(0), width: 0, height: 0 };
  }
  const selection = { t: 0, z: 0, c: index.c };
  const signal = AbortSignal.timeout(HISTOGRAM_TILE_TIMEOUT_MS);
  const tile = await z_plane.getTile({
    selection,
    x,
    y,
    signal,
  });
  const { width, height, data } = tile;
  return { width, height, data };
};

const bin: Bin = async (inputs) => {
  const { data, width, height } = await captureTile(
    inputs.index,
    inputs.planes,
  );
  if (!data?.length || width * height > MAX_HISTOGRAM_TILE_PIXELS) {
    return { y: [], range: null };
  }
  const dtype = inputs.planes[Math.abs(inputs.index.z)].dtype;
  const range =
    inputs.range ??
    (isFloatDtype(dtype) ||
    data instanceof Float32Array ||
    data instanceof Float64Array
      ? finiteSampleRange(data)
      : null);
  const y = await histogramBinTile(inputs.bits, width, data, range);
  return { y, range };
};

const toTilePlane: ToTilePlane = (zoom, planes) => {
  return planes[Math.max(0, Math.abs(zoom))];
};
const toTileLayer = (planes: LoaderPlane[]): TileProps => {
  const i = 0;
  const id = `Tiled-Image-${i}`;
  const plane = toTilePlane(0, planes);
  const { height, width } = getImageSize(plane as VivImageSizeInput);
  const extent: Four = [0, 0, width, height];
  const { tileSize, dtype } = plane;
  const n_channels = plane.shape[Math.max(1, plane.labels.indexOf("c"))];
  const props = {
    id,
    dtype,
    tileSize,
    extent,
    channels: n_channels || 1,
    minZoom: -(planes.length - 1),
    maxZoom: 0,
  };
  return props;
};

function hasVivLabels(plane): plane is VivLoaderPlane {
  const labels = plane.labels;
  const labels_match = labels.includes("y") && labels.includes("x");
  if (!labels_match) {
    console.error(`
      Channel labels ${labels.join(",")} must include y and x
    `);
  }
  return labels_match;
}

const initialize: Initialize = (inputs) => {
  const { planes } = inputs;
  const tileProps = toTileLayer(
    planes.filter((plane) => {
      return hasVivLabels(plane);
    }),
  );
  const mz = Math.abs(tileProps.minZoom || 0);
  const channels = [...new Array(tileProps.channels).keys()];
  const indices = channels.map((c) => ({
    c,
    z: -mz,
    x: 0,
    y: 0,
  }));
  return { indices, tileProps };
};

/**
 * Histogram tiles for a subset of source channel indices (same `c` as `SourceChannel.SourceIndex`
 * for a single OME-Z / pyramid loader). Used for lazy channel-panel fetching.
 */
const extractDistributionsForSourceIndices = async (
  loader: Loader,
  sourceIndices: readonly number[],
  ranges?: ReadonlyMap<number, FloatRange>,
): Promise<Map<number, ConfigSourceDistribution>> => {
  const init = initialize({ planes: loader.data });
  const dtype = init.tileProps.dtype;
  const bits = histogramBitsFromDtype(dtype);
  const indexByC = new Map(init.indices.map((idx) => [idx.c, idx]));
  const filtered = [...new Set(sourceIndices)].filter((c) => indexByC.has(c));
  if (filtered.length === 0) {
    return new Map();
  }

  const indexObjs = filtered.flatMap((c) => {
    const idx = indexByC.get(c);
    return idx ? [idx] : [];
  });
  const entries = await mapIndicesInBatches(
    indexObjs,
    HISTOGRAM_EXTRACT_CONCURRENCY,
    async (index) => {
      const SourceIndex = index.c;
      let YValues: number[] = [];
      let range: FloatRange | null = null;
      if (bits != null) {
        try {
          const binned = await bin({
            bits,
            index,
            planes: loader.data,
            range: ranges?.get(SourceIndex) ?? null,
          });
          YValues = binned.y;
          range = binned.range;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[minerva] histogram: channel ${SourceIndex} tile/bin failed (${msg})`,
          );
        }
      }
      const floatPlane =
        isFloatDtype(dtype) || isFloatDtype(loader.metadata?.Pixels?.Type);
      const linear = range != null || floatPlane || (bits != null && bits <= 8);
      return [
        SourceIndex,
        {
          id: crypto.randomUUID(),
          YValues,
          XScale: linear ? "linear" : "log",
          YScale: "linear",
          LowerRange: range?.min ?? 0,
          UpperRange: range
            ? range.max
            : bits != null && bits <= 8
              ? 2 ** bits - 1
              : (bits ?? 0),
        },
      ] as [number, ConfigSourceDistribution];
    },
  );

  return new Map<number, ConfigSourceDistribution>(entries);
};

const extractDistributions: ExtractDistributions = async (loader) => {
  const init = initialize({ planes: loader.data });
  const allC = init.indices.map((i) => i.c);
  return extractDistributionsForSourceIndices(loader, allC);
};

const extractChannels: ExtractChannels = (
  loader,
  modality,
  sourceImageId,
  defaultChannelKind = "channel",
) => {
  const init = initialize({ planes: loader.data });
  const { Channels, Type } = loader.metadata.Pixels;
  const channelImageId = sourceImageId ?? modality;
  const SourceChannels = Channels.map((channel, index) => {
    const name = channel?.Name || `Channel ${index + 1}`;
    return {
      id: crypto.randomUUID(),
      name,
      kind: defaultChannelKind,
      samples: channel.SamplesPerPixel,
      index: init.indices[index].c,
      sourceDataTypeId: asID(Type).ID,
      imageId: channelImageId,
    };
  });
  if (
    SourceChannels.length === 1 &&
    SourceChannels[0].samples === 3 &&
    SourceChannels[0].sourceDataTypeId === "Uint8"
  ) {
    // Packed RGB is named H&E but left ungrouped; the user groups it if they want.
    SourceChannels[0].name = "H&E";
  }
  return {
    SourceChannels,
    ChannelGroups: [] as ChannelGroup[],
  };
};

const mutableConfigArrayItem = (array, receiver, index) => (namespace) => {
  const item = array[index][namespace];
  return [
    namespace,
    new Proxy(item, {
      set(...args) {
        Reflect.set(...args);
        receiver.splice(index, 1, array[index]);
        return true;
      },
    }),
  ];
};

const mutableConfigArray = (target_array, set_state) => {
  const methods = [
    "pop",
    "push",
    "shift",
    "unshift",
    "splice",
    "sort",
    "reverse",
    "fill",
    "copyWithin",
  ];
  const namespaces = ["State"];
  return new Proxy(target_array, {
    get(target, key, receiver) {
      const array = target;
      const item = array[key];
      // Specific methods will update the state
      if (methods.includes(String(key))) {
        return new Proxy(item, {
          apply(fn, _, args) {
            const new_state = [...array];
            const output = fn.apply(new_state, args);
            set_state(new_state);
            return output;
          },
        });
      }
      if (
        typeof key !== "string" ||
        typeof item !== "object" ||
        Number.isNaN(parseInt(key, 10))
      ) {
        return item;
      }
      // Setting values will update the state
      return {
        ...item,
        ...Object.fromEntries(
          namespaces.map(
            mutableConfigArrayItem(array, receiver, parseInt(key, 10)),
          ),
        ),
      };
    },
  });
};

const mutableItemRegistry = (
  ItemRegistry: ItemRegistryProps,
  setItems: SetItems,
  fields: MutableFields,
) => {
  // Transform certain fields into mutable arrays
  return fields.reduce((registry, field) => {
    registry[field] = mutableConfigArray(ItemRegistry[field], (updated) => {
      setItems({ [field]: updated });
    });
    return registry;
  }, ItemRegistry);
};

export {
  extractDistributions,
  extractDistributionsForSourceIndices,
  extractChannels,
  mutableItemRegistry,
};

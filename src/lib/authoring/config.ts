import { getImageSize } from "@hms-dbmi/viv";
import type { DTYPE_VALUES } from "@vivjs/constants";
import { histogramBinTile } from "../imaging/histogramBinPool";
import type { Loader } from "../imaging/viv";
import type { ConfigGroup as LegacyConfigGroup } from "../legacy/exhibit";
import type { Channel, Group } from "../stores/documentSchema";
import type { StoryShape } from "../stores/storeUtils";

export type SupportedDtype = keyof typeof DTYPE_VALUES;
export type SupportedTypedArray = InstanceType<
  (typeof globalThis)[`${SupportedDtype}Array`]
>;

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
  Groups: Group[];
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

type Dtype =
  | "Uint8"
  | "Uint16"
  | "Uint32"
  | "Int8"
  | "Int16"
  | "Int32"
  | "Float32"
  | "Float64";
type Index = {
  x: number;
  y: number;
  z: number;
  c: number;
};
type Four = [number, number, number, number];
type TileProps = {
  id: string;
  dtype?: Dtype;
  channels: number;
  tileSize: number;
  minZoom?: number;
  maxZoom?: number;
  extent?: Four;
};
type SelectionConfig = {
  signal?: AbortSignal;
  selection: {
    t: number;
    z: number;
    c: number;
  };
};
type TileConfig = SelectionConfig & {
  x: number;
  y: number;
};
export type LoaderPlane = {
  dtype: Dtype;
  shape: number[];
  tileSize: number;
  labels:
    | [...("t" | "c" | "z" | "y" | "x" | "_c")[], "y", "x", "_c"]
    | [...("t" | "c" | "z" | "y" | "x")[], "y", "x"];
  onTileError: (e: Error) => void;
  getRaster: (s: SelectionConfig) => Promise<HasTile>;
  getTile: (s: TileConfig) => Promise<HasTile>;
};
export type VivLoaderPlane = LoaderPlane & {
  labels: ["t", "c", "z", "y", "x"];
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
};
type Bin = (i: BinIn) => Promise<number[]>;

export type HasTile = {
  data: SupportedTypedArray;
  height: number;
  width: number;
};
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
  /** References {@link Group.id}. */
  groupId?: string;
};

type ExtractDistributions = (
  loader: Loader,
) => Promise<Map<number, ConfigSourceDistribution>>;
type ExtractChannels = (
  loader: Loader,
  modality: string,
  groups: LegacyConfigGroup[],
  /** OME: stable document `Image.id` for flat channels; defaults to `modality` (DICOM / legacy). */
  sourceImageId?: string,
) => {
  SourceChannels: Channel[];
  Groups: Group[];
};

const hex_to_rgb = (c: string) => {
  const n = parseInt(c, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
};

const GROUP_CHANNELS_CRC01 = {
  "Histology_40__HE-r--41__HE-g--42__HE-b": [40, 41, 42],
  "Tissue-Structure_0__DNA1--14__PanCK--15__ASMA--35__CD31--18__CD45": [
    0, 14, 15, 35, 18,
  ],
  "Immune-Populations_0__DNA1--18__CD45--23__CD8a--17__CD4--21__CD20--22__CD68--25__CD163":
    [0, 18, 23, 17, 21, 22],
  "Lymphocytes_0__DNA1--23__CD8a--17__CD4--21__CD20--26__FOXP3": [
    0, 23, 17, 21, 26,
  ],
  "Macrophages_0__DNA1--22__CD68--25__CD163": [0, 22, 25],
  "Proliferation_0__DNA1--37__PCNA--14__PanCK--18__CD45--13__Ki67": [
    0, 37, 14, 18, 13,
  ],
  "PD1-Immune-Checkpoint_0__DNA1--14__PanCK--27__PDL1--19__PD1": [
    0, 14, 27, 19,
  ],
  "Helper-and-Regulatory-T-Cells_0__DNA1--17__CD4--26__FOXP3": [0, 17, 26],
  "CD8-Cytotoxic-T-Cells_0__DNA1--23__CD8a--19__PD1": [0, 23, 19],
  "FOXP3-CD8-T-Cells_0__DNA1--23__CD8a--26__FOXP3": [0, 23, 26],
  "NaK-ATPase_0__DNA1--14__PanCK--10__Na-K-ATPase": [0, 14, 10],
  "E-Cadherin_0__DNA1--14__PanCK--29__Ecadherin": [0, 14, 29],
  "Stroma_0__DNA1--15__ASMA--34__Desmin--39__Collagen--30__Vimentin": [
    0, 15, 34, 39, 30,
  ],
  "PDL1-Positive-Immune-Cells_0__DNA1--17__CD4--22__CD68--25__CD163--27__PDL1":
    [0, 17, 22, 25, 27],
  "PDL1-CD8-Interaction_0__DNA1--27__PDL1--23__CD8a--19__PD1": [0, 27, 23, 19],
  "Tumor-Budding-Epithelial_0__DNA1--14__PanCK--29__Ecadherin--37__PCNA": [
    0, 14, 29, 37,
  ],
  "Tumor-Budding-Immune-Modulation_0__DNA1--14__PanCK--27__PDL1--26__FOXP3--23__CD8a--19__PD1--22__CD68":
    [0, 14, 27, 26, 23, 19],
  "Nuclear-Lamina_0__DNA1--33__LaminABC": [0, 33],
  "DAPI-Cycle-Correlation_0__DNA1--36__DNA10": [0, 36],
  "Transitions_0__DNA1--14__PanCK--29__Ecadherin--37__PCNA": [0, 14, 29, 37],
};

const asID = (k: string): ID => ({ ID: k });

/** Per-tile ceiling for histogram `getTile` (remote OME-TIFF); avoids hung lazy `getDistributions`. */
const HISTOGRAM_TILE_TIMEOUT_MS = 10_000;

/** Limit parallel `getTile`+bin work so remote OME-TIFF is less likely to hit timeouts / throttling. */
const HISTOGRAM_EXTRACT_CONCURRENCY = 6;

/**
 * Bit depth passed to `histogramBinFromPixels` (log-spaced thresholds up to 2^bits).
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
  if (/float/i.test(dtype)) {
    return 16;
  }
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
  const selection = { t: 0, z: 0, c: index.c };
  const { x, y } = index;
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
  const { data, width } = await captureTile(inputs.index, inputs.planes);
  return histogramBinTile(inputs.bits, width, data);
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
): Promise<Map<number, ConfigSourceDistribution>> => {
  const init = initialize({ planes: loader.data });
  const dtype = init.tileProps.dtype;
  const bits = histogramBitsFromDtype(dtype);
  const indexByC = new Map(init.indices.map((idx) => [idx.c, idx]));
  const filtered = [...new Set(sourceIndices)].filter((c) => indexByC.has(c));
  if (filtered.length === 0) {
    return new Map();
  }

  let tileErrorCount = 0;
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
      if (bits != null) {
        try {
          YValues = await bin({
            bits,
            index,
            planes: loader.data,
          });
        } catch (err) {
          tileErrorCount += 1;
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[minerva] histogram: channel ${SourceIndex} tile/bin failed (${msg})`,
          );
        }
      }
      return [
        SourceIndex,
        {
          id: crypto.randomUUID(),
          YValues,
          XScale: "log",
          YScale: "linear",
          LowerRange: 0,
          UpperRange: bits ?? 0,
        },
      ] as [number, ConfigSourceDistribution];
    },
  );

  const nonEmpty = entries.filter(([, d]) => d.YValues.length > 0).length;
  const emptyCurves = entries.length - nonEmpty;
  const skippedNoBits = bits == null ? filtered.length : 0;
  console.log(
    `[minerva] histogram extract: dtype=${dtype} effectiveBits=${bits ?? "none"} requested=${sourceIndices.length} resolved=${filtered.length} nonEmpty=${nonEmpty} emptyCurve=${emptyCurves} tileErrors=${tileErrorCount} skippedNoBits=${skippedNoBits}`,
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
  groups,
  sourceImageId,
) => {
  const init = initialize({ planes: loader.data });
  const { Channels, Type } = loader.metadata.Pixels;
  const channelImageId = sourceImageId ?? modality;
  const stripCycif = (name: string) =>
    name.startsWith("CYCIF_") ? name.slice(6) : name;
  const SourceChannels = Channels.map((channel, index) => ({
    id: crypto.randomUUID(),
    name: stripCycif(channel.Name),
    samples: channel.SamplesPerPixel,
    index: init.indices[index].c,
    sourceDataTypeId: asID(Type).ID,
    imageId: channelImageId,
  }));
  // Match hard-coded groups to existing channels. GROUP_CHANNELS_CRC01 maps Path →
  // indices into OME Pixels.Channels (same order as SourceChannels), not "Channel N" strings.
  const hardcoded_crc01 = groups.reduce(
    ({ name_map, Groups }, g) => {
      if (!(g.Path in GROUP_CHANNELS_CRC01)) {
        return { name_map, Groups };
      }
      const channel_indices = GROUP_CHANNELS_CRC01[g.Path];
      if (g.Channels.length !== channel_indices.length) {
        return { name_map, Groups };
      }
      const outOfRange = channel_indices.filter(
        (idx) => idx < 0 || idx >= SourceChannels.length,
      );
      if (outOfRange.length > 0) {
        return { name_map, Groups };
      }
      const new_name_map = { ...name_map };
      for (let i = 0; i < channel_indices.length; i++) {
        const idx = channel_indices[i];
        new_name_map[g.Channels[i]] = SourceChannels[idx].id;
      }
      const new_group_uuid = crypto.randomUUID();
      const new_group: Group = {
        id: new_group_uuid,
        expanded: false,
        name: g.Name,
        channels: g.Channels.reduce(
          (new_group_channels, name, index) => {
            if (!(name in new_name_map)) {
              return new_group_channels;
            }
            const color = g.Colors[index];
            return new_group_channels.concat({
              id: crypto.randomUUID(),
              channelId: new_name_map[name],
              color: hex_to_rgb(color),
              lowerLimit: g.Lows[index],
              upperLimit: g.Highs[index],
            });
          },
          [] as Group["channels"],
        ),
      };
      return {
        name_map: new_name_map,
        Groups: Groups.concat([new_group]),
      };
    },
    {
      Groups: [] as Group[],
      name_map: {} as Record<string, string>,
    },
  );
  const name_map = hardcoded_crc01.name_map;
  const reverse_name_map = Object.fromEntries(
    Object.entries(name_map).map(([k, v]) => [v, k]),
  );
  if (Object.keys(name_map).length) {
    SourceChannels.forEach((sourceChannel) => {
      if (sourceChannel.id in reverse_name_map) {
        sourceChannel.name = reverse_name_map[sourceChannel.id];
      }
    });
    const { Groups } = hardcoded_crc01;
    return {
      SourceChannels,
      Groups,
    };
  } else if (
    SourceChannels.length === 1 &&
    SourceChannels[0].samples === 3 &&
    SourceChannels[0].sourceDataTypeId === "Uint8"
  ) {
    const group_uuid = crypto.randomUUID();
    const groupName = "Hematoxylin & Eosin";
    const channelName = "H&E";
    const Groups: Group[] = [
      {
        id: group_uuid,
        expanded: true,
        name: groupName,
        channels: SourceChannels.map((channel, _index) => {
          return {
            id: crypto.randomUUID(),
            channelId: channel.id,
            color: hex_to_rgb("cc00ff"),
            lowerLimit: 0,
            upperLimit: 255,
          };
        }),
      },
    ];
    if (SourceChannels.length === 1) {
      SourceChannels[0].name = channelName;
    }
    return {
      SourceChannels,
      Groups,
    };
  }
  const group_size = 4;
  const Groups: Group[] = [
    ...Array(Math.ceil(SourceChannels.length / group_size)).keys(),
  ].map((group_index) => {
    const group_uuid = crypto.randomUUID();
    return {
      id: group_uuid,
      expanded: false,
      name: `Group ${group_index}`,
      channels: SourceChannels.slice(
        group_index * group_size,
        (group_index + 1) * group_size,
      ).map((channel, index) => {
        const color_id = ["0dabff", "c3ff00", "ff8b00", "ff00c7"][index % 4];
        return {
          id: crypto.randomUUID(),
          channelId: channel.id,
          color: hex_to_rgb(color_id),
          lowerLimit: 2 ** 5, //TODO
          upperLimit: 2 ** 14, //TODO
        };
      }),
    };
  });
  return {
    SourceChannels,
    Groups,
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

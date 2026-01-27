import { useRef, useEffect } from "react";
import { getImageSize } from "@hms-dbmi/viv";
import { list_colors } from "../minerva-author-ui/author";

import type { ConfigGroup as LegacyConfigGroup } from "./exhibit";
import type { Loader } from './viv';

type ExpandedState = {
  Expanded: boolean;
};
type GroupState = ExpandedState;
type GroupChannelState = ExpandedState;
type WaypointState = ExpandedState;

type ID = { ID: string; };
type UUID = { UUID: string };
type NameProperty = { Name: string; };
type GroupProperties = NameProperty;
type DistributionProperties = {
  UpperRange: number;
  LowerRange: number;
  YValues: number[];
  XScale: string;
  YScale: string;
};
type SourceChannelProperties = NameProperty & {
  SourceIndex: number;
  Samples: number;
};
type GroupChannelProperties = {
  LowerRange: number;
  UpperRange: number;
};
type WaypointProperties = NameProperty & {
  Content: string;
  Pan?: [number, number];
  Zoom?: number;
  Group?: string;
};

// Arrow annotation from config
export type ConfigWaypointArrow = {
  Angle: number;
  HideArrow: boolean;
  Point: [number, number];
  Text: string;
};

// Overlay (rectangle) annotation from config
export type ConfigWaypointOverlay = {
  x: number;
  y: number;
  width: number;
  height: number;
  Group: string;
};

type SourceChannelAssociations = Record<
  'SourceDataType', ID 
> & Partial<Record<
  'SourceDistribution', UUID
>> & Record<
  'SourceImage', UUID
>;
type GroupChannelAssociations = Record<
  'Color', ID 
> & Record<
  'SourceChannel' | 'Group',
  UUID
>;

export type MutableFields = (keyof ItemRegistryProps)[]
export type ItemRegistryProps = {
  Name: string;
  Groups: ConfigGroup[];
  Colors: ConfigColor[];
  Stories: ConfigWaypoint[];
  GroupChannels: ConfigGroupChannel[];
  SourceChannels: ConfigSourceChannel[];
  SourceDistributions: ConfigSourceDistribution[];
}
interface SetItems {
  (user: Partial<ItemRegistryProps>): void;
}

type Dtype = (
  "Uint8" | "Uint16" | "Uint32" |
  "Int8" | "Int16" | "Int32" | 
  "Float32" | "Float64"
)
type TypedArray = (
  Int8Array | Uint8Array | Int16Array | Uint16Array |
  Int32Array | Uint32Array | Uint8ClampedArray |
  Float32Array | Float64Array
)
type Index = {
  x: number, y: number, z: number, c: number
}
type Four = [number, number, number, number];
type TileProps = {
  id: string,
  dtype?: Dtype,
  channels: number,
  tileSize: number,
  minZoom?: number,
  maxZoom?: number,
  extent?: Four 
}
type TileConfig = {
  x: number,
  y: number,
  signal: AbortSignal,
  selection: {
    t: number,
    z: number,
    c: number
  } 
}
type LoaderPlane = {
  dtype: Dtype,
  shape: number[],
  tileSize: number,
  labels: string[],
  getTile: (s: TileConfig) => Promise<HasTile>
}
interface ToTilePlane {
  (z: number, l: LoaderPlane[]): LoaderPlane;
}
type FullState = {
  indices: Index[],
  tileProps: TileProps,
}
type InitIn = {
  planes: LoaderPlane[]
}
interface Initialize {
  (i: InitIn): FullState;
}
type BinIn = InitIn & {
  bits: number,
  index: Index
}
interface Bin {
  (i: BinIn): Promise<number[]>;
}

type HasTile = {
  data: TypedArray 
  height: number,
  width: number
}
interface CaptureTile {
  (i: Index, planes: LoaderPlane[]): Promise<HasTile>;
}

export type ConfigProps = {
  ItemRegistry: ItemRegistryProps;
  ID: string;
};

export type ConfigSourceDistribution = UUID & {
  Properties: DistributionProperties;
};
export type ConfigSourceChannel = UUID & {
  Properties: SourceChannelProperties;
  Associations: SourceChannelAssociations;
};
export type ConfigGroupChannel = UUID & {
  State: GroupChannelState;
  Properties: GroupChannelProperties;
  Associations: GroupChannelAssociations;
};
export type ConfigGroup = UUID & {
  State: GroupState;
  Properties: GroupProperties;
};
export type ConfigWaypoint = UUID & {
  State: WaypointState;
  Properties: WaypointProperties;
  Arrows?: ConfigWaypointArrow[];
  Overlays?: ConfigWaypointOverlay[];
// TODO use UUID for group
/*  Associations: {
    Group: UUID
  }
*/

};
export type ConfigColor = ID & {
  Properties: {
    R: number,
    G: number,
    B: number,
    Space: string
  }
}
interface ExtractDistributions {
  (loader: Loader): Promise<
    Map<number, ConfigSourceDistribution>
  >
}
interface ExtractChannels {
  (loader: Loader, modality: string, groups: LegacyConfigGroup[]): {
    SourceChannels: ConfigSourceChannel[];
    GroupChannels: ConfigGroupChannel[];
    Colors: ConfigColor[];
    Groups: ConfigGroup[];
  }
}

const GROUP_CHANNELS_CRC01 = {
    "Histology_40__HE-r--41__HE-g--42__HE-b": [
        40,
        41,
        42
    ],
    "Tissue-Structure_0__DNA1--14__PanCK--15__ASMA--35__CD31--18__CD45": [
        0,
        14,
        15,
        35,
        18
    ],
    "Immune-Populations_0__DNA1--18__CD45--23__CD8a--17__CD4--21__CD20--22__CD68--25__CD163": [
        0,
        18,
        23,
        17,
        21,
        22
    ],
    "Lymphocytes_0__DNA1--23__CD8a--17__CD4--21__CD20--26__FOXP3": [
        0,
        23,
        17,
        21,
        26
    ],
    "Macrophages_0__DNA1--22__CD68--25__CD163": [
        0,
        22,
        25
    ],
    "Proliferation_0__DNA1--37__PCNA--14__PanCK--18__CD45--13__Ki67": [
        0,
        37,
        14,
        18,
        13
    ],
    "PD1-Immune-Checkpoint_0__DNA1--14__PanCK--27__PDL1--19__PD1": [
        0,
        14,
        27,
        19
    ],
    "Helper-and-Regulatory-T-Cells_0__DNA1--17__CD4--26__FOXP3": [
        0,
        17,
        26
    ],
    "CD8-Cytotoxic-T-Cells_0__DNA1--23__CD8a--19__PD1": [
        0,
        23,
        19
    ],
    "FOXP3-CD8-T-Cells_0__DNA1--23__CD8a--26__FOXP3": [
        0,
        23,
        26
    ],
    "NaK-ATPase_0__DNA1--14__PanCK--10__Na-K-ATPase": [
        0,
        14,
        10
    ],
    "E-Cadherin_0__DNA1--14__PanCK--29__Ecadherin": [
        0,
        14,
        29
    ],
    "Stroma_0__DNA1--15__ASMA--34__Desmin--39__Collagen--30__Vimentin": [
        0,
        15,
        34,
        39,
        30
    ],
    "PDL1-Positive-Immune-Cells_0__DNA1--17__CD4--22__CD68--25__CD163--27__PDL1": [
        0,
        17,
        22,
        25,
        27
    ],
    "PDL1-CD8-Interaction_0__DNA1--27__PDL1--23__CD8a--19__PD1": [
        0,
        27,
        23,
        19
    ],
    "Tumor-Budding-Epithelial_0__DNA1--14__PanCK--29__Ecadherin--37__PCNA": [
        0,
        14,
        29,
        37
    ],
    "Tumor-Budding-Immune-Modulation_0__DNA1--14__PanCK--27__PDL1--26__FOXP3--23__CD8a--19__PD1--22__CD68": [
        0,
        14,
        27,
        26,
        23,
        19
    ],
    "Nuclear-Lamina_0__DNA1--33__LaminABC": [
        0,
        33
    ],
    "DAPI-Cycle-Correlation_0__DNA1--36__DNA10": [
        0,
        36
    ],
    "Transitions_0__DNA1--14__PanCK--29__Ecadherin--37__PCNA": [
        0,
        14,
        29,
        37
    ]
}; 

const asID = (k: string): ID => ({ ID: k });
const asUUID = (k: string): UUID => ({ UUID: k });
const onlyUUID = (v: UUID): UUID => (asUUID(v.UUID));

const captureTile: CaptureTile = async (index, planes) => {
  const level = Math.abs(index.z);
  const z_plane = planes[level];
  const selection = { t: 0, z: 0, c: index.c };
  const signal = (AbortSignal as any).timeout(10*1000);
  const { x, y } = index;
  const tile = await z_plane.getTile({
    selection, x, y, signal
  })
  const { width, height, data } = tile;
  return { width, height, data };
}

const bin: Bin = async (inputs) => {
  const n_bins = 50;
  const max_power = inputs.bits;
  const thresholds = [...new Array(n_bins).keys()].map(x => {
    return Math.floor(2 ** (max_power * x / n_bins));
  });
  // Load the image tile for given index
  const { data, width } = await captureTile(
    inputs.index, inputs.planes
  );
  const step = 4;
  // Sample along pixel grid of step size in x and y
  let indices = [ ...new Array(data.length).keys() ].filter(
    i => (i % step === 0) || Math.floor(i / width) % step === 0
  );
  // Count indices with data between thresholds
  return thresholds.reduce((binned, threshold, t) => {
    if (t > 0 && thresholds[t-1] == threshold) {
      return binned.concat(binned.slice(-1));
    }
    const outside_indices = indices.filter(i => data[i] > threshold);
    const pixel_count = indices.length - outside_indices.length;
    indices = outside_indices;
    binned.push(pixel_count);
    return binned;
  }, []);
}

const toTilePlane: ToTilePlane = (zoom, planes) => {
  return planes[Math.max(0, Math.abs(zoom))];
}
const toTileLayer = (planes: LoaderPlane[]): TileProps => {
  const i = 0;
  const id = `Tiled-Image-${i}`;
  const plane = toTilePlane(0, planes);
  const { height, width } = getImageSize(plane as any);
  const extent: Four = [0, 0, width, height];
  const { tileSize, dtype } = plane;
  const label_shapes = plane.labels.reduce(
    (obj, label, i) => ({...obj, [label]: plane.shape[i] }), {}
  );
  const props = {
    id,
    dtype,
    tileSize,
    extent,
    channels: label_shapes['c'] || 1,
    minZoom: -(planes.length - 1),
    maxZoom: 0
  };
  return props;
}

const initialize: Initialize = (inputs) => {
  const { planes } = inputs; 
  const tileProps = toTileLayer(planes);
  const mz = Math.abs(tileProps.minZoom || 0);
  const channels = [
    ...new Array(tileProps.channels).keys()
  ];
  const indices = channels.map(c => ({
    c, z: -mz, x: 0, y: 0
  }))
  return { indices, tileProps };
}

const extractDistributions: ExtractDistributions = async (loader) => {
  const init = initialize({ planes: loader.data });
  const bits = parseInt(
    init.tileProps.dtype.replace(/.?int/, '')
  )
  const SourceDistributionEntries = await Promise.all(
    init.indices.map(async (index) => {
      const SourceIndex = index.c;
      const YValues = isNaN(bits) ? [] : await bin({ 
        bits, index, planes: loader.data
      });
      return [
        SourceIndex, {
          UUID: crypto.randomUUID(), Properties: {
            YValues, XScale: 'log', YScale: 'linear',
            LowerRange: 0, UpperRange: bits
          }
        }
      ] as [number, ConfigSourceDistribution];
    })
  );
  // Map from image channel to distribution 
  return new Map<number, ConfigSourceDistribution>(
    SourceDistributionEntries
  );
}

const extractChannels: ExtractChannels = (loader, modality, groups) => {
  const init = initialize({ planes: loader.data });
  const { Channels, Type } = loader.metadata.Pixels;
  const SourceChannels = Channels.map(
    (channel, index) => ({
      UUID: crypto.randomUUID(),
      Properties: {
        Name: channel.Name,
        Samples: channel.SamplesPerPixel,
        SourceIndex: init.indices[index].c,
      },
      Associations: {
        SourceDataType: asID(Type),
        SourceImage: asUUID(modality) //TODO
      }
    })
  );
  const Colors = [...new Set(
    groups.reduce((colors, g) => {
      return g.Colors.reduce((colors, c) => {
        const n = parseInt(c, 16);
        const R = (n >> 16) & 255;
        const G = (n >> 8) & 255;
        const B = n & 255;
        return [
          ...colors,
          {
            ID: `sRGB#${c}`,
            Properties: {
              R, G, B,
              Space: "sRGB",
              LowerRange: 0,
              UpperRange: 255
            }
          }
        ]
      }, colors);
    }, [
      ...list_colors("sRGB"), {
        ID: "sRGB#cc00ff",
        Properties: {
          R: 204, G: 0, B: 255,
          Space: "sRGB",
          LowerRange: 0,
          UpperRange: 255
        }
      }
    ])
  )]
  // Match hard-coded groups to existing channels
  const hardcoded_crc01 = groups.reduce(
    ({ name_map, Groups, GroupChannels }, g) => {
      if (!(g.Path in GROUP_CHANNELS_CRC01)) {
        return { name_map, Groups, GroupChannels };
      }
      const channel_names = GROUP_CHANNELS_CRC01[g.Path].map(
        n => `Channel ${n}`
      );
      const valid_names = SourceChannels.map(
        ({ Properties }) => Properties.Name
      )
      if (g.Channels.length !== channel_names.length) {
        return { name_map, Groups, GroupChannels };
      }
      const all_match = channel_names.every(name => (
        valid_names.includes(name)
      ));
      if (!all_match) {
        return { name_map, Groups, GroupChannels };
      }
      // Update Source Channel Names
      const new_name_map = SourceChannels.reduce(
        (nmap, sourceChannel) => {
          const in_group_idx = channel_names.indexOf(
            sourceChannel.Properties.Name
          )
          if (in_group_idx >= 0) {
            const descriptive_name = g.Channels[in_group_idx];
            return {
              ...nmap,
              [descriptive_name]: sourceChannel.UUID
            }
          }
          return nmap;
        },
        name_map
      );
      const new_group = {
        UUID: crypto.randomUUID(),
        State: { Expanded: false },
        Properties: {
          Name: g.Name 
        }
      }
      const new_group_channels = g.Channels.reduce(
        (new_group_channels, name, index) => {
          if (!(name in new_name_map)) {
            return new_group_channels;
          }
          const color = g.Colors[index];
          const color_id = `sRGB#${color}`;
          return new_group_channels.concat({
            UUID: crypto.randomUUID(),
            State: { Expanded: true },
            Properties: {
              LowerRange: g.Lows[index],
              UpperRange: g.Highs[index] 
            },
            Associations: {
              SourceChannel: asUUID(new_name_map[name]),
              Color: asID(color_id),
              Group: asUUID(new_group.UUID)
            }
          })
        },
        [] as ConfigGroupChannel[]
      )
      return {
        name_map: new_name_map,
        Groups: Groups.concat([new_group]),
        GroupChannels: GroupChannels.concat(new_group_channels)
      }
    },
    {
      Groups: [] as ConfigGroup[],
      GroupChannels: [] as ConfigGroupChannel[],
      name_map: {} as Record<string, string>
    }
  );
  const name_map = hardcoded_crc01.name_map;
  const reverse_name_map = Object.fromEntries(
    Object.entries(name_map).map(([k,v]) => [v,k])
  )
  if (Object.keys(name_map).length) {
    SourceChannels.forEach(
      (sourceChannel) => {
        if (sourceChannel.UUID in reverse_name_map) {
          sourceChannel.Properties.Name = reverse_name_map[
            sourceChannel.UUID
          ];
        }
      }
    );
    const { GroupChannels, Groups } = hardcoded_crc01;
    return {
      SourceChannels,
      GroupChannels,
      Groups,
      Colors
    }
  }
  else if (
    ( SourceChannels.length === 1 ) &&
    ( SourceChannels[0].Properties.Samples === 3 ) &&
    ( SourceChannels[0].Associations.SourceDataType.ID === "Uint8" )
  ) {
    const groupName = "Hematoxylin & Eosin";
    const channelName = "H&E";
    const Groups = [{
      UUID: crypto.randomUUID(),
      State: { Expanded: true },
      Properties: {
        Name: groupName
      }
    }]
    const GroupChannels = SourceChannels.map(
      (channel, index) => {
        const group_uuid = Groups[0].UUID;
        return {
          UUID: crypto.randomUUID(),
          State: { Expanded: true },
          Properties: {
            LowerRange: 0,
            UpperRange: 255 
          },
          Associations: {
            SourceChannel: onlyUUID(channel),
            Color: asID("sRGB#cc00ff"),
            Group: asUUID(group_uuid)
          }
        }
      }
    )
    if (SourceChannels.length === 1) {
      SourceChannels[0].Properties.Name = channelName;
    }
    return {
      SourceChannels,
      GroupChannels,
      Groups,
      Colors 
    }
  }
  const group_size = 4;
  const Groups = [...Array(Math.ceil(
      SourceChannels.length / group_size
  )).keys()].map(
    index => ({
      UUID: crypto.randomUUID(),
      State: { Expanded: false },
      Properties: {
        Name: `Group ${index}`
      }
    })
  )
  const GroupChannels = SourceChannels.map(
    (channel, index) => {
      const group_index = Math.floor(index / group_size);
      const group_uuid = Groups[group_index].UUID;
      const color_id = [
        'sRGB#0dabff', 'sRGB#c3ff00',
        'sRGB#ff8b00', 'sRGB#ff00c7'
      ][
        index % 4
      ];
      return {
        UUID: crypto.randomUUID(),
        State: { Expanded: true },
        Properties: {
          LowerRange: 2**5, //TODO
          UpperRange: 2**14  //TODO
        },
        Associations: {
          SourceChannel: onlyUUID(channel),
          Color: asID(color_id),
          Group: asUUID(group_uuid)
        }
      }
    }
  )
  return {
    SourceChannels,
    GroupChannels,
    Groups,
    Colors
  }
}

const mutableConfigArrayItem = (
  array, receiver, index
) => namespace => {
  const item = array[index][namespace];
  return [
    namespace, new Proxy(item, {
        set(...args) {
          Reflect.set(...args);
          receiver.splice(
            index, 1, array[index]
          );
          return true;
        }
    })
  ];
}

const mutableConfigArray = (
  target_array, set_state, 
) => {
  const methods = [
    'pop', 'push', 'shift', 'unshift',
    'splice', 'sort', 'reverse',
    'fill', 'copyWithin'
  ];
  const namespaces = [
    'State', 'Properties', 'Associations'
  ];
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
          }
        });
      }
      if (
        (typeof key != 'string')
        || (typeof item != 'object')
        || isNaN(parseInt(key))
      ) {
        return item;
      }
      // Setting values will update the state
      return {
        ...item, ...Object.fromEntries(
          namespaces.map(mutableConfigArrayItem(
            array, receiver, parseInt(key) 
          ))
        )
      };
    }
  });
}

const mutableItemRegistry = (
  ItemRegistry: ItemRegistryProps, setItems: SetItems,
  fields: MutableFields
) => {
  // Transform certain fields into mutable arrays
  return fields.reduce((registry, field) => ({
    ...registry, [field]: mutableConfigArray(
      ItemRegistry[field], updated => {
        setItems({ [field]: updated })
      }
    )
  }), ItemRegistry);
}

export {
  onlyUUID, extractDistributions,
  extractChannels, mutableItemRegistry
}

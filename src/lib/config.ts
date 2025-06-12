import { useRef, useEffect } from "react";
import { getImageSize } from "@hms-dbmi/viv";
import { list_colors } from "minerva-author-ui";

import type { Loader } from './viv';

type ExpandedState = {
  Expanded: boolean;
};
type GroupState = ExpandedState;
type GroupChannelState = ExpandedState;
type WaypointState = ExpandedState;

type ID = { ID: string; };
type UUID = { UUID: string; };
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
};
type GroupChannelProperties = {
  LowerRange: number;
  UpperRange: number;
};
type WaypointProperties = NameProperty & {
  Content: string;
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
  loader: Loader 
}
interface Initialize {
  (i: InitIn, n: number): FullState;
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
};
export type ConfigColor = ID & {
  Properties: {
    R: number,
    G: number,
    B: number,
    Space: string
  }
}
export type ExtractedChannels = {
  SourceChannels: ConfigSourceChannel[];
  GroupChannels: ConfigGroupChannel[];
  Colors: ConfigColor[];
  Groups: ConfigGroup[];
}
interface ExtractDistributions {
  (loader: Loader, n: number): Promise<
    Map<number, ConfigSourceDistribution>
  >
}
interface ExtractChannels {
  (
    loader: Loader, n: number, brightfield: boolean,
    extractedBrightfield?: ExtractedChannels
  ): Promise<ExtractedChannels>
}

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
const toTileLayer = (
  loader: Loader, n: number
): TileProps => {
  const planes = loader.data;
  const metadata = loader.metadata;
  const { Channels } = metadata.Pixels;
//  const { SamplesPerPixel } = Channels[0];
  const id = `Tiled-Image-${n}`;
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
    channels: Channels.length,
    minZoom: -(planes.length - 1),
    maxZoom: 0
  };
  return props;
}

const initialize: Initialize = (loader, n) => {
  const tileProps = toTileLayer(loader, n);
  const mz = Math.abs(tileProps.minZoom || 0);
  const channels = [
    ...new Array(tileProps.channels).keys()
  ];
  const indices = channels.map(c => ({
    c, z: -mz, x: 0, y: 0
  }))
  return { indices, tileProps };
}

const extractDistributions: ExtractDistributions = async (
  loader, n: number
) => {
  const init = initialize(loader, n);
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

const extractChannels: ExtractChannels = async (
  loader, n, brightfield
) => {
  const init = initialize(loader, n);
  const { Channels, Type } = loader.metadata.Pixels;
  const use_first = brightfield ? [] : [];
  const name_change = name => (
    brightfield ? "H&E" : name.split('_')[1]
  );
  const SourceChannels = Channels.map(
    (channel, index) => ({
      UUID: crypto.randomUUID(),
      Properties: {
        Name: name_change(channel.Name),
        SourceIndex: init.indices[index].c,
      },
      Associations: {
        SourceDataType: asID(Type),
        SourceImage: asID(
          brightfield ? "brightfield" : "main"
        )
      }
    })
  );
  const group_size = 4;
  const ReorderedSourceChannels = [
    ...use_first, ...[
      ...Array(SourceChannels.length).keys()
    ].filter(
      i => !use_first.includes(i)
    )
  ].map(
    i => SourceChannels[i]
  )
  const Groups = [...Array(Math.ceil(
      SourceChannels.length / group_size
  )).keys()].map(
    index => ({
      UUID: crypto.randomUUID(),
      State: { Expanded: false },
      Properties: {
        Name: `Group ${index+1}`
      }
    })
  )
//  const color_cycle = list_colors("sRGB");
  const color_cycle = [
    {
      "ID": "sRGB#007fff",
      "Properties": {
          "R": 0,
          "G": 127,
          "B": 255,
          "Space": "sRGB",
          "LowerRange": 0,
          "UpperRange": 255
      }
    },
    {
      "ID": "sRGB#00ff00",
      "Properties": {
          "R": 0,
          "G": 255,
          "B": 0,
          "Space": "sRGB",
          "LowerRange": 0,
          "UpperRange": 255
      }
    },
    {
      "ID": "sRGB#ffff00",
      "Properties": {
          "R": 255,
          "G": 255,
          "B": 0,
          "Space": "sRGB",
          "LowerRange": 0,
          "UpperRange": 255
      }
    },
    {
    "ID": "sRGB#ff0000",
      "Properties": {
          "R": 255,
          "G": 0,
          "B": 0,
          "Space": "sRGB",
          "LowerRange": 0,
          "UpperRange": 255
      }
    }
  ]
  const Colors = [
    {
      "ID": "sRGB#ffffff",
      "Properties": {
          "R": 255,
          "G": 255,
          "B": 255,
          "Space": "sRGB",
          "LowerRange": 0,
          "UpperRange": 255
      }
    }
  ].concat(color_cycle);
  const GroupChannels = ReorderedSourceChannels.map(
    (channel, index) => {
      const group_index = Math.floor(index / group_size);
      const color_index = (index % group_size) % color_cycle.length;
      const group_uuid = Groups[group_index].UUID;
      return {
        UUID: crypto.randomUUID(),
        State: { Expanded: true },
        Properties: {
          LowerRange: brightfield? 0 : 0, //TODO
          UpperRange: brightfield? 255 : 5000  //TODO
        },
        Associations: {
          SourceChannel: onlyUUID(channel),
          Color: asID(
            brightfield ? 'sRGB#ffffff': color_cycle[color_index].ID
          ),
          Group: asUUID(group_uuid)
        }
      }
    }
  );

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

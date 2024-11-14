import { useRef, useEffect } from "react";
import { getImageSize } from "@hms-dbmi/viv";

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
type SourceChannelProperties = NameProperty & {
  SourceIndex: number;
};
type GroupChannelProperties = {
  Color: string;
  LowerRange: number;
  UpperRange: number;
};
type WaypointProperties = NameProperty & {
  Content: string;
};

type SourceChannelAssociations = Record<
  'SourceDataType', ID 
> & Record<
  'SourceImage', UUID
>;
type GroupChannelAssociations = Record<
  'SourceChannel' | 'Group',
  UUID
>;

export type MutableFields = (keyof ItemRegistryProps)[]
export type ItemRegistryProps = {
  Name: string;
  Groups: ConfigGroup[];
  Stories: ConfigWaypoint[];
  GroupChannels: ConfigGroupChannel[];
  SourceChannels: ConfigSourceChannel[];
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
interface ExtractChannels {
  (loader: Loader): Promise<{
    SourceChannels: ConfigSourceChannel[];
    GroupChannels: ConfigGroupChannel[];
    Groups: ConfigGroup[];
  }>
}

const asID = (k: string): ID => ({ ID: k });
const asUUID = (k: string): UUID => ({ UUID: k });

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
  const create = { create: true };
  const { bits, index, planes } = inputs;
  const { data } = await captureTile(index, planes);
  const powers = [...new Array(bits).keys()].map(x => 2**x);
  let indices = [...new Array(data.length).keys()];
  // Number of pixels greater than or equal to each power
  const highest = powers.reverse().map((power) => {
    const next_indices = [];
    indices.forEach(i => {
      if (0 === (data[i] & power)) {
        next_indices.push(i);
      }
    })
    const pixel_count = indices.length - next_indices.length;
    indices = next_indices;
    return pixel_count;
  }).reverse();
  // Count zero-valued pixels
  return [
    indices.length, ...highest
  ];
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

const extractChannels: ExtractChannels = async (loader) => {
  const init = initialize({ planes: loader.data });
  const bits = parseInt(
    init.tileProps.dtype.replace(/.?int/, '')
  )
  const distributions = await Promise.all(
    init.indices.map(index => {
      if (isNaN(bits)) {
        return [];
      }
      return bin({ 
        bits, index, planes: loader.data
      });
    })
  );
  const { Channels, Type } = loader.metadata.Pixels;
  const SourceChannels = Channels.map(
    (channel, index) => ({
      UUID: crypto.randomUUID(),
      Properties: {
        Name: channel.Name,
        SourceIndex: init.indices[index].c,
        Distribution: distributions[index]
      },
      Associations: {
        SourceDataType: asID(Type),
        SourceImage: asUUID('TODO')
      }
    })
  );
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
  const colors = [
    '0000FF', 'FF0000', 'FFFF00', 'FFFFFF',
    '00FF00', '00FFFF'
  ];
  const GroupChannels = SourceChannels.map(
    (channel, index) => {
      const group_index = Math.floor(index / group_size);
      const color_index = (index % group_size) % colors.length;
      const group_uuid = Groups[group_index].UUID;
      return {
        UUID: crypto.randomUUID(),
        State: { Expanded: true },
        Properties: {
          LowerRange: 0, UpperRange: 65535,
          Color: colors[color_index]
        },
        Associations: {
          SourceChannel: asUUID(channel.UUID),
          Group: asUUID(group_uuid)
        }
      }
    }
  )
  return {
    SourceChannels,
    GroupChannels,
    Groups
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

export { extractChannels, mutableItemRegistry }

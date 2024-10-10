import { useRef, useEffect } from "react";

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
  (loader: Loader): {
    SourceChannels: ConfigSourceChannel[];
    GroupChannels: ConfigGroupChannel[];
    Groups: ConfigGroup[];
  }
}

const asID = (k: string): ID => ({ ID: k });
const asUUID = (k: string): UUID => ({ UUID: k });

const extractChannels: ExtractChannels = (loader) => {
  const { Channels, Type } = loader.metadata.Pixels;
  const SourceChannels = Channels.map(
    (channel, index) => ({
      UUID: crypto.randomUUID(),
      Properties: {
        Name: channel.Name,
        SourceIndex: index,
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
  const GroupChannels = SourceChannels.map(
    (channel, index) => ({
      UUID: crypto.randomUUID(),
      State: { Expanded: false },
      Properties: {
        LowerRange: 0, UpperRange: 65535 
      },
      Associations: {
        SourceChannel: asUUID(channel.UUID),
        Group: asUUID(Groups[
          Math.floor(index / group_size)
        ].UUID)
      }
    })
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

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
  item, namespace, array, index
) => {
  return [
    namespace, new Proxy(
      item[namespace], {
        has(target, k) {
          if (k == '$on')
            return true;
          return k in target;
        },
        get(target, k) {
          if (k == '$on')
            return () => {};
          return target[k];
        },
        set(target, k, v) {
          if (k in target) {
            target[k] = v;
            array.splice(index, 1, item);
          }
          return true;
        }
      }
    )
  ];
}

const mutableConfigArray = (
  state_array, set_state, 
) => {
  const methods = [
    'pop', 'push', 'shift', 'unshift',
    'splice', 'sort', 'reverse'
  ];
  const namespaces = [
    /*'State', */'Properties', 'Associations'
  ];
  return new Proxy(state_array, {
    get(_, key, receiver) {
      const item = state_array[key];
      if (methods.includes(String(key))) {
        // Let specific array methods set the array state
        return new Proxy(item, {
          apply(fn, _, ...args) {
            const new_state = [...state_array];
            const output = fn.apply(new_state, args);
            set_state(new_state);
            return output;
          }
        });
      }
      if (typeof key == 'symbol') {
        return item;
      }
      const index = parseInt(key as string);
      if (isNaN(index) || typeof item != 'object') {
        return item;
      }
      // Let specific properties be modified
      const entries = namespaces.map(
        namespace => mutableConfigArrayItem(
          item, namespace, receiver, index
        )
      );
      return {
        ...item, ...Object.fromEntries(entries)
      }
    }
  });
}

export { extractChannels, mutableConfigArray }

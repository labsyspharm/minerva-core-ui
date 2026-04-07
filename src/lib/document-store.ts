import type { StoryShape } from "./storyShapes";

type ExpandedState = {
  Expanded: boolean;
};
type GroupState = ExpandedState;
type GroupChannelState = ExpandedState;

type ID = { ID: string };
type UUID = { UUID: string };
type NameProperty = { Name: string };
type Color = Record<"R" | "G" | "B", number>;
type GroupChannel = UUID & {
  LowerRange: number;
  UpperRange: number;
  Color: Color;
  SourceChannel: UUID;
  Group: UUID;
  State: GroupChannelState;
};
export type ConfigGroup = (UUID & NameProperty) & {
  GroupChannels: GroupChannel[];
  State: GroupState;
};

export type ConfigSourceChannel = (UUID & NameProperty) & {
  SourceIndex: number;
  Samples: number;
  SourceImage: UUID;
  SourceDataType: ID;
  SourceDistribution?: UUID;
};

type SetGroupChannelRangeInput = {
  LowerRange: number;
  UpperRange: number;
  group_uuid: string;
  channel_uuid: string;
};

export interface DocumentStore {
  Groups: ConfigGroup[];
  setGroups: (groups: ConfigGroup[]) => void;
  SourceChannels: ConfigSourceChannel[];
  setSourceChannels: (source_channels: ConfigSourceChannel[]) => void;
  setGroupChannelRange: (SetGroupChannelRangeInput) => void;
  Shapes: StoryShape[];
  setShapes: (shapes: StoryShape[]) => void;
}

const documentInitialState = {
  Groups: [],
  SourceChannels: [],
  Shapes: [] as StoryShape[],
};

// Create the document store
export const documentStore = (set, _get) => ({
  ...documentInitialState,
  // Group and Channel actions
  setGroups: (Groups: ConfigGroup[]) => {
    set({ Groups });
  },
  setGroupChannelRange: ({
    LowerRange,
    UpperRange,
    group_uuid,
    channel_uuid,
  }) => {
    set((state) => {
      const Groups = state.Groups.map((group) => {
        if (group.UUID !== group_uuid) {
          return group;
        }
        group.GroupChannels = group.GroupChannels.map((channel) => {
          if (channel.UUID !== channel_uuid) {
            return channel;
          }
          channel.LowerRange = LowerRange;
          channel.UpperRange = UpperRange;
          return channel;
        });
        return group;
      });
      return { Groups };
    });
  },
  setSourceChannels: (SourceChannels: ConfigSourceChannel[]) => {
    set({ SourceChannels });
  },
  setShapes: (Shapes: StoryShape[]) => {
    set({ Shapes });
  },
});

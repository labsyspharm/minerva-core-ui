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

export interface DocumentStore {
  Groups: ConfigGroup[];
  setGroups: (groups: ConfigGroup[]) => void;
  SourceChannels: ConfigSourceChannel[];
  setSourceChannels: (source_channels: ConfigSourceChannel[]) => void;
}

const documentInitialState = {
  Groups: [],
  SourceChannels: [],
};

// Create the document store
export const documentStore = (set, _get) => ({
  ...documentInitialState,
  // Group and Channel actions
  setGroups: (Groups: ConfigGroup[]) => {
    set({ Groups });
  },
  setSourceChannels: (SourceChannels: ConfigSourceChannel[]) => {
    set({ SourceChannels });
  },
});

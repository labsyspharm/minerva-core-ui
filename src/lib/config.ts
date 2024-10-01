type ExpandedState = {
  Expanded: boolean;
};
type GroupState = ExpandedState;
type GroupChannelState = ExpandedState;
type WaypointState = ExpandedState;

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

type Associations<T extends string> = Record<T, UUID>;
type SourceChannelAssociations = Associations<
  'SourceDataType' | 'SourceImage'
>;
type GroupChannelAssociations = Associations<
  'SourceChannel' | 'Group'
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

import styled from "styled-components";
import {
  PopUpdate as PopUpdateChannel,
  Push as PushChannel,
} from "@/components/authoring/tools/ActionButtons";
import { EditableText } from "@/components/authoring/tools/EditableText";
import { EditModeSwitcher } from "@/components/authoring/tools/EditModeSwitcher";

/** Matches nested list styling in `ChannelGroups` so the overlay reads as one column. */
const ChannelsSection = styled.div`
  margin-top: 4px;
  border-radius: 5px;
  background: color-mix(in srgb, black 28%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-glass-edge) 40%, transparent);
  overflow: hidden;
`;

const ChannelsSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 6px;
  border-bottom: 1px solid
    color-mix(in srgb, var(--theme-glass-edge) 35%, transparent);
`;

const SectionLabel = styled.div`
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 10px;
  color: color-mix(in srgb, var(--theme-light-contrast-color) 52%, transparent);
  line-height: 1.2;
  margin: 0;
  flex: 1;
  min-width: 0;
`;

const ToolbarSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  line-height: 0;
`;

const ChannelList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 2px;
  gap: 0;
`;

const LegendRowWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 22px;
  padding: 3px 5px;
  border-radius: 3px;
  box-sizing: border-box;

  &:hover {
    background: color-mix(in srgb, white 7%, transparent);
  }
`;

const RowClickArea = styled.div<{ color: string }>`
  color: ${({ color }) => color};
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  cursor: pointer;

  &:hover .channel-legend-name {
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-color: color-mix(
      in srgb,
      currentColor 35%,
      transparent
    );
  }
`;

const Swatch = styled.div`
  background-color: #${({ color }) => color};
  outline: ${({ outline }) => outline};
  height: 11px;
  width: 11px;
  flex-shrink: 0;
  border-radius: 3px;
  box-shadow:
    0 0 0 1px color-mix(in srgb, white 14%, transparent) inset,
    0 0 0 1px color-mix(in srgb, black 35%, transparent);
`;

const NameSlot = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.25;

  &.channel-legend-name {
    display: block;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const defaultChannels = [
  { color: "0000FF", name: "DNA" },
  { color: "FF0000", name: "Red" },
  { color: "00FF00", name: "Green" },
  { color: "FFFFFF", name: "White" },
];

const LegendRow = (props) => {
  const { channel, channelVisibilities } = props;
  const channelName = channel.name;
  const visible = channelVisibilities[channelName];
  const { idx, g, onClick } = props;
  const setInput = (t) => {
    props.updateChannel({ ...channel, name: t }, { idx, g });
  };
  const onPop = () => {
    props.popChannel({ g, idx });
  };

  const uuid = `group/channel/name/${idx}`;
  const statusProps = {
    ...props,
    md: false,
    setInput,
    updateCache: () => null,
    cache: new Map(),
    uuid,
  };

  const wrapProps = {
    color: "rgb(230, 237, 243)",
    onClick,
  };
  const boxProps = {
    ...props.channel,
    outline: "none",
  };
  if (!visible) {
    boxProps.color = "0d1117";
    wrapProps.color = "rgb(139, 148, 158)";
    boxProps.outline = "1px solid color-mix(in srgb, white 28%, transparent)";
  }
  const coreUI = (
    <RowClickArea {...wrapProps} className="channel-legend-row">
      <Swatch {...boxProps} />
      <NameSlot className="channel-legend-name">
        <EditableText {...statusProps}>{channelName}</EditableText>
      </NameSlot>
    </RowClickArea>
  );
  const editSwitch = [
    ["div", { children: coreUI }],
    [PopUpdateChannel, { children: coreUI, onPop }],
  ];
  const canPop = props.editable && props.total > 1;
  const extraUI = (
    <EditModeSwitcher {...{ ...props, editable: canPop, editSwitch }} />
  );

  return <LegendRowWrap>{extraUI}</LegendRowWrap>;
};

export const ChannelLegend = (props) => {
  const { g, pushChannel, toggleChannel } = props;
  const channels = props.channels || [];
  const total = channels.length;
  const nextIdx = total + 1;
  const newChannel = defaultChannels[nextIdx % defaultChannels.length];
  const onPush = () => {
    pushChannel(newChannel, { g });
  };
  const editSwitch = [
    ["div", {}],
    [PushChannel, { onPush }],
  ];
  const addChannelUI = <EditModeSwitcher {...{ ...props, editSwitch }} />;

  const rows = channels.map((c, k) => {
    const rowProps = {
      ...props,
      total,
      channel: c,
      idx: k,
      onClick: () => toggleChannel(c),
    };
    return <LegendRow key={c.channel_uuid ?? `${c.name}-${k}`} {...rowProps} />;
  });
  return (
    <ChannelsSection>
      <ChannelsSectionHeader>
        <SectionLabel>Channels</SectionLabel>
        <ToolbarSlot>{addChannelUI}</ToolbarSlot>
      </ChannelsSectionHeader>
      <ChannelList>{rows}</ChannelList>
    </ChannelsSection>
  );
};

import styled from "styled-components";
import { EditableText } from "@/components/authoring/tools/EditableText";
import { renameSourceChannelDisplayName } from "@/lib/channel/channelGroupMutations";

/** Matches nested list styling in `ChannelGroups` so the overlay reads as one column. */
const ChannelsSection = styled.div`
  margin-top: 4px;
  border-radius: 5px;
  background: color-mix(in srgb, black 28%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-glass-edge) 40%, transparent);
  overflow: hidden;
`;

const SectionLabel = styled.div`
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 10px;
  color: color-mix(in srgb, var(--theme-light-contrast-color) 52%, transparent);
  line-height: 1.2;
  margin: 0;
  padding: 4px 6px;
  border-bottom: 1px solid
    color-mix(in srgb, var(--theme-glass-edge) 35%, transparent);
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

type LegendChannelRow = {
  name: string;
  color: string;
  source_uuid: string;
};

type LegendRowProps = {
  channel: LegendChannelRow;
  channelVisibilities: Record<string, boolean>;
  onClick: () => void;
};

const LegendRow = (props: LegendRowProps) => {
  const { channel, channelVisibilities } = props;
  const channelName = channel.name;
  const visible = channelVisibilities[channelName];
  const setInput = (t: string) => {
    renameSourceChannelDisplayName(channel.source_uuid, t);
  };

  const uuid = `group/channel/name/${channel.source_uuid}`;
  const statusProps = {
    md: false,
    setInput,
    updateCache: () => null,
    cache: new Map(),
    uuid,
  };

  const wrapProps = {
    color: "rgb(230, 237, 243)",
    onClick: props.onClick,
  };
  const boxProps = {
    color: props.channel.color,
    outline: "none" as string | undefined,
  };
  if (!visible) {
    boxProps.color = "0d1117";
    wrapProps.color = "rgb(139, 148, 158)";
    boxProps.outline = "1px solid color-mix(in srgb, white 28%, transparent)";
  }

  return (
    <LegendRowWrap>
      <RowClickArea {...wrapProps} className="channel-legend-row">
        <Swatch {...boxProps} />
        <NameSlot className="channel-legend-name">
          <EditableText {...statusProps}>{channelName}</EditableText>
        </NameSlot>
      </RowClickArea>
    </LegendRowWrap>
  );
};

export type ChannelLegendProps = {
  channels: LegendChannelRow[];
  channelVisibilities: Record<string, boolean>;
  toggleChannel: (channel: { name: string }) => void;
};

/** Compact overlay: visibility toggle + rename. Group membership editing lives in the sidebar. */
export const ChannelLegend = (props: ChannelLegendProps) => {
  const rows = props.channels.map((c) => (
    <LegendRow
      key={c.source_uuid}
      channel={c}
      channelVisibilities={props.channelVisibilities}
      onClick={() => props.toggleChannel(c)}
    />
  ));
  return (
    <ChannelsSection>
      <SectionLabel>Channels</SectionLabel>
      <ChannelList>{rows}</ChannelList>
    </ChannelsSection>
  );
};

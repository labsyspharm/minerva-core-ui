import styled from "styled-components";
import {
  PopUpdate as PopUpdateChannel,
  Push as PushChannel,
} from "@/components/authoring/tools/ActionButtons";
import { EditableText } from "@/components/authoring/tools/EditableText";
import { EditModeSwitcher } from "@/components/authoring/tools/EditModeSwitcher";
import {
  isGroupRowVisible,
  isStackVisible,
} from "@/lib/imaging/channelCompositor";
import {
  effectiveSourceColor,
  effectiveSourceLimits,
} from "@/lib/imaging/sourceChannelStyle";
import type { Channel, ChannelGroupChannel } from "@/lib/stores/documentStore";
import { basenameImportLabel } from "@/lib/stores/storeUtils";

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
  padding: 3px 6px;
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

const LegendBody = styled.div`
  display: flex;
  flex-direction: column;
  padding: 2px 3px 3px;
  gap: 0;
`;

const ImageSection = styled.div`
  &:not(:first-child) {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid
      color-mix(in srgb, var(--theme-glass-edge) 28%, transparent);
  }
`;

const ImageSectionLabel = styled.div`
  padding: 1px 4px 2px;
  font-size: 9px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--theme-light-contrast-color) 42%, transparent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ChannelList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const LegendRowWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  width: 100%;
  min-height: 18px;
  padding: 1px 3px;
  border-radius: 2px;
  box-sizing: border-box;

  &:hover {
    background: color-mix(in srgb, white 7%, transparent);
  }
`;

const RowClickArea = styled.div`
  color: rgb(230, 237, 243);
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
`;

const Swatch = styled.div<{ color: string; $filled: boolean }>`
  height: 10px;
  width: 10px;
  flex-shrink: 0;
  border-radius: 2px;
  box-sizing: border-box;
  border: 1.5px solid #${(p) => p.color};
  background-color: ${(p) => (p.$filled ? `#${p.color}` : "transparent")};
  box-shadow: 0 0 0 1px color-mix(in srgb, black 25%, transparent);
`;

const LegendDivider = styled.div`
  margin: 3px 2px 2px;
  border-top: 1px solid
    color-mix(in srgb, var(--theme-glass-edge) 50%, transparent);
`;

const NameSlot = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  font-size: 11px;
  line-height: 1.2;
`;

export const defaultChannels = [
  { color: "0000FF", name: "DNA" },
  { color: "FF0000", name: "Red" },
  { color: "00FF00", name: "Green" },
  { color: "FFFFFF", name: "White" },
];

export type LegendChannel = {
  r: number;
  g: number;
  b: number;
  lower_range: number;
  upper_range: number;
  name: string;
  color: string;
  group_uuid: string;
  source_uuid: string;
  channel_uuid: string;
};

export type LegendEntry =
  | { type: "channel"; channel: LegendChannel }
  | { type: "divider" };

export type LegendSection = {
  imageId: string;
  label: string;
  entries: LegendEntry[];
};

/** Legend swatch matching what the viewer draws (group row or stack source). */
export function legendChannelFromLayer(
  sc: Channel,
  gc: ChannelGroupChannel | null,
  activeGroupId: string | null,
  colorIndex: number,
): LegendChannel {
  if (gc) {
    const { r, g, b } = gc.color;
    const hex_color = [r, g, b]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    return {
      r,
      g,
      b,
      lower_range: gc.lowerLimit,
      upper_range: gc.upperLimit,
      name: sc.name,
      color: hex_color,
      group_uuid: activeGroupId ?? "",
      source_uuid: sc.id,
      channel_uuid: gc.id,
    };
  }
  return legendChannelFromSource(sc, colorIndex);
}

export function legendChannelFromSource(
  sc: Channel,
  colorIndex: number,
): LegendChannel {
  const { r, g, b } = effectiveSourceColor(sc, colorIndex);
  const hex_color = [r, g, b]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  const [lo, hi] = effectiveSourceLimits(sc);
  return {
    r,
    g,
    b,
    lower_range: lo,
    upper_range: hi,
    name: sc.name,
    color: hex_color,
    group_uuid: "",
    source_uuid: sc.id,
    channel_uuid: sc.id,
  };
}

export function legendLabelForImage(basename: string): string {
  const trimmed = basename.trim();
  if (!trimmed) return "Image";
  return basenameImportLabel(trimmed) || trimmed;
}

function legendRowVisible(
  channel: LegendChannel,
  channelVisibilities: Record<string, boolean>,
  channelGroupRowVisibilities: Record<string, boolean>,
): boolean {
  if (channel.group_uuid && channel.channel_uuid) {
    return isGroupRowVisible(channelGroupRowVisibilities, channel.channel_uuid);
  }
  return isStackVisible(channelVisibilities, channel.source_uuid);
}

type LegendRowProps = {
  channel: LegendChannel;
  idx: number;
  g: number;
  total: number;
  editable?: boolean;
  channelVisibilities: Record<string, boolean>;
  channelGroupRowVisibilities: Record<string, boolean>;
  /** Group member hidden in the viewer — stroked swatch, still listed. */
  hiddenInViewer?: boolean;
  toggleChannel: (c: LegendChannel) => void;
  updateChannel: (
    channel: LegendChannel,
    ctx: { idx: number; g: number },
  ) => void;
  popChannel: (ctx: { g: number; idx: number }) => void;
};

const LegendRow = (props: LegendRowProps & { onClick: () => void }) => {
  const { channel } = props;
  const channelName = channel.name;
  const { idx, g, onClick } = props;
  const rowVisible = props.hiddenInViewer
    ? false
    : legendRowVisible(
        channel,
        props.channelVisibilities,
        props.channelGroupRowVisibilities,
      );
  const setInput = (t: string) => {
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

  const coreUI = (
    <RowClickArea
      onClick={onClick}
      className="channel-legend-row"
      title={rowVisible ? `Hide ${channelName}` : `Show ${channelName}`}
      style={{ opacity: rowVisible ? 1 : 0.55 }}
    >
      <Swatch color={channel.color} $filled={rowVisible} />
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

type ChannelLegendProps = {
  sections: LegendSection[];
  channelVisibilities: Record<string, boolean>;
  channelGroupRowVisibilities?: Record<string, boolean>;
  toggleChannel: (c: LegendChannel) => void;
  editable?: boolean;
  g?: number;
  pushChannel?: (
    channel: { color: string; name: string },
    ctx: { g: number },
  ) => void;
  updateChannel?: LegendRowProps["updateChannel"];
  popChannel?: LegendRowProps["popChannel"];
};

export const ChannelLegend = (props: ChannelLegendProps) => {
  const g = props.g ?? 0;
  const pushChannel = props.pushChannel;
  const { sections } = props;
  const channelGroupRowVisibilities = props.channelGroupRowVisibilities ?? {};
  const total = sections.reduce(
    (n, s) => n + s.entries.filter((e) => e.type === "channel").length,
    0,
  );
  const nextIdx = total + 1;
  const newChannel = defaultChannels[nextIdx % defaultChannels.length];
  const onPush = () => {
    pushChannel?.(newChannel, { g });
  };
  const editSwitch = [
    ["div", {}],
    [PushChannel, { onPush }],
  ];
  const addChannelUI = pushChannel ? (
    <EditModeSwitcher {...{ ...props, editSwitch }} />
  ) : null;

  if (sections.length === 0) {
    return (
      <ChannelsSection>
        <ChannelsSectionHeader>
          <SectionLabel>Channels</SectionLabel>
          <ToolbarSlot>{addChannelUI}</ToolbarSlot>
        </ChannelsSectionHeader>
      </ChannelsSection>
    );
  }

  let rowIdx = 0;
  return (
    <ChannelsSection>
      <ChannelsSectionHeader>
        <SectionLabel>Channels</SectionLabel>
        <ToolbarSlot>{addChannelUI}</ToolbarSlot>
      </ChannelsSectionHeader>
      <LegendBody>
        {sections.map((section) => (
          <ImageSection key={section.imageId}>
            <ImageSectionLabel title={section.label}>
              {section.label}
            </ImageSectionLabel>
            <ChannelList>
              {section.entries.map((entry, entryIdx) => {
                if (entry.type === "divider") {
                  return (
                    <LegendDivider key={`div-${section.imageId}-${entryIdx}`} />
                  );
                }
                const c = entry.channel;
                const k = rowIdx;
                rowIdx += 1;
                const hiddenInViewer =
                  !!c.group_uuid &&
                  !isGroupRowVisible(
                    channelGroupRowVisibilities,
                    c.channel_uuid,
                  );
                const rowProps: LegendRowProps & { onClick: () => void } = {
                  channel: c,
                  idx: k,
                  g,
                  total,
                  editable: props.editable,
                  channelVisibilities: props.channelVisibilities,
                  channelGroupRowVisibilities,
                  hiddenInViewer,
                  toggleChannel: props.toggleChannel,
                  updateChannel: props.updateChannel ?? (() => {}),
                  popChannel: props.popChannel ?? (() => {}),
                  onClick: () => props.toggleChannel(c),
                };
                return (
                  <LegendRow
                    key={c.channel_uuid ?? `${c.name}-${k}`}
                    {...rowProps}
                  />
                );
              })}
            </ChannelList>
          </ImageSection>
        ))}
      </LegendBody>
    </ChannelsSection>
  );
};

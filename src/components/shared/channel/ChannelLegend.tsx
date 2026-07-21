import type { CSSProperties } from "react";
import {
  PopUpdate as PopUpdateChannel,
  Push as PushChannel,
} from "@/components/shared/tools/ActionButtons";
import { EditableText } from "@/components/shared/tools/EditableText";
import { EditModeSwitcher } from "@/components/shared/tools/EditModeSwitcher";
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
import styles from "./ChannelLegend.module.css";

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
    // Must be explicit: EditableText defaults `editable` to true (bordered
    // textarea). Playback / CDN pass undefined and must stay read-only.
    editable: props.editable === true,
    md: false,
    setInput,
    updateCache: () => null,
    cache: new Map(),
    uuid,
  };

  const coreUI = (
    <button
      type="button"
      onClick={onClick}
      className={styles.rowClickArea}
      title={rowVisible ? `Hide ${channelName}` : `Show ${channelName}`}
      style={{ opacity: rowVisible ? 1 : 0.55 }}
    >
      <div
        className={[styles.swatch, rowVisible ? styles.swatchFilled : null]
          .filter(Boolean)
          .join(" ")}
        style={{ "--swatch-color": `#${channel.color}` } as CSSProperties}
      />
      <span className={styles.nameSlot}>
        <EditableText {...statusProps}>{channelName}</EditableText>
      </span>
    </button>
  );
  const editSwitch = [
    ["div", { children: coreUI }],
    [PopUpdateChannel, { children: coreUI, onPop }],
  ];
  const canPop = props.editable && props.total > 1;
  const extraUI = (
    <EditModeSwitcher {...{ ...props, editable: canPop, editSwitch }} />
  );

  return <div className={styles.legendRowWrap}>{extraUI}</div>;
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
      <div className={styles.channelsSection}>
        <div className={styles.channelsSectionHeader}>
          <div className={styles.sectionLabel}>Channels</div>
          <div className={styles.toolbarSlot}>{addChannelUI}</div>
        </div>
      </div>
    );
  }

  let rowIdx = 0;
  return (
    <div className={styles.channelsSection}>
      <div className={styles.channelsSectionHeader}>
        <div className={styles.sectionLabel}>Channels</div>
        <div className={styles.toolbarSlot}>{addChannelUI}</div>
      </div>
      <div className={styles.legendBody}>
        {sections.map((section) => (
          <div className={styles.imageSection} key={section.imageId}>
            <div className={styles.imageSectionLabel} title={section.label}>
              {section.label}
            </div>
            <div className={styles.channelList}>
              {section.entries.map((entry, entryIdx) => {
                if (entry.type === "divider") {
                  return (
                    <div
                      className={styles.legendDivider}
                      key={`div-${section.imageId}-${entryIdx}`}
                    />
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

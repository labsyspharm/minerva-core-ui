import { rgbaToHsva } from "@uiw/react-color";
import type { CSSProperties } from "react";
import * as React from "react";
import {
  ColorPickerPopover,
  colorPickerAnchorPosition,
} from "@/components/shared/ColorPickerPopover";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
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
  getStackPalettePendingIds,
  subscribeStackPalettePending,
} from "@/lib/imaging/psudoPalette";
import {
  assignedDisplayHex,
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

export function legendChannelFromLayer(
  sc: Channel,
  gc: ChannelGroupChannel | null,
  activeGroupId: string | null,
  allChannels?: readonly Channel[],
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
  return legendChannelFromSource(sc, allChannels);
}

export function legendChannelFromSource(
  sc: Channel,
  allChannels: readonly Channel[] = [],
): LegendChannel {
  const hex = assignedDisplayHex(sc, allChannels, null);
  const [lo, hi] = effectiveSourceLimits(sc);
  return {
    r: sc.color?.r ?? 255,
    g: sc.color?.g ?? 255,
    b: sc.color?.b ?? 255,
    lower_range: lo,
    upper_range: hi,
    name: sc.name,
    color: hex ?? "",
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
  colorPending?: boolean;
  channelVisibilities: Record<string, boolean>;
  channelGroupRowVisibilities: Record<string, boolean>;
  hiddenInViewer?: boolean;
  toggleChannel: (c: LegendChannel) => void;
  updateChannel: (
    gid: string,
    cid: string,
    c: Partial<ChannelGroupChannel>,
  ) => void;
  onColorClick: (e: React.MouseEvent) => void;
  popChannel: (ctx: { g: number; idx: number }) => void;
};

const LegendRow = (props: LegendRowProps) => {
  const { channel } = props;
  const channelName = channel.name;
  const { idx, g, onColorClick } = props;
  const colorPending = !!props.colorPending;
  const rowVisible = props.hiddenInViewer
    ? false
    : legendRowVisible(
        channel,
        props.channelVisibilities,
        props.channelGroupRowVisibilities,
      );
  const onPop = () => {
    props.popChannel({ g, idx });
  };

  const uuid = `group/channel/name/${idx}`;
  const statusProps = {
    ...props,
    editable: props.editable === true,
    md: false,
    setInput: () => null,
    updateCache: () => null,
    cache: new Map(),
    uuid,
  };

  const swatchLabel = colorPending
    ? `Optimizing color of ${channelName}`
    : `Change color of ${channelName}`;
  const coreUI = (
    <div
      className={styles.rowClickArea}
      style={{ opacity: rowVisible ? 1 : 0.55 }}
    >
      <button
        type="button"
        className={[
          styles.swatchButton,
          colorPending ? minervaTheme.busyOverlay : null,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onColorClick}
        title={swatchLabel}
        aria-label={swatchLabel}
        aria-busy={colorPending || undefined}
      >
        <div
          className={[
            styles.swatch,
            channel.color && rowVisible ? styles.swatchFilled : null,
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            {
              "--swatch-color": channel.color ? `#${channel.color}` : "#fff",
            } as CSSProperties
          }
        />
      </button>
      <button
        type="button"
        className={styles.nameButton}
        onClick={() => props.toggleChannel(channel)}
        title={rowVisible ? `Hide ${channelName}` : `Show ${channelName}`}
        aria-label={rowVisible ? `Hide ${channelName}` : `Show ${channelName}`}
      >
        <span className={styles.nameSlot}>
          <EditableText {...statusProps}>{channelName}</EditableText>
        </span>
      </button>
    </div>
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
  const palettePendingIds = React.useSyncExternalStore(
    subscribeStackPalettePending,
    getStackPalettePendingIds,
    getStackPalettePendingIds,
  );
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
  const [colorPickerPos, setColorPickerPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [pickerHsva, setPickerHsva] = React.useState(() =>
    rgbaToHsva({ r: 255, g: 255, b: 255, a: 1 }),
  );
  const [colorPickerChannel, setColorPickerChannel] =
    React.useState<LegendChannel | null>(null);

  const closeColorPicker = React.useCallback(() => {
    setColorPickerChannel(null);
    setColorPickerPos(null);
  }, []);

  const handleColorPickerOpen = (anchor: DOMRect, c: LegendChannel) => {
    setColorPickerChannel(c);
    setPickerHsva(
      rgbaToHsva({
        r: c.r,
        g: c.g,
        b: c.b,
        a: 1,
      }),
    );
    setColorPickerPos(colorPickerAnchorPosition(anchor));
  };

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
                const rowProps: LegendRowProps = {
                  channel: c,
                  idx: k,
                  g,
                  total,
                  editable: props.editable,
                  colorPending: palettePendingIds.includes(c.source_uuid),
                  channelVisibilities: props.channelVisibilities,
                  channelGroupRowVisibilities,
                  hiddenInViewer,
                  toggleChannel: props.toggleChannel,
                  updateChannel: props.updateChannel ?? (() => {}),
                  popChannel: props.popChannel ?? (() => {}),
                  onColorClick: (e) => {
                    const anchor = e.currentTarget.getBoundingClientRect();
                    handleColorPickerOpen(anchor, c);
                  },
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
      <ColorPickerPopover
        position={colorPickerPos}
        onClose={closeColorPicker}
        color={pickerHsva}
        showAlpha
        onChange={(c) => {
          setPickerHsva(c.hsva);
          const { r, g, b } = c.rgba;
          const color = { r, g, b };
          if (colorPickerChannel !== null) {
            const channel = colorPickerChannel;
            const groupId = channel.group_uuid;
            const channelId = channel.source_uuid;
            props.updateChannel?.(groupId, channelId, { color });
          }
        }}
      />
    </div>
  );
};

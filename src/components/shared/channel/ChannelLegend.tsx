import { rgbaToHsva } from "@uiw/react-color";
import type { CSSProperties } from "react";
import * as React from "react";
import {
  ChromeColorPickerPopover,
  chromeColorPickerAnchorPosition,
} from "@/components/shared/ChromeColorPickerPopover";
import {
  isGroupRowVisible,
  isStackVisible,
} from "@/lib/imaging/channelCompositor";
import { effectiveSourceColor } from "@/lib/imaging/sourceChannelStyle";
import type { Channel, ChannelGroupChannel } from "@/lib/stores/documentStore";
import { basenameImportLabel } from "@/lib/stores/storeUtils";
import styles from "./ChannelLegend.module.css";

export type LegendChannel = {
  r: number;
  g: number;
  b: number;
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

function rgbHex(r: number, g: number, b: number): string {
  return [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/** Legend swatch matching what the viewer draws (group row or stack source). */
export function legendChannelFromLayer(
  sc: Channel,
  gc: ChannelGroupChannel | null,
  activeGroupId: string | null,
  colorIndex: number,
): LegendChannel {
  if (gc) {
    const { r, g, b } = gc.color;
    return {
      r,
      g,
      b,
      name: sc.name,
      color: rgbHex(r, g, b),
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
  return {
    r,
    g,
    b,
    name: sc.name,
    color: rgbHex(r, g, b),
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
  channelVisibilities: Record<string, boolean>;
  channelGroupRowVisibilities: Record<string, boolean>;
  /** Group member hidden in the viewer — stroked swatch, still listed. */
  hiddenInViewer?: boolean;
  onToggle: () => void;
  onSwatchClick: (anchor: DOMRect, c: LegendChannel) => void;
};

const LegendRow = (props: LegendRowProps) => {
  const { channel } = props;
  const channelName = channel.name;
  const rowVisible = props.hiddenInViewer
    ? false
    : legendRowVisible(
        channel,
        props.channelVisibilities,
        props.channelGroupRowVisibilities,
      );

  return (
    <div
      className={styles.legendRowWrap}
      style={{ opacity: rowVisible ? 1 : 0.55 }}
    >
      <button
        type="button"
        className={[styles.swatch, rowVisible ? styles.swatchFilled : null]
          .filter(Boolean)
          .join(" ")}
        style={{ "--swatch-color": `#${channel.color}` } as CSSProperties}
        title={`Color ${channelName}`}
        aria-label={`Color ${channelName}`}
        onClick={(e) => {
          props.onSwatchClick(e.currentTarget.getBoundingClientRect(), channel);
        }}
      />
      <button
        type="button"
        className={styles.nameClickArea}
        title={rowVisible ? `Hide ${channelName}` : `Show ${channelName}`}
        onClick={props.onToggle}
      >
        {channelName}
      </button>
    </div>
  );
};

type ChannelLegendProps = {
  sections: LegendSection[];
  channelVisibilities: Record<string, boolean>;
  channelGroupRowVisibilities?: Record<string, boolean>;
  toggleChannel: (c: LegendChannel) => void;
  onChannelColor?: (
    groupId: string,
    id: string,
    color: { r: number; g: number; b: number },
  ) => void;
};

export const ChannelLegend = (props: ChannelLegendProps) => {
  const { sections } = props;
  const channelGroupRowVisibilities = props.channelGroupRowVisibilities ?? {};
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

  const handleSwatchClick = (anchor: DOMRect, c: LegendChannel) => {
    setColorPickerChannel(c);
    setPickerHsva(
      rgbaToHsva({
        r: c.r,
        g: c.g,
        b: c.b,
        a: 1,
      }),
    );
    setColorPickerPos(chromeColorPickerAnchorPosition(anchor));
  };

  return (
    <div className={styles.channelsSection}>
      <div className={styles.channelsSectionHeader}>
        <div className={styles.sectionLabel}>Channels</div>
      </div>
      {sections.length > 0 ? (
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
                  const hiddenInViewer =
                    !!c.group_uuid &&
                    !isGroupRowVisible(
                      channelGroupRowVisibilities,
                      c.channel_uuid,
                    );
                  return (
                    <LegendRow
                      key={c.channel_uuid ?? `${c.name}-${entryIdx}`}
                      channel={c}
                      channelVisibilities={props.channelVisibilities}
                      channelGroupRowVisibilities={channelGroupRowVisibilities}
                      hiddenInViewer={hiddenInViewer}
                      onToggle={() => props.toggleChannel(c)}
                      onSwatchClick={handleSwatchClick}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <ChromeColorPickerPopover
        position={colorPickerPos}
        onClose={closeColorPicker}
        color={pickerHsva}
        showAlpha={false}
        onChange={(c) => {
          setPickerHsva(c.hsva);
          const { r, g, b } = c.rgba;
          const color = {
            r: Math.round(r),
            g: Math.round(g),
            b: Math.round(b),
          };
          if (colorPickerChannel !== null) {
            const channel = colorPickerChannel;
            const groupId = channel.group_uuid;
            const id = groupId ? channel.channel_uuid : channel.source_uuid;
            props.onChannelColor?.(groupId, id, color);
          }
        }}
      />
    </div>
  );
};

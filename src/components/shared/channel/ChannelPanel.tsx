import type { ReactNode } from "react";
import * as React from "react";
import styled from "styled-components";
import {
  defaultVisibilitiesForSources,
  isStackVisible,
} from "@/lib/imaging/channelCompositor";
import {
  DEFAULT_VISIBLE_INTENSITY_CHANNELS,
  isImageChannel,
  isMaskChannel,
} from "@/lib/imaging/channelKind";
import { useAppStore } from "@/lib/stores/appStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { ChannelGroups } from "./ChannelGroups";
import {
  ChannelLegend,
  type LegendChannel,
  type LegendEntry,
  type LegendSection,
  legendChannelFromLayer,
  legendChannelFromSource,
  legendLabelForImage,
} from "./ChannelLegend";

export type ChannelPanelProps = {
  children: ReactNode;
  hiddenChannel: boolean;
  noLoader: boolean;
};

const TextWrap = styled.div`
  position: relative;
  height: 100%;
  min-height: 0;
  > div.core {
    color: #e6edf3;
    position: absolute;
    right: 0;
    top: 0;
    width: 200px;
    max-height: min(100%, calc(100dvh - 12px));
    margin-bottom: 2px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    transition: transform 0.5s ease 0s;
  }
  > div.core.hide {
    transform: translateX(100%);
  }
  .dim {
    color: #aaa;
  }
`;

const WrapContent = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  pointer-events: none;
`;

const WrapCore = styled.div`
  flex: 1;
  min-height: 0;
  padding: 6px 8px 7px;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: #888 var(--theme-dim-gray-color);
  scrollbar-width: thin;
  pointer-events: all;
  word-wrap: break-word;
  border: 1px solid color-mix(in srgb, var(--theme-glass-edge) 75%, transparent);
  background-color: color-mix(in srgb, var(--dark-glass) 92%, black);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: var(--radius-0001);
  /* Explicit metrics — do not inherit presentation prose line-height / font-size. */
  box-sizing: border-box;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.25;
`;

const OverlaySectionLabel = styled.div`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--theme-light-contrast-color) 52%, transparent);
  margin: 0 0 4px;
  line-height: 1.2;
`;

export const ChannelPanel = (props: ChannelPanelProps) => {
  const hide = props.hiddenChannel;
  const hidden = props.noLoader;
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const channelVisibilities = useAppStore((s) => s.channelVisibilities);
  const channelGroupRowVisibilities = useAppStore(
    (s) => s.channelGroupRowVisibilities,
  );
  const setChannelVisibilities = useAppStore((s) => s.setChannelVisibilities);
  const setChannelGroupRowVisibilities = useAppStore(
    (s) => s.setChannelGroupRowVisibilities,
  );
  const docChannelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const sourceChannels = React.useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );

  const channelGroups = docChannelGroups.map((group, g) => ({
    g,
    id: group.id,
    name: group.name,
    channels: group.channels
      .map((channel) => {
        const { color } = channel;
        const found = findSourceChannel(sourceChannels, channel.channelId);
        if (!found) return null;
        const { r, g: gg, b } = color;
        const hex_color = [r, gg, b]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
        return {
          r,
          g: gg,
          b,
          lower_range: channel.lowerLimit,
          upper_range: channel.upperLimit,
          name: found.name,
          color: hex_color,
          group_uuid: group.id,
          source_uuid: found.id,
          channel_uuid: channel.id,
        };
      })
      .filter((x) => x != null),
  }));
  const legendSections = React.useMemo((): LegendSection[] => {
    const indexById = new Map(
      sourceChannels.map((sc, idx) => [sc.id, idx] as const),
    );
    const activeGroup = activeChannelGroupId
      ? docChannelGroups.find((g) => g.id === activeChannelGroupId)
      : undefined;
    const hasStackVisibilityMap = Object.keys(channelVisibilities).length > 0;
    const sections: LegendSection[] = [];

    for (const im of images) {
      const entries: LegendEntry[] = [];
      const imageSources = sourceChannels.filter(
        (sc) =>
          sc.imageId === im.id && (isImageChannel(sc) || isMaskChannel(sc)),
      );

      if (activeGroup) {
        const groupChannels: LegendChannel[] = [];
        for (const gc of activeGroup.channels) {
          const sc = findSourceChannel(sourceChannels, gc.channelId);
          if (!sc || sc.imageId !== im.id) continue;
          const colorIdx = indexById.get(sc.id) ?? 0;
          groupChannels.push(
            legendChannelFromLayer(sc, gc, activeChannelGroupId, colorIdx),
          );
        }

        const overlayChannels: LegendChannel[] = [];
        // Active-group rows always remain listed so their eye can be toggled
        // back on. All Channels rows are overlays and remain only while their
        // independent stack eye is on.
        if (hasStackVisibilityMap) {
          for (const sc of imageSources) {
            if (!isStackVisible(channelVisibilities, sc.id)) continue;
            const colorIdx = indexById.get(sc.id) ?? 0;
            overlayChannels.push(legendChannelFromSource(sc, colorIdx));
          }
        }

        for (const c of groupChannels) {
          entries.push({ type: "channel", channel: c });
        }
        if (groupChannels.length > 0 && overlayChannels.length > 0) {
          entries.push({ type: "divider" });
        }
        for (const c of overlayChannels) {
          entries.push({ type: "channel", channel: c });
        }
      } else {
        let defaultIntensitySeen = 0;
        for (const sc of imageSources) {
          const visible = hasStackVisibilityMap
            ? isStackVisible(channelVisibilities, sc.id)
            : isMaskChannel(sc) ||
              defaultIntensitySeen < DEFAULT_VISIBLE_INTENSITY_CHANNELS;
          if (isImageChannel(sc)) defaultIntensitySeen += 1;
          if (!visible) continue;
          const colorIdx = indexById.get(sc.id) ?? 0;
          entries.push({
            type: "channel",
            channel: legendChannelFromSource(sc, colorIdx),
          });
        }
      }

      if (entries.length === 0) continue;
      sections.push({
        imageId: im.id,
        label: legendLabelForImage(im.basename ?? ""),
        entries,
      });
    }
    return sections;
  }, [
    images,
    sourceChannels,
    docChannelGroups,
    activeChannelGroupId,
    channelVisibilities,
  ]);

  const toggleChannel = (c: LegendChannel) => {
    if (c.group_uuid && c.channel_uuid) {
      setChannelGroupRowVisibilities({
        ...channelGroupRowVisibilities,
        [c.channel_uuid]: !(
          channelGroupRowVisibilities[c.channel_uuid] ?? true
        ),
      });
      return;
    }
    const stackVisibilities =
      Object.keys(channelVisibilities).length > 0
        ? channelVisibilities
        : defaultVisibilitiesForSources(sourceChannels, {}, docChannelGroups);
    setChannelVisibilities({
      ...stackVisibilities,
      [c.source_uuid]: !isStackVisible(stackVisibilities, c.source_uuid),
    });
  };

  const hideClass = ["show core", "hide core"][+hide];

  const allGroups =
    channelGroups.length > 0 ? (
      <>
        <OverlaySectionLabel>Channel groups</OverlaySectionLabel>
        <ChannelGroups channelGroups={channelGroups} />
      </>
    ) : null;

  const channelMenu = (
    <div className={hideClass}>
      <WrapContent>
        <WrapCore>
          {allGroups}
          <ChannelLegend
            sections={legendSections}
            channelVisibilities={channelVisibilities}
            channelGroupRowVisibilities={channelGroupRowVisibilities}
            toggleChannel={toggleChannel}
          />
        </WrapCore>
      </WrapContent>
    </div>
  );

  return (
    <TextWrap>
      {props.children}
      {hidden ? "" : channelMenu}
    </TextWrap>
  );
};

import type { ReactNode } from "react";
import * as React from "react";
import styled from "styled-components";
import { useAppStore } from "@/lib/stores/appStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { ChannelGroups } from "./ChannelGroups";
import { ChannelLegend } from "./ChannelLegend";

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
  font-size: 12px;
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
  const channelVisibilities = useAppStore((s) => s.channelVisibilities);
  const setChannelVisibilities = useAppStore((s) => s.setChannelVisibilities);
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const docChannelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const sourceChannels = React.useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );

  const channelGroups = docChannelGroups.map((grp, g) => ({
    g,
    id: grp.id,
    name: grp.name,
    channels: grp.channels
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
          group_uuid: grp.id,
          source_uuid: found.id,
          channel_uuid: channel.id,
        };
      })
      .filter((x) => x != null),
  }));

  const activeGroupId =
    activeChannelGroupId ||
    (channelGroups.length > 0 ? channelGroups[0].id : null);
  const activeViewGroup = channelGroups.find(({ id }) => id === activeGroupId);

  const toggleChannel = ({ name }: { name: string }) => {
    setChannelVisibilities(
      Object.fromEntries(
        Object.entries(channelVisibilities).map(([k, v]) => [
          k,
          k === name ? !v : v,
        ]),
      ),
    );
  };

  const legendProps = activeViewGroup
    ? {
        channels: activeViewGroup.channels.map((c) => ({
          name: c.name,
          color: c.color,
          source_uuid: c.source_uuid,
        })),
        channelVisibilities,
        toggleChannel,
      }
    : null;
  const hideClass = ["show core", "hide core"][+hide];

  const allGroups =
    channelGroups.length > 0 ? (
      <>
        <OverlaySectionLabel>Channel groups</OverlaySectionLabel>
        <ChannelGroups />
      </>
    ) : null;

  const channelMenu = (
    <div className={hideClass}>
      <WrapContent>
        <WrapCore>
          {allGroups}
          {legendProps ? <ChannelLegend {...legendProps} /> : null}
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

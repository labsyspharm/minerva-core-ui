import type { ReactNode } from "react";
import * as React from "react";
import styled from "styled-components";
import { WaypointsList } from "@/components/authoring/waypoints/WaypointsList";
// Types
import type { ConfigProps } from "@/lib/config";
import { useOverlayStore } from "@/lib/stores";
import { ChannelGroups } from "./ChannelGroups";
import { ChannelLegend } from "./ChannelLegend";

export type ChannelPanelProps = {
  children: ReactNode;
  config: ConfigProps;
  authorMode: boolean;
  hiddenChannel: boolean;
  startExport: () => void;
  channelItemElement: string;
  controlPanelElement: string;
  retrievingMetadata: boolean;
  /** When true, image/data is not loaded yet — hide channel chrome that needs channels. */
  noLoader: boolean;
  setHiddenChannel: (v: boolean) => void;
  /** Switch layout to playback / presentation (optional). */
  enterPlaybackPreview?: () => void;
};

const TextWrap = styled.div`
  position: relative;
  height: 100%;
  min-height: 0;
  > div.core {
    color: #eee;
    position: absolute;
    right: 0;
    top: 0;
    width: 220px;
    margin-bottom: 4px;
    transition: transform 0.5s ease 0s;
  }
  > div.core.hide {
    transform: translateX(100%); 
  }
  .dim {
    color: #aaa;
  }
`;

const TextOther = styled.div`
  background-color: transparent;
`;

// Content layout styles (merged from content.tsx)
const WrapContent = styled.div`
  height: 100%;
  display: grid;
  pointer-events: none;
  grid-template-rows: auto auto 1fr;
  grid-template-columns: 150px auto 100%;
  transform: translate(-150px);
`;

const WrapCore = styled.div`
  padding: 0.5em;
  grid-column: 3;
  grid-row: 1 / 3;
  overflow: auto;
  scrollbar-color: #888 var(--theme-dim-gray-color);
  pointer-events: all;
  word-wrap: break-word;
  border: 2px solid var(--theme-glass-edge);
  background-color: var(--dark-glass);
  border-radius: var(--radius-0001);
`;

const WrapNav = styled.div`
  grid-row: 1;
  grid-column: 1;
  padding: 0.8em;
  font-size: 16px;
  pointer-events: all;
  padding: 0.5em 0.75em;
  border: 2px solid var(--theme-glass-edge);
  border-right: 0;
  background-color: var(--dark-glass);
  border-radius: var(--radius-0001);
`;

const WrapColumns = styled.div`
  grid-template-columns: auto 1fr;
  display: grid;
  gap: 0.25em;
`;

const Header = styled.h2`
`;

export const ChannelPanel = (props: ChannelPanelProps) => {
  const hide = props.hiddenChannel;
  const hidden = props.retrievingMetadata || props.noLoader;
  // Subscribe only to overlay state used by this panel so viewport/zoom updates don't re-render.
  const activeChannelGroupId = useOverlayStore((s) => s.activeChannelGroupId);
  const channelVisibilities = useOverlayStore((s) => s.channelVisibilities);
  const setChannelVisibilities = useOverlayStore(
    (s) => s.setChannelVisibilities,
  );
  const Groups = useOverlayStore((s) => s.Groups);
  const SourceChannels = useOverlayStore((s) => s.SourceChannels);
  const groups = Groups.map((group, g) => {
    return {
      g,
      UUID: group.UUID,
      name: group.Name,
      channels: group.GroupChannels.map((channel) => {
        const { SourceChannel, Color } = channel;
        const { LowerRange, UpperRange } = channel;
        const found = SourceChannels.find(
          ({ UUID }) => SourceChannel.UUID === UUID,
        );
        if (found) {
          const { R, G, B } = Color;
          const hex_color = [R, G, B]
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("");
          return {
            r: R,
            g: G,
            b: B,
            lower_range: LowerRange,
            upper_range: UpperRange,
            name: found.Name,
            color: `${hex_color}`,
            source_uuid: found.UUID,
            channel_uuid: channel.UUID,
          };
        }
        return null;
      }).filter((x) => x),
    };
  });
  const group =
    groups.find(({ UUID }) => UUID === activeChannelGroupId) || groups[0];
  const toggleChannel = ({ name }) => {
    setChannelVisibilities(
      Object.fromEntries(
        Object.entries(channelVisibilities).map(([k, v]) => [
          k,
          k === name ? !v : v,
        ]),
      ),
    );
  };
  const legendProps = {
    ...props,
    ...group,
    channelVisibilities,
    toggleChannel,
  };
  const hideClass = ["show core", "hide core"][+hide];

  // Content logic (merged from content.tsx)
  const total = groups.length;
  const groupProps = { ...props, total };

  const allGroups =
    groups.length || props ? (
      <>
        <Header className="h6">
          <WrapColumns>
            <span>Channel Groups</span>
          </WrapColumns>
        </Header>
        <ChannelGroups {...{ ...groupProps, groups }} />
      </>
    ) : null;

  const channelMenu = (
    <div className={hideClass}>
      <WrapContent>
        <WrapNav>
          <ChannelLegend {...legendProps} />
        </WrapNav>
        <WrapCore>{allGroups}</WrapCore>
      </WrapContent>
    </div>
  );

  const waypointsPanel = props.authorMode ? (
    <WaypointsList onEnterPlaybackPreview={props.enterPlaybackPreview} />
  ) : null;

  const channels = !group
    ? ""
    : group.channels.map((channel) => {
        return React.createElement(props.channelItemElement, {
          key: channel.source_uuid,
          group_uuid: group.UUID,
          source_uuid: channel.source_uuid,
          channel_uuid: channel.channel_uuid,
          r: channel.r,
          g: channel.g,
          b: channel.b,
          lower_range: channel.lower_range,
          upper_range: channel.upper_range,
        });
      });

  const minerva_author_ui = React.createElement(
    props.controlPanelElement,
    null,
    <>
      {props.children}
      {waypointsPanel}
      <div slot="groups">{channels}</div>
    </>,
  );

  const content = props.authorMode ? (
    <TextOther>{minerva_author_ui}</TextOther>
  ) : (
    props.children
  );

  return (
    <TextWrap>
      {content}
      {hidden ? "" : channelMenu}
    </TextWrap>
  );
};

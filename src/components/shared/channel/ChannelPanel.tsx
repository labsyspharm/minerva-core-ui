import type { ReactNode } from "react";
import * as React from "react";
import styled from "styled-components";
import { WaypointsList } from "@/components/authoring/waypoints/WaypointsList";
import type { ConfigProps } from "@/lib/authoring/config";
import { useAppStore } from "@/lib/stores/appStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { ChannelGroups } from "./ChannelGroups";
import { ChannelGroupsMasterDetail } from "./ChannelGroupsMasterDetail";
import { ChannelLegend } from "./ChannelLegend";

export type ChannelPanelProps = {
  children: ReactNode;
  config: ConfigProps;
  authorMode: boolean;
  hiddenChannel: boolean;
  startExport: () => void;
  channelItemElement: string;
  controlPanelElement: string;
  /** When true, no OME/DICOM pipeline — hide channel overlay chrome. */
  noLoader: boolean;
  setHiddenChannel: (v: boolean) => void;
  /**
   * OME-TIFF only: fetch histogram tiles for these flat source-channel ids
   * when a group is expanded in the channel editor (cached per image).
   */
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
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

const TextOther = styled.div`
  background-color: transparent;
`;

const ChannelGroupsSlot = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

// Content layout styles (merged from content.tsx)
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
  const { setActiveChannelGroup } = useAppStore();
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const channelVisibilities = useAppStore((s) => s.channelVisibilities);
  const setChannelVisibilities = useAppStore((s) => s.setChannelVisibilities);
  const docChannelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const sourceChannels = React.useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );

  const channelGroups = docChannelGroups.map((group, g) => {
    return {
      g,
      id: group.id,
      name: group.name,
      channels: group.channels
        .map((channel) => {
          const { color } = channel;
          const found = findSourceChannel(sourceChannels, channel.channelId);
          if (found) {
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
              color: `${hex_color}`,
              group_uuid: group.id,
              source_uuid: found.id,
              channel_uuid: channel.id,
            };
          }
          return null;
        })
        .filter((x) => x),
    };
  });
  const activeGroup =
    activeChannelGroupId ||
    (channelGroups.length > 0 ? channelGroups[0].id : null);
  const group = channelGroups.find(({ id }) => id === activeGroup);
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

  const total = channelGroups.length;
  const groupProps = { ...props, total };

  const allGroups =
    channelGroups.length || props ? (
      <>
        <OverlaySectionLabel>Channel groups</OverlaySectionLabel>
        <ChannelGroups {...{ ...groupProps, channelGroups }} />
      </>
    ) : null;

  const channelMenu = (
    <div className={hideClass}>
      <WrapContent>
        <WrapCore>
          {allGroups}
          <ChannelLegend {...legendProps} />
        </WrapCore>
      </WrapContent>
    </div>
  );

  const waypointsPanel = props.authorMode ? <WaypointsList /> : null;

  const channel_list = (
    <ChannelGroupsSlot>
      <ChannelGroupsMasterDetail
        channelItemElement={props.channelItemElement}
        noLoader={props.noLoader}
        ensureChannelHistograms={props.ensureChannelHistograms}
      />
    </ChannelGroupsSlot>
  );

  const controlPanelRef = React.useRef<HTMLElement>(null);

  const minerva_author_ui = React.createElement(
    props.controlPanelElement,
    { ref: controlPanelRef },
    <>
      {props.children}
      {waypointsPanel}
      <div
        slot="groups"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {channel_list}
      </div>
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

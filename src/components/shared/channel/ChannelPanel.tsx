import * as React from "react";
import { useState } from "react";
import { ChannelLegend } from "./ChannelLegend";
import { ChannelGroups } from "./ChannelGroups";
import { useOverlayStore } from "@/lib/stores";
import styled from "styled-components";
import { Push as PushGroup } from "@/components/authoring/tools/ActionButtons";
import { EditModeSwitcher } from "@/components/authoring/tools/EditModeSwitcher";
import { defaultChannels } from "./ChannelLegend";
import { DrawingPanel } from "@/components/authoring/DrawingPanel";

// Types
import type { ConfigProps } from "@/lib/config";
import type { HashContext } from "@/lib/hashUtil";
import type { ImageProps } from "@/components/shared/common/types";

export type ChannelPanelProps = HashContext & ImageProps & {
  children: any,
  config: ConfigProps;
  authorMode: boolean;
  hiddenChannel: boolean;
  startExport: () => void;
  controlPanelElement: string;
  retrievingMetadata: boolean;
  setHiddenChannel: (v: boolean) => void;
};

const TextWrap = styled.div`
  height: 100%;
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
  background-color: blue;
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

const theme = {};

export const ChannelPanel = (props: ChannelPanelProps) => {
  const hide = props.hiddenChannel;
  const setHide = props.setHiddenChannel;

  const togglePanel = () => setHide(!hide);

  const hidden = props.retrievingMetadata;
  const {
    activeChannelGroupId,
    setChannelVisibilities,
    channelVisibilities,
    currentInteraction,
    handleLayerCreate,
    SourceChannels,
    Groups
  } = useOverlayStore();
  // TODO -- lookup group correctly
  const groups = Groups.map((group, g) => {
    return {
      g,
      UUID: group.UUID,
      name: group.Name,
      channels: group.GroupChannels.map(
        ({ SourceChannel, Color }) => {
          const found = SourceChannels.find(
            ({ UUID }) => (
              SourceChannel.UUID === UUID
            )
          );
          if (found) {
            const { R, G, B } = Color;
            const hex_color = [R, G, B].map(
              n => n.toString(16).padStart(2, '0')
            ).join('');
            return {
              name: found.Name,
              color: `${hex_color}`
            }
          }
        }
      ).filter(x => x)
    }
  });
  const group = groups.find(
    ({ UUID }) => UUID === activeChannelGroupId
  ) || groups[0];
  const toggleChannel = ({ name }) => {
    setChannelVisibilities(
      Object.fromEntries(
        Object.entries(channelVisibilities).map(
          ([k,v]) => [k, k === name ? !v : v]
        )
      )
    )
  }
  const legendProps = {
    ...props, ...group,
    channelVisibilities,
    toggleChannel
  };
  const hideClass=[
    "show core", "hide core"
  ][
    +hide
  ];

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
        <WrapCore>
          {allGroups}
        </WrapCore>
      </WrapContent>
    </div>
  );

  const drawingPanel = props.authorMode ? (
    <DrawingPanel
      hash={props.hash}
      setHash={props.setHash}
      groups={props.groups}
      onLayerCreate={handleLayerCreate}
      currentInteraction={currentInteraction}
    />
  ) : null;

  const minerva_author_ui = React.createElement(
    props.controlPanelElement, {
    class: theme, children: (
      <>
        {props.children}
        {drawingPanel}
      </>
    ),
  }
  );

  const content = props.authorMode ? (
    <TextOther>
      {minerva_author_ui}
    </TextOther>
  ) : props.children;

  return (
    <TextWrap>
      {content}
      {hidden ? "" : channelMenu}
    </TextWrap>
  );
};

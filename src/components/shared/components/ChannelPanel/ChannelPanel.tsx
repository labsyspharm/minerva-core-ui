import * as React from "react";
import { useState } from "react";
import { ChannelLegend } from "./ChannelLegend";
import { ChannelGroups } from "./ChannelGroups";
import { useOverlayStore } from "src/lib/stores";
import styled from "styled-components";
import { PushGroup } from "src/components/authoring/components/editable/EditActions";
import { Editor } from "src/components/authoring/components/editable/Editor";
import { defaultChannels } from "./ChannelLegend";

// Types
import type { ConfigProps } from "src/lib/config";
import type { Group, Story } from "src/lib/exhibit";
import type { HashContext } from "src/lib/hashUtil";

export type ImageProps = {
  name: string;
  groups: Group[];
};

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

  const { Groups } = props.config.ItemRegistry;
  const hidden = props.retrievingMetadata;
  const {
    activeChannelGroupId,
    setChannelVisibilities,
    channelVisibilities
  } = useOverlayStore();
  const group_name = Groups.find(
    ({ UUID }) => UUID === activeChannelGroupId
  )?.Properties?.Name;
  // TODO -- avoid extra name lookup step
  const group = props.groups.find(
    ({ name }) => group_name === name
  ) || {
    g: 0,
    channels: []
  };
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
  const { groups, stories } = props;
  const { pushGroup } = props;
  const { hash, setHash } = props;
  const { editable } = props;

  const total = groups.length;
  const groupProps = { ...props, total, editable, hash, setHash, stories };

  const pushFunction = (numChannels) => {
    const channels = defaultChannels.slice(0, numChannels);
    return () => {
      const newG = groups.length;
      pushGroup({
        g: newG,
        path: "TODO",
        name: `Group ${groups.length}`,
        channels: channels,
      });
      setHash({ g: newG });
    };
  };
  const extraUI = (numChannels) => {
    const onPush = pushFunction(numChannels);
    const editSwitch = [
      ["span", {}],
      [PushGroup, { onPush }],
    ];
    return <Editor {...{ ...props, editSwitch }} />;
  };

  const allGroups =
    groups.length || props.editable ? (
      <>
        <Header className="h6">
          <WrapColumns>
            {extraUI(3)}
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

  const minerva_author_ui = React.createElement(
    props.controlPanelElement, {
    class: theme, children: props.children,
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

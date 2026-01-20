import * as React from "react";
import { useState } from "react";
import { Legend } from "./legend";
import { Content } from "./content";
import { Toolbar } from "./toolbar";
//import { theme } from "../../theme.module.css";
import { useOverlayStore } from "../../lib/stores";
import styled from "styled-components";
const theme = {};

// Types
import type { ConfigProps } from "../../lib/config";
import type { Group, Story } from "../../lib/exhibit";
import type { HashContext } from "../../lib/hashUtil";

export type ImageProps = {
  name: string;
  groups: Group[];
};

export type Props = HashContext & ImageProps & {
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

const Channel = (props: Props) => {

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

  const channelMenu = (
    <div className={hideClass}>
      <Content {...props}>
        {
        // FIXME temporarily hide the channelgroup display toggle since it causes layout problems with the scrollIntoView code
        // <Toolbar
        //   {...{
        //     togglePanel,
        //     hide,
        //   }}
        // />
        }
        <Legend {...legendProps} />
      </Content>
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

export { Channel };

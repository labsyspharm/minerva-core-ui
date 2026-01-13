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
  setHiddenChannel: (v: boolean) => void;
};

const TextWrap = styled.div`
  height: 100%;
  display: grid;
  grid-template-rows: 100%;
  grid-template-columns: 1fr 200px;
  > div.core {
    color: #eee;
    grid-row: 1;
    grid-column: 2;
    margin-bottom: 4px;
    transition: transform 0.5s ease 0s;
  }
  > div.core.hide {
    transform: translateX(100%); 
  }
`;

const TextOther = styled.div`
  grid-row: 1;
  grid-column: 1 / -1;
  background-color: blue;
`;

const Channel = (props: Props) => {

  const hide = props.hiddenChannel;
  const setHide = props.setHiddenChannel;

  const togglePanel = () => setHide(!hide);

  const { Groups } = props.config.ItemRegistry;
  const hidden = false;
  const {
    activeChannelGroupId,
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
  const legendProps = { ...props, ...group };
  const hideClass=[
    "show core", "hide core"
  ][
    +hide
  ];

  const channelMenu = (
    <div className={hideClass}>
      <Content {...props}>
        <Toolbar
          {...{
            togglePanel,
            hide,
          }}
        />
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

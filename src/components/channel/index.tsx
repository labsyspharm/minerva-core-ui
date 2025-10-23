import * as React from "react";
import { useState } from "react";
import { Legend } from "./legend";
import { Content } from "./content";
import { Toolbar } from "./toolbar";
//import { theme } from "../../theme.module.css";
import styled from "styled-components";
const theme = {};

// Types
import type { ConfigProps } from "../../lib/config";
import type { Group, Story } from "../../lib/exhibit";
import type { HashContext } from "../../lib/hashUtil";

export type ImageProps = {
  groups: Group[];
};

export type Props = HashContext & ImageProps & {
  children: any,
  config: ConfigProps;
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
    transition: transform 0.5s ease 0s;
  }
`;

const TextHide = styled.div`
  > div.core {
    transform: translateX(100%);
  }
`;

const TextOther = styled.div`
  grid-row: 1;
  grid-column: 1 / -1;
`;

const Channel = (props: Props) => {

  const hide = props.hiddenChannel;
  const setHide = props.setHiddenChannel;

  const togglePanel = () => setHide(!hide);

  const { hash } = props;
  const hidden = hash.i >= 0;
  const group = props.groups[hash.g];
  const legendProps = { ...props, ...group };

  const channelMenu = (
    <div className="core">
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

  const content = (
    <TextOther>
      {minerva_author_ui}
    </TextOther>
  );

  if (hide) {
    return (
      <TextHide>
        {content}
        {hidden ? "" : channelMenu}
      </TextHide>
    );
  }
  return (
    <TextWrap>
      {content}
      {hidden ? "" : channelMenu}
    </TextWrap>
  );
};

export { Channel };

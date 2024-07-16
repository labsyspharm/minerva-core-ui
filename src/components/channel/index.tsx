import * as React from "react";
import { useState } from "react";
import { Legend } from "./legend";
import { Content } from "./content";
import { Toolbar } from "./toolbar";
import indexgrid from "minerva-author-ui";
import { getStyler } from "../../lib/util";
import styled from "styled-components";
import styles from "./index.module.css";

// Types
import type { Group, Story } from "../../lib/exhibit";
import type { HashContext } from "../../lib/hashUtil";

export type Props = HashContext & {
  children: any,
  groups: Group[];
  stories: Story[];
  hiddenChannel: boolean;
  setHiddenChannel: (v: boolean) => void;
};

const Channel = (props: Props) => {

  const styler = getStyler(styles);
  const hide = props.hiddenChannel;
  const setHide = props.setHiddenChannel;

  const togglePanel = () => setHide(!hide);

  const wrapClass = styler("textWrap", ...(hide ? ["textHide"] : []));

  const { hash } = props;
  const hidden = hash.i >= 0;
  const group = props.groups[hash.g];
  const legendProps = { ...props, ...group };

  const channelMenu = (
    <div className={styles.textCore}>
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
    indexgrid('minerva'), { children: props.children }
  );

  return (
    <div className={wrapClass}>
      <div className={styles.textOther}>
        {minerva_author_ui}
      </div>
      {hidden ? "" : channelMenu}
    </div>
  );
};

export { Channel };

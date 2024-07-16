import * as React from "react";
import { useState } from "react";
import { Legend } from "./legend";
import { Content } from "./content";
import { Toolbar } from "./toolbar";
import { getStyler } from "../../lib/util";
import styles from "./index.module.css";

// Types
import type { Group, Story } from "../../lib/exhibit";
import type { HashContext } from "../../lib/hashUtil";

type Props = HashContext & {
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

  return (
    <div className={wrapClass}>
      <div className={styles.textOther}>
        <indexgrid-minerva>
          {props.children}
        </indexgrid-minerva>
      </div>
      {hidden ? "" : channelMenu}
    </div>
  );
};

export { Channel };

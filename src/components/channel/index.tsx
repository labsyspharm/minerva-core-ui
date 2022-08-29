import * as React from "react";
import { useState } from "react";
import { Legend } from "./legend";
import { Content } from "./content";
import { Toolbar } from "./toolbar";
import { Outlet, useOutletContext } from "react-router-dom";
import { getStyler } from "../../lib/util";
import styles from "./index.module.css";

// Types
import type { Group, Story } from "../../lib/exhibit";
import type { HashContext } from "../../lib/hashUtil";

type Props = {
  groups: Group[];
  stories: Story[];
  hidden: boolean;
};

const Channel = (props: Props) => {
  const styler = getStyler(styles);
  const [hide, setHide] = useState(false);
  const context = useOutletContext() as HashContext;
  const contextProps = { ...props, ...context };

  const togglePanel = () => setHide(!hide);

  const wrapClass = styler("textWrap", ...(hide ? ["textHide"] : []));

  const { hidden } = props;
  const { hash } = context;
  const group = props.groups[hash.g];
  const legendProps = { ...props, ...group };

  const channelMenu = (
    <div className={styles.textCore}>
      <Content {...contextProps}>
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
        <Outlet {...{ context }} />
      </div>
      {hidden ? "" : channelMenu}
    </div>
  );
};

export { Channel };

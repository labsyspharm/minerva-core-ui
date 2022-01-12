import * as React from "react";
import { useState } from "react";
import { Legend } from "./legend";
import { Content } from "./content";
import { Toolbar } from "./toolbar";
import { useHash } from "../../lib/hashUtil";
import { getStyler } from "../../lib/util";
import { Outlet } from "react-router-dom";
import styles from "./index.module.css";

// Types
import type { Group, Story } from "../../lib/exhibit";

type Props = {
  groups: Group[];
  stories: Story[];
};

const Channel = (props: Props) => {
  const styler = getStyler(styles);
  const [hide, setHide] = useState(false);

  const togglePanel = () => setHide(!hide);

  const wrapClass = styler("textWrap", ...(hide ? ["textHide"] : []));

  const hash = useHash();
  const group = props.groups[hash.g];

  return (
    <div className={wrapClass}>
      <div className={styles.textOther}>
        <Outlet />
      </div>
      <div className={styles.textCore}>
        <Content {...props}>
          <Toolbar
            {...{
              togglePanel,
              hide,
            }}
          />
          <Legend {...group} />
        </Content>
      </div>
    </div>
  );
};

export { Channel };

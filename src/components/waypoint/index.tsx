import * as React from "react";
import { useState } from "react";
import { Content } from "./content";
import { Toolbar } from "./toolbar";
import { getStyler } from "../../lib/util";
import { Outlet } from "react-router-dom";
import styles from "./index.module.css";

// Types
import type { Story } from "../../lib/exhibit";

type Props = {
  stories: Story[];
  toggleViewer: () => void;
  onZoomInEl: (HTMLButtonElement) => void;
  onZoomOutEl: (HTMLButtonElement) => void;
};

const Waypoint = (props: Props) => {
  const styler = getStyler(styles);
  const [hide, setHide] = useState(false);
  const { onZoomInEl, onZoomOutEl } = props;

  const togglePanel = () => setHide(!hide);

  const wrapClass = styler("textWrap", ...(hide ? ["textHide"] : []));

  return (
    <div className={wrapClass}>
      <div className={styles.textCore}>
        <Content {...props}>
          <Toolbar
            {...{
              onZoomInEl,
              onZoomOutEl,
              togglePanel,
              hide,
            }}
          />
        </Content>
      </div>
      <div className={styles.textOther}>
        <Outlet />
      </div>
    </div>
  );
};

export { Waypoint };

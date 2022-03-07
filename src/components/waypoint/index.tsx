import * as React from "react";
import { useState } from "react";
import { Content } from "./content";
import { Toolbar } from "./toolbar";
import { useHash, useSetHash } from "../../lib/hashUtil";
import { getStyler } from "../../lib/util";
import { Outlet, Link } from "react-router-dom";
import styles from "./index.module.css";

// Types
import type { Story } from "../../lib/exhibit";
import type { HashState } from "../../lib/hashutil";
import type { ExternalProps } from "./content";

type Props = ExternalProps & {
  onZoomInEl: (e: HTMLButtonElement) => void;
  onZoomOutEl: (e: HTMLButtonElement) => void;
};

const invalidateHash = ({ stories, groups }, { hash }) => {
  const output: Partial<HashState> = {};
  if (stories.length <= hash.s) {
    output.s = hash.s;
  }
  if (stories[hash.s].waypoints.length <= hash.w) {
    output.w = hash.w;
  }
  if (groups.length <= hash.g) {
    output.g = hash.g;
  }
  return output;
};

const Waypoint = (props: Props) => {
  const styler = getStyler(styles);
  const [hide, setHide] = useState(false);
  const { onZoomInEl, onZoomOutEl } = props;

  const togglePanel = () => setHide(!hide);
  const context = {
    hash: useHash(),
    setHash: useSetHash(),
  };
  const invalid = invalidateHash(props, context);
  if (Object.keys(invalid).length) {
    return (
      <div className={styles.invalid}>
        <p></p>
        <p>
          <h3>You refreshed the page.</h3>
          <h5>Your changes were not saved.</h5>
          <br />
          <Link to="/">Reset the demo</Link>
        </p>
        <p></p>
      </div>
    );
  }

  const wrapClass = styler("textWrap", ...(hide ? ["textHide"] : []));

  return (
    <div className={wrapClass}>
      <div className={styles.textCore}>
        <Content {...{ ...props, ...context }}>
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
        <Outlet {...{ context }} />
      </div>
    </div>
  );
};

export { Waypoint };

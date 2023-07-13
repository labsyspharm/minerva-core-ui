import * as React from "react";
import { useState } from "react";
import { Content } from "./content";
import { Toolbar } from "./toolbar";
import { getStyler } from "../../lib/util";
import styles from "./index.module.css";

// Types
import type { Story } from "../../lib/exhibit";
import type { HashState } from "../../lib/hashUtil";
import type { ExternalProps } from "./content";

export type Props = ExternalProps & {
  children: any,
  onZoomInEl: (e: HTMLButtonElement) => void;
  onZoomOutEl: (e: HTMLButtonElement) => void;
  hiddenWaypoint: boolean;
  setHiddenWaypoint: (v: boolean) => void;
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

const toWrapKey = (hide: boolean) => {
  if (hide) {
    return ["textHide"];
  }
  return [];
}

const Waypoint = (props: Props) => {
  const styler = getStyler(styles);
  const hide = props.hiddenWaypoint;
  const setHide = props.setHiddenWaypoint;
  const { onZoomInEl, onZoomOutEl } = props;

  const togglePanel = () => setHide(!hide);
  const toggleInfo = () => {
    props.setHash({i: 0});
  };
  const invalid = invalidateHash(props, props);
  if (Object.keys(invalid).length) {
    return (
      <div className={styles.invalid}>
        <p></p>
        <p>
          <h3>You refreshed the page.</h3>
          <h5>Your changes were not saved.</h5>
          <br />
          <a href="/">Reset the demo</a>
        </p>
        <p></p>
      </div>
    );
  }

  const wrapKeys = toWrapKey(hide);
  const wrapClass = styler("textWrap", ...wrapKeys);

  return (
    <div className={wrapClass}>
      <div className={styles.textCore}>
        <Content {...{ ...props }}>
          <Toolbar
            {...{
              onZoomInEl,
              onZoomOutEl,
              togglePanel,
              toggleInfo,
              hide,
            }}
          />
        </Content>
      </div>
      <div className={styles.textOther}>
      { props.children }
      </div>
    </div>
  );
};

export { Waypoint };

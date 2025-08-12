import * as React from "react";
import type { Group } from "../../lib/exhibit";
import styles from "./index.module.css";

// Types
import type { HashContext } from "../../lib/hashUtil";

export type Props = HashContext & {
  groups: Group[];
};

const Overlays = (props: Props) => {

  const { hash } = props;
  const group = props.groups[hash.g];

  const className = [
    styles.red, styles.center
  ].join(" ");
  return (
    <div slot="overlays" className={className}>
      <div>Active Group: {group?.name || "None"}</div>
    </div>
  );
};

export { Overlays };

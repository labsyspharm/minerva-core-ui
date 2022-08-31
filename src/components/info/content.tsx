import * as React from "react";
import { Icon } from "../common/icon";
import {
  faTimes
} from "@fortawesome/free-solid-svg-icons";
import ReactJson from 'react-json-view'
import MITI_UI from "./miti_ui";
import styles from "./content.module.css";

// Types
import type { HashState } from "../../lib/hashUtil";

type NavProps = {
  onClick: (e: any) => void;
  className: string;
  key: string;
}

type Props = {
  hash: HashState;
  setHash: (h: Partial<HashState>) => void;
}

const jsonTheme = {
  "base00": "rgba(0, 0, 0, 0)",
  "base08": "#ff00ff",
  "base0B": "#ffaa00",
  "base0A": "#ffaa00",
  "base0D": "#00aaff",
  "base0E": "#ff00ff",
  "base0C": "#00aaff",
  "base05": "#a0a0a0",
  "base03": "#a0a0a0",
  "base09": "#ffaa00",
  "base01": "#000000",
  "base02": "#000000",
  "base04": "#a0a0a0",
  "base06": "#a0a0a0",
  "base0F": "#ff0000",
  "base07": "#ffffff",
};

const toNavItem = (props: NavProps) => {
  return <div {...props}>{props.key}</div>;
}

const Content = (props: Props) => {

  const { hash, setHash } = props;
  const closeProps = {
    onClick: () => {
      setHash({i: -1});
    },
    icon: faTimes,
    size: "2em"
  }
  const mitiKeys = Object.keys(MITI_UI);
  const iKey = Math.min(hash.i, mitiKeys.length - 1);
  const navKey = mitiKeys[iKey];

  const jsonProps = {
    src: MITI_UI[navKey],
    collapsed: 1,
    name: navKey,
    theme: jsonTheme,
    style: {
      fontSize: "1.5em",
      fontFamily: "'Kreon', sans"
    },
    displayDataTypes: false,
    displayObjectSize: false
  }



  const onNavClick = (key: string) => {
    const i = mitiKeys.indexOf(key);
    setHash({ i });
  }
  const navItems = mitiKeys.map((key: string) => {
    const onClick = (e) => {
      onNavClick(key);
    };
    const className = (navKey == key)? styles.active : "";
    return toNavItem({key, onClick, className});
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.close}>
        <Icon {...closeProps} />
      </div>
      <div className={styles.nav}>
        {navItems}
      </div>
      <div className={styles.core}>
        <ReactJson {...jsonProps} />
      </div>
    </div>
  );
};

export { Content };

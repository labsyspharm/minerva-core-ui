import * as React from "react";
import { Icon } from "../common/icon";
import {
  faTimes
} from "@fortawesome/free-solid-svg-icons";
import ReactJson from 'react-json-view'
import MITI_UI from "./miti_ui";
import styles from "./content.module.css";

type Props = {
  close: () => void;
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

const Content = (props: Props) => {

  const closeProps = {
    onClick: props.close,
    icon: faTimes,
    size: "2em"
  }

  const jsonProps = {
    src: MITI_UI,
    collapsed: 2,
    name: null,
    theme: jsonTheme,
    displayDataTypes: false,
    displayObjectSize: false
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.close}>
        <Icon {...closeProps} />
      </div>
      <div className={styles.core}>
        <ReactJson {...jsonProps} />
      </div>
    </div>
  );
};

export { Content };

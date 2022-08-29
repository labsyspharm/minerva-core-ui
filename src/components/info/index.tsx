import * as React from "react";
import { Content } from "./content";
import { Outlet } from "react-router-dom";
import { useHash, useSetHash } from "../../lib/hashUtil";
import { getStyler } from "../../lib/util";
import styles from "./index.module.css";

type Props = {
  close: () => void;
}

const Info = (props: Props) => {

  const context = {
    hash: useHash(),
    setHash: useSetHash(),
  };

  const styler = getStyler(styles);
  const wrapClass = styler("textWrap", ...[]);

  return (
    <div className={wrapClass}>
      <div className={styles.textCore}>
        <Content {...props}/> 
      </div>
      <div className={styles.textOther}>
        <Outlet {...{ context }} />
      </div>
    </div>
  );
};

export { Info };

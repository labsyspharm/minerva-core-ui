import * as React from "react";
import { Content } from "./content";
import type { HashContext } from "../../lib/hashUtil";
import { getStyler } from "../../lib/util";
import styles from "./index.module.css";

type Props = HashContext & {
  children: any
};

const Info = (props: Props) => {

  const styler = getStyler(styles);
  const wrapClass = styler("textWrap", ...[]);

  return (
    <div className={wrapClass}>
      <div className={styles.textCore}>
        <Content {...{...props}}/> 
      </div>
      <div className={styles.textOther}>
        { props.children }
      </div>
    </div>
  );
};

export { Info };

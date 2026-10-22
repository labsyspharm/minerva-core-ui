import type { ReactNode } from "react";
import { PlusIcon } from "@/components/shared/common/PlusIcon";
import CheckIcon from "@/components/shared/icons/check.svg?react";
import MinusIcon from "@/components/shared/icons/minus.svg?react";
import { PanelIconButton } from "@/components/shared/panel/PanelButtons";
import styles from "./ActionButtons.module.css";

type OverlayIconButtonProps = {
  onClick?: () => void;
  children: ReactNode;
  "aria-label"?: string;
};

const IconButton = (props: OverlayIconButtonProps) => {
  const { onClick, children, "aria-label": ariaLabel } = props;
  return (
    <PanelIconButton
      className={onClick ? styles.clickable : styles.static}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </PanelIconButton>
  );
};

const Push = (props: { onPush?: () => void }) => (
  <IconButton onClick={props.onPush} aria-label="Add channel">
    <PlusIcon />
  </IconButton>
);

const PopUpdate = (props: { onPop?: () => void; children?: ReactNode }) => {
  const { onPop, children } = props;
  return (
    <div className={styles.wrapColumn}>
      <IconButton onClick={onPop} aria-label="Remove channel">
        <MinusIcon />
      </IconButton>
      {children}
    </div>
  );
};

const Update = (props: { onUpdate?: () => void; children?: ReactNode }) => {
  const { onUpdate, children } = props;
  return (
    <div className={styles.wrapColumn}>
      <IconButton onClick={onUpdate} aria-label="Confirm">
        <CheckIcon />
      </IconButton>
      {children}
    </div>
  );
};

export { Push, PopUpdate, Update };

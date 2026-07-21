import type { CSSProperties, ReactNode } from "react";
import { PlusIcon } from "@/components/shared/common/PlusIcon";
import CheckIcon from "@/components/shared/icons/check.svg?react";
import MinusIcon from "@/components/shared/icons/minus.svg?react";
import styles from "./ActionButtons.module.css";

type GlassIconButtonProps = {
  color: string;
  onClick?: () => void;
  children: ReactNode;
  "aria-label"?: string;
};

const IconButton = (props: GlassIconButtonProps) => {
  const { color, onClick, children, "aria-label": ariaLabel } = props;
  return (
    <button
      type="button"
      className={[
        styles.glassIconButton,
        onClick ? styles.glassIconButtonClickable : null,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--icon-color": color } as CSSProperties}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
};

const Push = (props: { onPush?: () => void }) => (
  <IconButton color="#2e5" onClick={props.onPush} aria-label="Add channel">
    <PlusIcon size={14} />
  </IconButton>
);

const PopUpdate = (props: { onPop?: () => void; children?: ReactNode }) => {
  const { onPop, children } = props;
  return (
    <div className={styles.wrapColumn}>
      <IconButton color="#e25" onClick={onPop} aria-label="Remove channel">
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
      <IconButton color="#fff" onClick={onUpdate} aria-label="Confirm">
        <CheckIcon />
      </IconButton>
      {children}
    </div>
  );
};

export { Push, PopUpdate, Update };

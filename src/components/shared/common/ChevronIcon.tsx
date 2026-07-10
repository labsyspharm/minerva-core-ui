import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import styles from "@/components/shared/panel/panelChrome.module.css";

export type ChevronDirection = "right" | "left" | "down" | "up";

const DIRECTION_CLASS: Record<ChevronDirection, string> = {
  right: styles.chevronRight,
  left: styles.chevronLeft,
  down: styles.chevronDown,
  up: styles.chevronUp,
};

export type ChevronIconProps = {
  direction?: ChevronDirection;
  className?: string;
};

/** Shared chevron (down-pointing SVG rotated for direction). */
export function ChevronIcon({
  direction = "down",
  className,
}: ChevronIconProps) {
  return (
    <ChevronDownIcon
      className={[DIRECTION_CLASS[direction], className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    />
  );
}

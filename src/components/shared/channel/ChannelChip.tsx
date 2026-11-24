import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { CursorHint } from "@/components/shared/channel/ChannelVisibilitySwatch";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import { VIEWER_INTENSITY_LIMIT_HINT } from "@/lib/imaging/channelKind";
import styles from "./ChannelChip.module.css";

/**
 * - `on`: painted in the viewer, filled with its color.
 * - `faded`: painted, but shown by a group line elsewhere; a pale fill.
 * - `outlined`: part of what's on screen (the active group) but hidden or not drawn.
 * - `neutral`: not part of what's on screen; no color shown.
 * - `unassigned`: shown, but no color picked yet.
 */
export type ChannelChipTone =
  | "on"
  | "faded"
  | "outlined"
  | "neutral"
  | "unassigned";

/** H&E / packed-RGB unit chip — same magenta as the `samples === 3` default tint. */
export const RGB_UNIT_CHIP_HEX = "cc00ff";

/** Black or white label, whichever reads on a filled chip of `hex`. */
function inkOnHex(hex: string): string {
  const n = Number.parseInt(hex.slice(0, 6), 16);
  if (Number.isNaN(n)) return "#000";
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 110 ? "#000" : "#fff";
}

const TONE_CLASS: Record<ChannelChipTone, string> = {
  on: styles.on,
  faded: styles.faded,
  outlined: styles.outlined,
  neutral: styles.neutral,
  unassigned: styles.unassigned,
};

/** One channel as a compact toggle (the author Images tab's chips and tiles). */
export function ChannelChip(props: {
  name: string;
  /** Hex without `#`; empty for none. */
  hex?: string;
  tone: ChannelChipTone;
  pressed: boolean;
  ariaLabel: string;
  title?: string;
  /** Turning on would pass the viewer's channel cap. */
  blocked?: boolean;
  onClick?: () => void;
  /** Keys on the chip's button (e.g. F2 to rename). */
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  /** Overlaid at the right edge, e.g. the Images tab's editor chevron. */
  trailing?: ReactNode;
}) {
  const { hex, tone, blocked } = props;
  const style = hex
    ? ({ "--ch": `#${hex}`, "--ch-ink": inkOnHex(hex) } as CSSProperties)
    : undefined;
  return (
    <div className={`${styles.cell} ${TONE_CLASS[tone]}`} style={style}>
      <CursorHint
        enabled={Boolean(blocked)}
        label={VIEWER_INTENSITY_LIMIT_HINT}
        className={styles.hint}
      >
        <button
          type="button"
          className={`${minervaTheme.focusRing} ${styles.button}`}
          title={props.title}
          aria-label={blocked ? VIEWER_INTENSITY_LIMIT_HINT : props.ariaLabel}
          aria-pressed={props.pressed}
          aria-disabled={blocked || undefined}
          onKeyDown={props.onKeyDown}
          onClick={() => {
            if (blocked) return;
            props.onClick?.();
          }}
        >
          {props.name}
        </button>
      </CursorHint>
      {props.trailing}
    </div>
  );
}

export const channelChipStyles = styles;

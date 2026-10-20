import { color } from "@uiw/color-convert";
import type { Chrome } from "@uiw/react-color";
import Hue from "@uiw/react-color-hue";
import Saturation from "@uiw/react-color-saturation";
import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import CloseIcon from "@/components/shared/icons/close.svg?react";
import styles from "./ColorPickerPopover.module.css";

/** Clamp popover so it stays on-screen (channel + annotation pickers). */
export function colorPickerAnchorPosition(rect: DOMRect): {
  top: number;
  left: number;
} {
  return {
    top: Math.min(rect.bottom + 4, window.innerHeight - 318),
    left: Math.min(rect.left, window.innerWidth - 252),
  };
}

type ColorPickerPopoverProps = {
  position: { top: number; left: number } | null;
  onClose: () => void;
} & Omit<React.ComponentProps<typeof Chrome>, "ref">;

/** Fixed popover. Chevron, hue, white, and close share one row. */
export function ColorPickerPopover({
  position,
  onClose,
  ...pickerProps
}: ColorPickerPopoverProps) {
  React.useEffect(() => {
    if (!position) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [position, onClose]);

  const currentColor = color(pickerProps.color);
  const [expanded, setExpanded] = React.useState(false);

  const { h, s, v } = currentColor.hsva;
  const isWhite = s < 1 && v > 99;
  // White is stored as RGB, which reads back as hue 0. Remember the last real hue.
  const hue = React.useRef(h);
  if (s >= 1) hue.current = h;

  const paint = (nextH: number, nextS: number, nextV: number) => {
    hue.current = nextH;
    pickerProps.onChange(color({ h: nextH, s: nextS, v: nextV, a: 1 }));
  };
  const saturationProps = {
    hsva: currentColor.hsva,
    className: expanded
      ? styles.saturation
      : `${styles.saturation} ${styles.saturationHidden}`,
    /* Library sets height inline; only an inline 0 collapses it. */
    style: expanded ? undefined : { height: 0 },
    onChange: ({ h, v, s, a }) => {
      pickerProps.onChange(color({ h, v, s, a }));
    },
  };

  if (!position || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close color picker"
        onClick={onClose}
      />
      <div
        data-minerva-color-picker=""
        className={styles.panel}
        style={{ top: position.top, left: position.left }}
      >
        <div
          className={
            expanded
              ? `${styles.colorGrid} ${styles.colorGridExpanded}`
              : styles.colorGrid
          }
        >
          <div className={styles.hueRow}>
            <button
              type="button"
              className={styles.iconButton}
              aria-expanded={expanded}
              title={expanded ? "Fewer colors" : "More colors"}
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronIcon direction={expanded ? "down" : "right"} />
            </button>
            <Hue
              hue={hue.current}
              onChange={({ h: nextH }) => {
                const vivid = !expanded && s < 1;
                paint(nextH, vivid ? 100 : s, vivid ? 100 : v);
              }}
            />
            <button
              type="button"
              className={styles.whiteSwatch}
              aria-pressed={isWhite}
              aria-label="White"
              title="White"
              onClick={() => paint(hue.current, 0, 100)}
            />
            <button
              type="button"
              title="Close"
              aria-label="Close color picker"
              className={styles.iconButton}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <CloseIcon aria-hidden className={styles.closeIcon} />
            </button>
          </div>
          <Saturation {...saturationProps} />
        </div>
      </div>
    </>,
    document.body,
  );
}

import { color } from "@uiw/color-convert";
import type { Chrome } from "@uiw/react-color";
import Hue from "@uiw/react-color-hue";
import Saturation from "@uiw/react-color-saturation";
import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import CloseIcon from "@/components/shared/icons/close.svg?react";
import { stainOver } from "@/lib/imaging/stainExtension";
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
  /** The color is a stain's color on glass: preview it over H&E. */
  stainPreview?: boolean;
} & Omit<React.ComponentProps<typeof Chrome>, "ref">;

const STAIN_PREVIEW_STOPS = [0, 0.25, 0.5, 0.75, 1];

/** Brightfield colors a stain lands on. */
const STAIN_PREVIEW_BACKGROUNDS: {
  label: string;
  rgb: readonly [number, number, number];
}[] = [
  { label: "Glass", rgb: [255, 255, 255] },
  { label: "Eosin", rgb: [236, 158, 199] },
  { label: "Hematoxylin", rgb: [86, 64, 145] },
];

/** No signal → full signal for `rgb` as a stain over typical H&E colors. */
function StainPreview({ rgb }: { rgb: [number, number, number] }) {
  return (
    <div className={styles.stainPreview}>
      {STAIN_PREVIEW_BACKGROUNDS.map(({ label, rgb: under }) => {
        const stops = STAIN_PREVIEW_STOPS.map(
          (c) => `rgb(${stainOver(under, rgb, c).join(" ")})`,
        );
        return (
          <div key={label} className={styles.stainPreviewItem}>
            <div
              className={styles.stainPreviewRamp}
              title={`${label}: no signal → full signal`}
              style={{ background: `linear-gradient(to right, ${stops})` }}
            />
            <span className={styles.stainPreviewLabel}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Fixed popover. Chevron, hue, white, and close share one row. */
export function ColorPickerPopover({
  position,
  onClose,
  stainPreview = false,
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
        {stainPreview ? (
          <StainPreview
            rgb={[
              currentColor.rgba.r,
              currentColor.rgba.g,
              currentColor.rgba.b,
            ]}
          />
        ) : null}
      </div>
    </>,
    document.body,
  );
}

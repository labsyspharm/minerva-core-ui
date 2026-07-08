import type { MouseEventHandler } from "react";
import styles from "./ChannelList.module.css";

const EyeIcon = () => (
  <svg
    aria-hidden
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <title>Visible</title>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    aria-hidden
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <title>Hidden</title>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

type VisibilityProps = {
  visible: boolean;
  title: string;
  ariaLabel: string;
  onClick: () => void;
  className?: string;
};

/** Eye toggle for channel / group visibility (Photoshop-style). */
export function ChannelVisibilitySwatch(props: VisibilityProps) {
  const { visible, title, ariaLabel, onClick, className } = props;
  return (
    <button
      type="button"
      className={
        className ??
        [
          styles.channelVisibilityButton,
          visible ? "" : styles.channelVisibilityButtonHidden,
        ]
          .filter(Boolean)
          .join(" ")
      }
      title={title}
      aria-label={ariaLabel}
      aria-pressed={visible}
      onClick={onClick}
    >
      {visible ? <EyeIcon /> : <EyeOffIcon />}
    </button>
  );
}

type ColorProps = {
  hex: string;
  title: string;
  ariaLabel: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  className?: string;
};

/** Filled square showing channel color; opens the color picker when clicked. */
export function ChannelColorSwatchButton(props: ColorProps) {
  const { hex, title, ariaLabel, onClick, className } = props;
  return (
    <button
      type="button"
      className={className ?? styles.channelColorSwatch}
      style={{ backgroundColor: `#${hex}` }}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
    />
  );
}

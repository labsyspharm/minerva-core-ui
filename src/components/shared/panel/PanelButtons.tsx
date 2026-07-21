import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./PanelButtons.module.css";

export type PanelIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** `header` = 30×30 square; `row` = 24×24 pill */
  variant?: "header" | "row";
  active?: boolean;
};

/** Shared panel icon button (header actions or row viewport controls). */
export function PanelIconButton({
  children,
  variant = "header",
  active,
  className,
  type = "button",
  ...rest
}: PanelIconButtonProps) {
  const base =
    variant === "row" ? styles.rowIconButton : styles.iconHeaderButton;
  return (
    <button
      type={type}
      className={[
        base,
        active ? styles.iconHeaderButtonActive : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

export type PanelActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  active?: boolean;
};

/** Shared text CTA used in panel headers (Add group / Add image). */
export function PanelActionButton({
  children,
  active,
  className,
  type = "button",
  ...rest
}: PanelActionButtonProps) {
  return (
    <button
      type={type}
      className={[
        styles.headerActionButton,
        active ? styles.headerActionButtonActive : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  minervaThemeControlActiveClassName,
  minervaThemeControlClassName,
  minervaThemeControlRowClassName,
  minervaThemeControlTextClassName,
} from "@/components/shared/minervaTheme";

export type PanelIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** `header` = 28×28 square; `row` = 24×24 */
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
    variant === "row"
      ? minervaThemeControlRowClassName
      : minervaThemeControlClassName;
  return (
    <button
      type={type}
      data-icon-button=""
      className={[
        base,
        active ? minervaThemeControlActiveClassName : null,
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

/** Shared text CTA used in panel headers. */
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
        minervaThemeControlClassName,
        minervaThemeControlTextClassName,
        active ? minervaThemeControlActiveClassName : null,
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

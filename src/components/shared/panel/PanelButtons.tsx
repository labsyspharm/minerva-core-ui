import type { ButtonHTMLAttributes, ReactNode } from "react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";

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
    variant === "row" ? minervaTheme.controlRow : minervaTheme.control;
  return (
    <button
      type={type}
      data-icon-button=""
      className={[base, active ? minervaTheme.controlActive : null, className]
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
        minervaTheme.control,
        minervaTheme.controlText,
        active ? minervaTheme.controlActive : null,
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

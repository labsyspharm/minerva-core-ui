import type { CSSProperties, ReactNode } from "react";
import styles from "./StoryBannerBar.module.css";

/** Play / Back control height shared by author + preview banners. */
export const STORY_BANNER_CONTROL_SIZE_PX = 28;

/** Compose onto title `<input>` / `<span>` so author + preview share type. */
export const storyBannerTitleClassName = styles.titleText;

export type StoryBannerBarProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Author title bar uses `section`; preview ribbon uses `div`. */
  as?: "div" | "section";
  "aria-label"?: string;
};

/**
 * Full-width story banner chrome shared by `StoryTitleBar` and `Presentation`.
 */
export function StoryBannerBar({
  children,
  className,
  style,
  as: Tag = "div",
  "aria-label": ariaLabel,
}: StoryBannerBarProps) {
  return (
    <Tag
      className={[styles.bar, className].filter(Boolean).join(" ")}
      style={
        {
          "--story-banner-control-size": `${STORY_BANNER_CONTROL_SIZE_PX}px`,
          ...style,
        } as CSSProperties
      }
      aria-label={ariaLabel}
    >
      {children}
    </Tag>
  );
}

import { createElement } from "react";
import styles from "./minervaTheme.module.css";

/** Muted cloth fills for spines / ghost volumes. */
export const STORY_CLOTH = [
  "var(--cloth-1)",
  "var(--cloth-2)",
  "var(--cloth-3)",
  "var(--cloth-4)",
  "var(--cloth-5)",
  "var(--cloth-6)",
  "var(--cloth-7)",
  "var(--cloth-8)",
] as const;

const SPINE_HEIGHTS = [0.72, 1, 0.86] as const;

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Tiny cloth-spine cluster — same motif as the library shelf. */
export function StorySpines({ seed }: { seed: string }) {
  const h = hashSeed(seed || "story");
  return createElement(
    "span",
    { className: styles.volume, "aria-hidden": true },
    SPINE_HEIGHTS.map((frac, i) =>
      createElement("span", {
        key: i,
        className: styles.spine,
        style: {
          height: `${frac * 100}%`,
          background: STORY_CLOTH[(h + i * 3) % STORY_CLOTH.length],
        },
      }),
    ),
  );
}

export const minervaThemeRootClassName = styles.root;
export const minervaThemeBarClassName = styles.bar;
export const minervaThemeTitleClassName = styles.title;
export const minervaThemeFieldClassName = styles.field;
export const minervaThemeControlClassName = styles.control;
export const minervaThemeControlActiveClassName = styles.controlActive;
export const minervaThemeControlTextClassName = styles.controlText;
export const minervaThemeControlRowClassName = styles.controlRow;
export const minervaThemeControlOutlinedClassName = styles.controlOutlined;
export const minervaThemeClusterClassName = styles.cluster;
export const minervaThemeClusterFieldsetClassName = styles.clusterFieldset;
export const minervaThemeMenuClassName = styles.menu;
export const minervaThemeMenuFixedClassName = styles.menuFixed;
export const minervaThemeMenuItemClassName = styles.menuItem;
export const minervaThemeMenuItemGapClassName = styles.menuItemGap;
export const minervaThemeStripClassName = styles.strip;
export const minervaThemeTabListClassName = styles.tabList;
export const minervaThemeTabClassName = styles.tab;
export const minervaThemeTabActiveClassName = styles.tabActive;

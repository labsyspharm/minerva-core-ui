import type { RefObject } from "react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import styles from "./ChannelSearch.module.css";
import { cx } from "./units";

/**
 * The channel search box beside each image's name: it filters that image's
 * tiles, which are also a group's add list while its "+" is on. Matching is
 * `channelNameMatchesQuery`. Escape clears it; with it already empty, Escape
 * calls `onEscapeEmpty`.
 */
export function ChannelSearch(props: {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name, e.g. "Search SARDANA channels". */
  label: string;
  onEscapeEmpty?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <input
      ref={props.inputRef}
      type="search"
      className={cx(minervaTheme.focusRing, styles.search)}
      placeholder="Search channels"
      aria-label={props.label}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          if (props.value) props.onChange("");
          else props.onEscapeEmpty?.();
        }
      }}
    />
  );
}

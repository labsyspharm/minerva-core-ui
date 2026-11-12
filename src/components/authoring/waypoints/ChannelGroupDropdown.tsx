import * as React from "react";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import { findSourceChannel } from "@/lib/stores/documentStore";
import styles from "./WaypointsList.module.css";

function channelNamesForGroup(
  group: ChannelGroup,
  sourceChannels: Channel[],
): string[] {
  return (group.channels ?? [])
    .map((gc) => findSourceChannel(sourceChannels, gc.channelId))
    .filter((sc): sc is Channel => sc != null)
    .map((sc) => sc.name);
}

/** Channel group picker showing each group's channel names under its title. */
export function ChannelGroupDropdown(props: {
  /** For a `<label htmlFor>`. */
  id?: string;
  groups: ChannelGroup[];
  sourceChannels: Channel[];
  selectedId: string | undefined;
  onSelect: (groupId: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const {
    id,
    groups,
    sourceChannels,
    selectedId,
    onSelect,
    disabled,
    ariaLabel,
  } = props;
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = groups.find((group) => group.id === selectedId);
  const selectedSubtitle = selected
    ? channelNamesForGroup(selected, sourceChannels).join(", ")
    : "";

  return (
    <div className={styles.channelGroupDropdown} ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`${minervaTheme.input} ${minervaTheme.focusRing} ${styles.channelGroupDropdownTrigger}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span className={styles.channelGroupDropdownTriggerMain}>
          <span className={styles.channelGroupDropdownTitle}>
            {selected?.name ?? "Choose a group"}
          </span>
          <span className={styles.channelGroupDropdownChannels}>
            {selectedSubtitle || "—"}
          </span>
        </span>
        <ChevronIcon
          direction={open ? "up" : "down"}
          className={styles.channelGroupDropdownChevron}
        />
      </button>
      {open ? (
        <div
          className={`${minervaTheme.menu} ${styles.channelGroupDropdownMenu}`}
          role="listbox"
          aria-label={ariaLabel}
        >
          {groups.map((group) => {
            const subtitle = channelNamesForGroup(group, sourceChannels).join(
              ", ",
            );
            const isSelected = group.id === selectedId;
            return (
              <div key={group.id} className={styles.channelGroupDropdownItem}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    minervaTheme.menuItem,
                    styles.channelGroupDropdownOption,
                    isSelected ? minervaTheme.selectLeft : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    setOpen(false);
                    onSelect(group.id);
                  }}
                >
                  <span className={styles.channelGroupDropdownTitle}>
                    {group.name}
                  </span>
                  <span className={styles.channelGroupDropdownChannels}>
                    {subtitle || "—"}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

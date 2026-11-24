import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAuthorChannelNav } from "@/components/shared/channel/AuthorChannelNav";
import {
  ChannelChip,
  type ChannelChipTone,
  channelChipStyles,
} from "@/components/shared/channel/ChannelChip";
import { ChannelEditor } from "@/components/shared/channel/ChannelEditorPopover";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import LockIcon from "@/components/shared/icons/lock.svg?react";
import LockOpenIcon from "@/components/shared/icons/lock-open.svg?react";
import PencilIcon from "@/components/shared/icons/pencil.svg?react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import type { ImageChannelChip } from "@/lib/imaging/imageChannelOverview";
import { canFitContrast, fitContrast, useFitting } from "./colorTools";
import type { ChannelState } from "./kit";
import styles from "./Split.module.css";
import { cx, dragSource } from "./units";

export type Shared = {
  state: ChannelState;
  onWarm: (sourceId: string) => void;
  /** The group whose "+" has turned the image tiles into its add list. */
  adding: string | null;
  setAdding: (groupId: string | null) => void;
};

/** A section header: chevron and label fold the section to this one line. */
export function SectionHead(props: {
  label: string;
  folded: boolean;
  count: number;
  onToggle: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx(styles.head, props.className)}>
      <h2 className={channelChipStyles.label}>
        <button
          type="button"
          className={cx(minervaTheme.focusRing, styles.bare, styles.fold)}
          aria-expanded={!props.folded}
          onClick={props.onToggle}
        >
          <ChevronIcon direction={props.folded ? "right" : "down"} />
          {props.label}
          {props.folded ? (
            <span className={styles.count}>{props.count}</span>
          ) : null}
        </button>
      </h2>
      {props.children}
    </div>
  );
}

/**
 * One channel chip, as group lines and image tiles draw it: draggable onto
 * any group (from `fromGroupId`, if in one). With `onRename`, a pencil shows
 * at its end on hover or focus (F2 too) and opens a rename box laid over its
 * line, wider than the chip. (A double-click's two clicks toggle it there and back.)
 */
export function UnitChip(props: {
  id: string;
  fromGroupId?: string;
  className?: string;
  name: string;
  hex: string;
  tone: ChannelChipTone;
  pressed: boolean;
  ariaLabel: string;
  title: string;
  blocked: boolean;
  onClick: () => void;
  /** The new name, from a rename in place. */
  onRename?: (name: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Enter or Escape gives focus back to the chip; a click elsewhere keeps it there.
  const refocus = useRef(false);
  useEffect(() => {
    if (renaming || !refocus.current) return;
    refocus.current = false;
    ref.current
      ?.querySelector<HTMLButtonElement>("button[aria-pressed]")
      ?.focus();
  }, [renaming]);
  const rename = props.onRename;
  // The box: up to 12rem from the chip's left, kept inside its line.
  const [box, setBox] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!renaming || !el) return setBox(null);
    const scope = el.closest(
      `.${styles.chLines}, .${styles.line}, .${styles.imageBody}`,
    );
    const chip = el.getBoundingClientRect();
    const line = scope?.getBoundingClientRect() ?? chip;
    const width = Math.max(chip.width, Math.min(192, line.width));
    setBox({ width, left: Math.min(0, line.right - chip.left - width) });
  }, [renaming]);
  return (
    <div
      ref={ref}
      {...dragSource(props.id, props.fromGroupId)}
      draggable={!renaming}
      className={cx(props.className, rename && styles.renameHost)}
    >
      <ChannelChip
        name={props.name}
        hex={props.hex}
        tone={props.tone}
        pressed={props.pressed}
        ariaLabel={props.ariaLabel}
        title={props.title}
        blocked={props.blocked}
        onClick={props.onClick}
        onKeyDown={(e) => {
          if (e.key === "F2" && rename && !renaming) {
            e.preventDefault();
            setRenaming(true);
          }
        }}
        trailing={
          rename && !renaming ? (
            <button
              type="button"
              className={cx(
                minervaTheme.focusRing,
                channelChipStyles.trailing,
                styles.pencil,
              )}
              title={`Rename ${props.name}`}
              aria-label={`Rename ${props.name}`}
              onClick={() => setRenaming(true)}
            >
              <PencilIcon aria-hidden />
            </button>
          ) : null
        }
      />
      {renaming && rename ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: opened by the pencil or F2.
          autoFocus
          className={styles.chipRename}
          style={box ?? undefined}
          defaultValue={props.name}
          aria-label={`Rename ${props.name}`}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            const next = e.currentTarget.value.trim();
            setRenaming(false);
            if (next && next !== props.name) rename(next);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              // Ours, not the tab's (which would end adding).
              e.preventDefault();
              e.currentTarget.value = props.name;
            }
            if (e.key === "Enter" || e.key === "Escape") {
              // Or the Enter would also press the chip it refocuses.
              e.preventDefault();
              refocus.current = true;
              e.currentTarget.blur();
            }
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * A chip's one-line channel editor (name or `label`, contrast, color, then
 * `actions`).
 */
export function InlineEditor(props: {
  chip: ImageChannelChip;
  className: string;
  actions?: ReactNode;
  /** In place of the editable name (e.g. the channel's chip). */
  label?: ReactNode;
  /** No taller than a chip. */
  compact?: boolean;
}) {
  return (
    <div className={props.className}>
      <ChannelEditor
        key={props.chip.key}
        chip={props.chip}
        look={props.compact ? "compact" : "inline"}
        actions={props.actions}
        label={props.label}
      />
    </div>
  );
}

/**
 * The editor's end: Fit contrast (when contrast is editable here) for the
 * style `chip` edits, and, for a group's intensity row, its color lock
 * (Optimize colors leaves locked rows alone).
 */
export function EditorActions(props: {
  chip: ImageChannelChip;
  state: ChannelState;
  lock?: { locked: boolean; onToggle: () => void };
}) {
  const { chip } = props;
  const nav = useAuthorChannelNav();
  const busy = useFitting(chip.sourceId);
  const fit =
    nav?.contrastEditable !== false &&
    canFitContrast(chip.sourceId, props.state.sourceChannels);
  return (
    <>
      {fit ? (
        <button
          type="button"
          className={cx(minervaTheme.focusRing, styles.bare, styles.textAction)}
          title="Fit contrast to this channel's histogram"
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={() => void fitContrast(chip.sourceId, chip.groupRowId)}
        >
          {busy ? "Fitting…" : "Fit"}
        </button>
      ) : null}
      {props.lock ? (
        <button
          type="button"
          className={cx(minervaTheme.focusRing, styles.bare, styles.lock)}
          title={
            props.lock.locked
              ? "Color locked: Optimize colors keeps it"
              : "Lock color: Optimize colors keeps it"
          }
          aria-label={props.lock.locked ? "Unlock color" : "Lock color"}
          aria-pressed={props.lock.locked}
          onClick={props.lock.onToggle}
        >
          {props.lock.locked ? (
            <LockIcon aria-hidden />
          ) : (
            <LockOpenIcon aria-hidden />
          )}
        </button>
      ) : null}
    </>
  );
}

export function without(set: ReadonlySet<string>, id: string) {
  const next = new Set(set);
  next.delete(id);
  return next;
}

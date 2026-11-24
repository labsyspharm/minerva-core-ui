import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChannelChipTone } from "@/components/shared/channel/ChannelChip";
import { ChannelVisibilitySwatch } from "@/components/shared/channel/ChannelVisibilitySwatch";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import { PlusIcon } from "@/components/shared/common/PlusIcon";
import { TrashIcon } from "@/components/shared/common/TrashIcon";
import MoreIcon from "@/components/shared/icons/more.svg?react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import { PanelIconButton } from "@/components/shared/panel/PanelButtons";
import panel from "@/components/shared/panel/panelShared.module.css";
import { useClickOutside } from "@/components/shared/useClickOutside";
import { isGroupEligibleForPsudoOptimize } from "@/lib/imaging/psudoPalette";
import type { ChannelGroup } from "@/lib/stores/documentStore";
import { anchoredMenuPosition } from "@/lib/viewer/anchoredMenuPosition";
import { ClampedChips } from "./ClampedChips";
import {
  lockedRows,
  optimizeGroupColors,
  toggleLock,
  useColorTools,
} from "./colorTools";
import {
  canShowChannel,
  canShowGroup,
  channelActions,
  displayHex,
  editorChip,
  findChannel,
  isChannelPainted,
  isGroupShown,
  isImageChannel,
  isRowVisible,
  RGB_UNIT_CHIP_HEX,
} from "./kit";
import {
  EditorActions,
  InlineEditor,
  SectionHead,
  type Shared,
  UnitChip,
} from "./parts";
import styles from "./Split.module.css";
import { cx, groupMembers, type Member, useGroupDrop } from "./units";

/** Filled when drawn, outlined when not; no color yet reads as such. */
const toneOf = (hex: string, drawn: boolean): ChannelChipTone =>
  !hex ? "unassigned" : drawn ? "on" : "outlined";

type Board = Shared & {
  renaming: string | null;
  setRenaming: (groupId: string | null) => void;
};

/**
 * The Channel groups section. Its header folds the whole list to that one
 * line; each group is a line of its channel chips ("+N" past the fit). The
 * selected group is the open one: a line per channel, its chip beside its
 * histogram and color. Expanding a group (its chevron or "+N") selects it,
 * as clicking its name does; collapsing it deselects it. Its "+" turns the
 * image tiles into its add list (`adding`, owned by the tab). Each line's
 * eye shows or hides all of that group, leaving the others (and the
 * selection) alone.
 */
export function Groups(
  props: Shared & { folded: boolean; onFold: (folded: boolean) => void },
) {
  const { state, folded, onFold } = props;
  const [renaming, setRenaming] = useState<string | null>(null);
  const board = { ...props, renaming, setRenaming };
  return (
    <section className={styles.groups} aria-label="Channel groups">
      <SectionHead
        label="Channel groups"
        folded={folded}
        count={state.groups.length}
        onToggle={() => onFold(!folded)}
      >
        <PanelIconButton
          variant="row"
          title="New group from view"
          aria-label="New group"
          onClick={() => {
            onFold(false);
            setRenaming(channelActions.createGroupFromView());
          }}
        >
          <PlusIcon />
        </PanelIconButton>
      </SectionHead>
      {folded ? null : (
        <ul className={cx(styles.list, panel.thinScrollbar)}>
          {state.groups.map((group) => (
            <Group key={group.id} {...board} group={group} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Group(props: Board & { group: ChannelGroup }) {
  const { group, state } = props;
  // Open is selected: expanding selects it, collapsing deselects it.
  const open = state.activeGroupId === group.id;
  const expand = () => channelActions.showGroup(group.id);
  const collapse = () => channelActions.clearGroup(group.id);
  const { over, dropProps } = useGroupDrop(group.id);
  const ref = useRef<HTMLLIElement>(null);
  // A click on the selected name deselects it, unless it was the first half
  // of a double-click (rename).
  const deselect = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (deselect.current) clearTimeout(deselect.current);
    },
    [],
  );
  const tools = useColorTools();
  const optimizing = tools.optimizing.has(group.id);
  const optimizable = isGroupEligibleForPsudoOptimize(
    group,
    state.sourceChannels,
  );
  const locked = lockedRows(group);
  const shown = isGroupShown(state, group);
  const adding = props.adding === group.id;
  const members = groupMembers(state, group);
  const byImage = state.images.flatMap((im) => {
    const ms = members.filter((m) => m.imageId === im.id);
    return ms.length ? [{ id: im.id, ms }] : [];
  });

  // A group shown from elsewhere (a waypoint) scrolls into view.
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const chip = (m: Member) => {
    const visible = isRowVisible(state, m.row.id);
    const hex = m.rgb ? RGB_UNIT_CHIP_HEX : displayHex(state, m.id, m.row);
    return (
      <UnitChip
        key={m.key}
        id={m.id}
        fromGroupId={group.id}
        name={m.name}
        hex={hex}
        tone={toneOf(hex, visible && isChannelPainted(state, m.id))}
        pressed={visible}
        ariaLabel={`${visible ? "Hide" : "Show"} ${m.name}`}
        title={`${m.name} · ${state.imageLabels.get(m.imageId) ?? ""}`}
        blocked={!visible && !canShowChannel(state, m.id)}
        onClick={() => {
          if (channelActions.toggleRowShown(group.id, m.id) && !m.rgb) {
            props.onWarm(m.id);
          }
        }}
        onRename={
          m.rgb ? undefined : (name) => channelActions.renameChannel(m.id, name)
        }
      />
    );
  };

  // Opened: one line per channel, its chip beside its histogram and color.
  const channelLine = (m: Member) => {
    const editing = m.rgb ? null : editorChip(state, m.id, group.id);
    if (!editing) {
      return (
        <div key={m.key} className={styles.chLine}>
          <div className={styles.chLabel}>{chip(m)}</div>
        </div>
      );
    }
    const rowId = editing.groupRowId;
    // Optimize colors recolors intensity rows only, so masks get no lock.
    const sc = findChannel(state, m.id);
    const lockable = Boolean(rowId && sc && isImageChannel(sc));
    return (
      <InlineEditor
        key={m.key}
        chip={editing}
        className={styles.chLine}
        label={chip(m)}
        actions={
          <EditorActions
            chip={editing}
            state={state}
            lock={
              rowId && lockable
                ? {
                    locked: locked.has(rowId),
                    onToggle: () => toggleLock(group.id, rowId),
                  }
                : undefined
            }
          />
        }
      />
    );
  };

  return (
    <li
      ref={ref}
      className={cx(styles.group, open && styles.active, over && styles.over)}
      {...dropProps}
    >
      <button
        type="button"
        className={cx(minervaTheme.focusRing, styles.bare, styles.disclose)}
        title={
          open
            ? "Collapse (deselects it)"
            : "Expand: select it, every channel with its histogram"
        }
        aria-label={`${open ? "Collapse" : "Expand"} ${group.name}`}
        aria-expanded={open}
        onClick={open ? collapse : expand}
      >
        <ChevronIcon direction={open ? "down" : "right"} />
      </button>
      {props.renaming === group.id ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: opened by an explicit rename or create.
          autoFocus
          className={styles.rename}
          defaultValue={group.name}
          aria-label="Group name"
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            channelActions.renameGroup(group.id, e.currentTarget.value);
            props.setRenaming(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") e.currentTarget.value = group.name;
            if (e.key === "Enter" || e.key === "Escape") {
              e.currentTarget.blur();
            }
          }}
        />
      ) : (
        <button
          type="button"
          className={cx(minervaTheme.focusRing, styles.bare, styles.name)}
          title={
            open
              ? "Click to deselect · double-click or F2 to rename"
              : `Show ${group.name}`
          }
          onClick={(e) => {
            if (!open) {
              channelActions.showGroup(group.id);
              return;
            }
            if (e.detail > 1) return;
            deselect.current = setTimeout(() => {
              deselect.current = null;
              channelActions.clearGroup(group.id);
            }, 250);
          }}
          onDoubleClick={() => {
            if (deselect.current) clearTimeout(deselect.current);
            deselect.current = null;
            props.setRenaming(group.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "F2") {
              e.preventDefault();
              props.setRenaming(group.id);
            }
          }}
        >
          {group.name}
        </button>
      )}
      {open ? (
        <div className={styles.openTools}>
          <button
            type="button"
            className={cx(minervaTheme.focusRing, styles.bare, styles.add)}
            title={
              adding
                ? "Done adding channels"
                : "Add channels: pick them in the image lists below"
            }
            aria-label={`Add channels to ${group.name}`}
            aria-pressed={adding}
            onClick={() => props.setAdding(adding ? null : group.id)}
          >
            <PlusIcon size={12} />
          </button>
        </div>
      ) : (
        <ClampedChips
          rows={1}
          className={styles.line}
          open={false}
          onOpen={expand}
          sig={members.map((m) => m.key).join()}
        >
          {byImage.flatMap(({ id, ms }, i) => [
            // Several images: a rule parts them (a chip's tooltip names its
            // image; opened, each image's channels sit under its name).
            i > 0 ? (
              <div
                key={`sep:${id}`}
                data-sep=""
                className={styles.sepRule}
                title={state.imageLabels.get(id)}
                aria-hidden
              />
            ) : null,
            ...ms.map(chip),
          ])}
        </ClampedChips>
      )}
      <div className={styles.acts}>
        <ChannelVisibilitySwatch
          visible={shown}
          title={
            shown ? `Hide all of ${group.name}` : `Show all of ${group.name}`
          }
          ariaLabel={`${shown ? "Hide" : "Show"} all of ${group.name}`}
          blocked={!canShowGroup(state, group)}
          disabled={group.channels.length === 0}
          onClick={() => channelActions.setGroupShown(group.id, !shown)}
        />
        <GroupMenu
          name={group.name}
          optimizable={optimizable}
          optimizing={optimizing}
          onOptimize={() => void optimizeGroupColors(group.id)}
          onRename={() => props.setRenaming(group.id)}
        />
        <PanelIconButton
          variant="row"
          className={styles.idle}
          title="Delete group"
          aria-label={`Delete ${group.name}`}
          onClick={() => channelActions.deleteGroup(group.id)}
        >
          <TrashIcon size={14} />
        </PanelIconButton>
      </div>
      {open ? (
        <div className={styles.chLines}>
          {members.length === 0 ? (
            <div className={styles.chEmpty}>
              No channels yet: press + and pick them below, or drag them here
            </div>
          ) : null}
          {byImage.flatMap(({ id, ms }) => [
            byImage.length > 1 ? (
              <div key={`sep:${id}`} className={styles.chImage}>
                {state.imageLabels.get(id)}
              </div>
            ) : null,
            ...ms.map(channelLine),
          ])}
        </div>
      ) : null}
    </li>
  );
}

/**
 * A group line's "⋯" menu: Optimize colors (keeps locked rows) and Rename.
 * It opens under the button, or above it when the panel has no room below,
 * and closes on a pick, Escape, a click elsewhere or a scroll.
 */
function GroupMenu(props: {
  name: string;
  optimizable: boolean;
  optimizing: boolean;
  onOptimize: () => void;
  onRename: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = (refocus = false) => {
    setOpen(false);
    setAt(null);
    if (refocus) buttonRef.current?.querySelector("button")?.focus();
  };
  useClickOutside(open, () => close(), [buttonRef, menuRef]);
  // Measured before paint: under the button, right edges lined up, or above
  // it near the window's bottom.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    setAt(
      anchoredMenuPosition(
        buttonRef.current.getBoundingClientRect(),
        menuRef.current.getBoundingClientRect(),
        { align: "end" },
      ),
    );
  }, [open]);
  // Focus its first item once placed (it is hidden until then).
  const placed = at !== null;
  useEffect(() => {
    if (placed) {
      menuRef.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus();
    }
  }, [placed]);
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && menu?.contains(e.target)) return;
      setOpen(false);
      setAt(null);
    };
    addEventListener("scroll", onScroll, true);
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll, true);
      removeEventListener("resize", onScroll);
    };
  }, [open]);
  const pick = (run: () => void) => () => {
    close();
    run();
  };
  return (
    <>
      <span ref={buttonRef} className={styles.moreWrap}>
        <PanelIconButton
          variant="row"
          className={cx(styles.idle, open && styles.held)}
          title="More"
          aria-label={`More for ${props.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <MoreIcon aria-hidden />
        </PanelIconButton>
      </span>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={`${props.name} actions`}
              className={cx(minervaTheme.menuFixed, styles.groupMenu)}
              style={
                at
                  ? { top: at.top, left: at.left }
                  : { top: 0, left: 0, visibility: "hidden" }
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  close(true);
                } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const items = [
                    ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
                      "button:not(:disabled)",
                    ) ?? []),
                  ];
                  const i = items.indexOf(document.activeElement as never);
                  const step = e.key === "ArrowDown" ? 1 : -1;
                  items[(i + step + items.length) % items.length]?.focus();
                }
              }}
            >
              <button
                type="button"
                role="menuitem"
                className={minervaTheme.menuItem}
                disabled={!props.optimizable || props.optimizing}
                title={
                  props.optimizable
                    ? "Recolor the channels to tell them apart; locked colors stay"
                    : "Needs at least two image channels"
                }
                onClick={pick(props.onOptimize)}
              >
                {props.optimizing ? "Optimizing colors…" : "Optimize colors"}
              </button>
              <button
                type="button"
                role="menuitem"
                className={minervaTheme.menuItem}
                onClick={pick(props.onRename)}
              >
                Rename
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

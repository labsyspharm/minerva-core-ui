import { type ReactNode, useEffect, useRef, useState } from "react";
import { useAuthorChannelNav } from "@/components/shared/channel/AuthorChannelNav";
import type { ChannelChipTone } from "@/components/shared/channel/ChannelChip";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import type { UploadSlots } from "@/components/shared/Upload";
import { channelNameMatchesQuery } from "@/lib/imaging/imageChannelOverview";
import { clampImageOpacity } from "@/lib/imaging/imageOpacity";
import type { ChannelGroup, Image } from "@/lib/stores/documentStore";
import { ChannelSearch } from "./ChannelSearch";
import { ClampedChips } from "./ClampedChips";
import { Groups } from "./Groups";
import { ImageEye } from "./ImageEye";
import {
  type ChannelState,
  canShowChannel,
  channelActions,
  displayHex,
  editorChip,
  isChannelPainted,
  isDrawnOwnStyle,
  isRowVisible,
  isShownViaRow,
  RGB_UNIT_CHIP_HEX,
  rowInGroup,
  shownHex,
  useChannelState,
} from "./kit";
import {
  EditorActions,
  InlineEditor,
  SectionHead,
  type Shared,
  UnitChip,
} from "./parts";
import styles from "./Split.module.css";
import {
  cx,
  groupsUsing,
  imageUnits,
  type Unit,
  useRemoveOnDropOutside,
} from "./units";

/** Drawn: some channel of the image is on screen, at an opacity above 0. */
function isImageDrawn(state: ChannelState, units: Unit[], image: Image) {
  return (
    clampImageOpacity(image.opacity) > 0 &&
    units.some((u) => isChannelPainted(state, u.id))
  );
}

/**
 * The author Images tab: channel groups fill the top half of the panel and
 * images the bottom half, each scrolling on its own; either header folds its
 * half away and the other takes the room. A group line shows its channels by
 * name on one row, an image its channels as tiles on two ("+N" shows all).
 * Each image's eye is crossed when none of its channels are on screen and
 * opens its opacity. A group's "+" turns the image tiles into its add list
 * (`adding`): a click adds or removes a channel, until Done or Escape.
 */
export function ImagesTab(props: {
  renderUpload: (slots: UploadSlots) => ReactNode;
}) {
  const state = useChannelState();
  const [groupsFolded, setGroupsFolded] = useState(false);
  const [imagesFolded, setImagesFolded] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  // Each image's channel search.
  const [queries, setQueries] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const setQuery = (imageId: string, q: string) =>
    setQueries((m) => new Map(m).set(imageId, q));
  const nav = useAuthorChannelNav();
  useRemoveOnDropOutside();
  const onWarm = (id: string) =>
    void nav?.ensureChannelHistograms?.([id]).catch(() => undefined);
  // The group the image tiles add to, while its "+" is on.
  const [adding, setAdding] = useState<string | null>(null);
  const addingGroup = adding
    ? state.groups.find((g) => g.id === adding)
    : undefined;
  // Selecting another group, or deleting this one, ends adding.
  const [seenActive, setSeenActive] = useState(state.activeGroupId);
  if (seenActive !== state.activeGroupId) {
    setSeenActive(state.activeGroupId);
    if (adding) setAdding(null);
  }
  if (adding && !addingGroup) setAdding(null);
  const firstSearch = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!adding) return;
    setImagesFolded(false);
    firstSearch.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // The search box's own Escape (clearing it) comes first.
      if (e.key === "Escape" && !e.defaultPrevented) setAdding(null);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [adding]);
  const shared: Shared = { state, onWarm, adding, setAdding };
  const hasGroups = state.images.length > 0 || state.groups.length > 0;
  const label = (image: Image) => state.imageLabels.get(image.id) ?? "Image";
  const units = new Map(
    state.images.map((im) => [im.id, imageUnits(state, im.id)]),
  );
  const unitsOf = (image: Image) => units.get(image.id) ?? [];
  return props.renderUpload({
    split: { dock: !groupsFolded, body: !imagesFolded },
    dockAfter: hasGroups ? (
      <Groups {...shared} folded={groupsFolded} onFold={setGroupsFolded} />
    ) : null,
    bodyBefore:
      state.images.length > 0 ? (
        <>
          <SectionHead
            className={styles.imagesHead}
            label="Images"
            folded={imagesFolded}
            count={state.images.length}
            onToggle={() => setImagesFolded(!imagesFolded)}
          />
          {addingGroup ? (
            <output className={styles.addingBar}>
              <span>
                Adding to <b>{addingGroup.name}</b>: click channels to add or
                remove
              </span>
              <button
                type="button"
                className={cx(minervaTheme.focusRing, styles.bare, styles.done)}
                onClick={() => setAdding(null)}
              >
                Done
              </button>
            </output>
          ) : null}
        </>
      ) : null,
    renderImageHeaderExtra: (image) => (
      <>
        {unitsOf(image).length > 1 ? (
          <span className={styles.imageSearchCell}>
            <ChannelSearch
              inputRef={
                image.id === state.images[0]?.id ? firstSearch : undefined
              }
              label={`Search ${label(image)} channels`}
              value={queries.get(image.id) ?? ""}
              onChange={(v) => setQuery(image.id, v)}
              onEscapeEmpty={() => setAdding(null)}
            />
          </span>
        ) : null}
        <span className={styles.imageEyeCell}>
          <ImageEye
            image={image}
            label={label(image)}
            visible={isImageDrawn(state, unitsOf(image), image)}
          />
        </span>
      </>
    ),
    renderImageBody: (image) => (
      <ImageChips
        {...shared}
        addTo={addingGroup}
        units={unitsOf(image)}
        open={open.has(image.id)}
        onOpen={() => setOpen(new Set([...open, image.id]))}
        onClose={() => {
          const next = new Set(open);
          next.delete(image.id);
          setOpen(next);
        }}
        query={queries.get(image.id) ?? ""}
      />
    ),
  });
}

type Look = ReturnType<typeof imageLooks>[number];

/**
 * How an image's channels look. A channel shows its color only while it is
 * on: pale when a group shows it (that group's line has it at full
 * strength), full when shown here in its own style. Off, it is plain (dashed
 * when in no group, while a group is selected). A click hides it however it
 * is shown, or shows it in its own style (a line under the image), even a
 * member of the selected group (see `channelActions.setChannelShown`). A
 * click never adds a channel to a group: drag it onto the group's line, or
 * use the line's "+".
 */
function imageLooks(state: ChannelState, units: Unit[]) {
  const target = state.activeGroup;
  return units.map((u) => {
    const row = rowInGroup(target, u.id);
    const groups = groupsUsing(state, u).map((g) => g.name);
    // A visible row wins over its own style, as in the viewer.
    const viaRow = isShownViaRow(state, u.id);
    const on = viaRow || isDrawnOwnStyle(state, u.id);
    const hex = u.rgb
      ? RGB_UNIT_CHIP_HEX
      : !viaRow
        ? displayHex(state, u.id)
        : row && isRowVisible(state, row.id)
          ? displayHex(state, u.id, row)
          : shownHex(state, u.id);
    const tone: ChannelChipTone = !on
      ? "neutral"
      : !isChannelPainted(state, u.id)
        ? "outlined"
        : !hex
          ? "unassigned"
          : viaRow
            ? "faded"
            : "on";
    return {
      ...u,
      groups,
      hex: on ? hex : "",
      tone,
      unused: Boolean(target) && !row && groups.length === 0,
      pressed: on,
      label: `${on ? "Hide" : "Show"} ${u.name}`,
      blocked: !on && !canShowChannel(state, u.id),
    };
  });
}

/**
 * The same tiles as a group's add list: a member of `group` is filled in its
 * color there, any other channel plain (dashed when in no group); a click
 * adds or removes it.
 */
function addLooks(state: ChannelState, units: Unit[], group: ChannelGroup) {
  return units.map((u) => {
    const row = rowInGroup(group, u.id);
    const groups = groupsUsing(state, u).map((g) => g.name);
    const hex = !row
      ? ""
      : u.rgb
        ? RGB_UNIT_CHIP_HEX
        : displayHex(state, u.id, row);
    const tone: ChannelChipTone = !row ? "neutral" : hex ? "on" : "unassigned";
    return {
      ...u,
      groups,
      hex,
      tone,
      unused: groups.length === 0,
      pressed: Boolean(row),
      label: row
        ? `Remove ${u.name} from ${group.name}`
        : `Add ${u.name} to ${group.name}`,
      blocked: false,
    };
  });
}

/** True when the click showed the channel in its own style (a line below). */
function clickUnit(
  { onWarm }: Shared,
  u: Look,
  addTo: ChannelGroup | undefined,
): boolean {
  if (addTo) {
    channelActions.toggleMembership(addTo.id, u.id);
    return false;
  }
  // Off however it is shown; on in its own style, even a group member.
  const shown = channelActions.toggleChannelShown(u.id);
  if (shown && !u.rgb) onWarm(u.id);
  return shown;
}

/**
 * An image's channels in document order: tiles under its name, two rows
 * until opened ("+N"), or one chip on the name line for a one-channel image.
 * Drag one onto any group line to add it. As a group's add list (`addTo`)
 * all of them show and a click adds or removes one. Under the tiles, a line
 * per channel drawn in its own style (on, but not through a group): its chip
 * beside its histogram and color, as a group's lines are. One a click turns
 * on scrolls into view.
 */
function ImageChips(
  props: Shared & {
    units: Unit[];
    open: boolean;
    onOpen: () => void;
    onClose: () => void;
    /** Only channels whose names match; all of them show. */
    query: string;
    /** A group whose add list these tiles are (see `addLooks`). */
    addTo?: ChannelGroup;
  },
) {
  const { state, addTo } = props;
  const inline = props.units.length === 1;
  const q = props.query.trim();
  const matching = props.units.filter((u) =>
    channelNameMatchesQuery(u.name, q),
  );
  const looks = addTo
    ? addLooks(state, matching, addTo)
    : imageLooks(state, matching);
  const own = imageLooks(
    state,
    props.units.filter((u) => !u.rgb && isDrawnOwnStyle(state, u.id)),
  );
  // The channel a click just turned on: its new line scrolls into view.
  const [shownNow, setShownNow] = useState<string | null>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shownNow) return;
    const i = own.findIndex((u) => u.id === shownNow);
    if (i >= 0) {
      linesRef.current?.children[i]?.scrollIntoView({ block: "nearest" });
    }
    setShownNow(null);
  });
  const chip = (u: Look, className?: string) => (
    <UnitChip
      key={u.key}
      id={u.id}
      className={className}
      name={u.name}
      hex={u.hex}
      tone={u.tone}
      pressed={u.pressed}
      ariaLabel={u.label}
      title={[u.name, ...u.groups].join(" · ")}
      blocked={u.blocked}
      onClick={() => {
        if (clickUnit(props, u, addTo)) setShownNow(u.id);
      }}
      onRename={
        u.rgb || addTo
          ? undefined
          : (name) => channelActions.renameChannel(u.id, name)
      }
    />
  );
  return (
    <>
      <ClampedChips
        rows={inline ? 1 : 2}
        open={props.open || Boolean(q) || Boolean(addTo)}
        onOpen={props.onOpen}
        onClose={q || addTo ? undefined : props.onClose}
        sig={looks.map((u) => u.key).join()}
        className={cx(
          styles.imageBody,
          inline ? styles.imageBodyInline : styles.tiles,
        )}
      >
        {q && looks.length === 0 ? (
          <div data-aux="" className={styles.noMatch}>
            No match
          </div>
        ) : null}
        {looks.map((u) => chip(u, cx(u.unused && styles.unused)))}
      </ClampedChips>
      {own.length > 0 ? (
        <div ref={linesRef} className={cx(styles.chLines, styles.imageLines)}>
          {own.map((u) => {
            const editing = editorChip(state, u.id);
            return editing ? (
              <InlineEditor
                key={u.key}
                chip={editing}
                className={styles.chLine}
                label={chip(u)}
                actions={<EditorActions chip={editing} state={state} />}
              />
            ) : null;
          })}
        </div>
      ) : null}
    </>
  );
}

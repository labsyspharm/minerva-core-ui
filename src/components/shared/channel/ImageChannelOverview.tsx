import type { CSSProperties } from "react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useAuthorChannelNav } from "@/components/shared/channel/AuthorChannelNav";
import { ChannelEditor } from "@/components/shared/channel/ChannelEditorPopover";
import {
  ChannelVisibilitySwatch,
  CursorHint,
} from "@/components/shared/channel/ChannelVisibilitySwatch";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import {
  applyGroupRowVisibilities,
  applyStackVisibilities,
  isGroupRowVisible,
  isRgbDisplayFullyGrouped,
  isStackVisible,
  type VivIntensityCapVis,
  visibilitiesForRgbUnit,
  visibilityKindForMap,
  vivIntensityCapExceeded,
  vivIntensityLayerCount,
  vivShownIntensitySourceIds,
  withGroupRowVisible,
} from "@/lib/imaging/channelCompositor";
import {
  isMaskChannel,
  isRgbDisplayImage,
  MAX_VIV_INTENSITY_CHANNELS,
  VIEWER_INTENSITY_LIMIT_HINT,
} from "@/lib/imaging/channelKind";
import { getGmmPendingIds, subscribeGmmFit } from "@/lib/imaging/gmmScheduler";
import {
  buildImageChannelOverview,
  channelNameMatchesQuery,
  type ImageChannelChip,
} from "@/lib/imaging/imageChannelOverview";
import {
  assignUngroupedStackSeedColor,
  getStackPalettePendingIds,
  optimizeUngroupedStackChannel,
  subscribeStackPalettePending,
} from "@/lib/imaging/psudoPalette";
import { useAppStore } from "@/lib/stores/appStore";
import type { Image } from "@/lib/stores/documentSchema";
import {
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import styles from "./ImageChannelOverview.module.css";

/** Packed-RGB / H&E unit chip — same magenta as `samples === 3` default tint. */
const HE_CHIP_HEX = "cc00ff";

function heUnitChip(
  base: ImageChannelChip,
  key: string,
  visible: boolean,
): ImageChannelChip {
  return { ...base, key, name: "H&E", hex: HE_CHIP_HEX, visible };
}

function chipAriaLabel(chip: ImageChannelChip): string {
  return chip.visible ? `Hide ${chip.name}` : `Show ${chip.name}`;
}

function ChipButton(props: {
  chip: ImageChannelChip;
  open: boolean;
  dim: boolean;
  colorPending: boolean;
  gmmPending: boolean;
  shown: boolean;
  showBlocked: boolean;
  onClick: (chip: ImageChannelChip) => void;
  onOpenEditor: (chip: ImageChannelChip) => void;
}) {
  const {
    chip,
    open,
    dim,
    colorPending,
    gmmPending,
    shown,
    showBlocked,
    onClick,
    onOpenEditor,
  } = props;
  const pending = colorPending || gmmPending;
  const pendingLabel = gmmPending
    ? `Fitting contrast for ${chip.name}`
    : `Assigning color to ${chip.name}`;
  const showEditor = !chip.key.endsWith(":rgb");
  return (
    <div
      className={[
        styles.chipCell,
        chip.visible && chip.hex && shown ? styles.chipOn : null,
        chip.hex && (!chip.visible || !shown) ? styles.chipOutlined : null,
        chip.hex ? null : styles.chipUnassigned,
        pending ? minervaTheme.busyOverlay : null,
        dim ? styles.chipDim : null,
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        chip.hex ? ({ "--ch": `#${chip.hex}` } as CSSProperties) : undefined
      }
      aria-busy={pending || undefined}
    >
      <CursorHint
        enabled={showBlocked}
        label={VIEWER_INTENSITY_LIMIT_HINT}
        className={styles.chipHint}
      >
        <button
          type="button"
          className={`${minervaTheme.focusRing} ${styles.chip}`}
          title={pending ? pendingLabel : undefined}
          aria-label={
            pending
              ? pendingLabel
              : showBlocked
                ? VIEWER_INTENSITY_LIMIT_HINT
                : chipAriaLabel(chip)
          }
          aria-pressed={chip.visible}
          aria-disabled={showBlocked || undefined}
          onClick={() => {
            if (showBlocked) return;
            onClick(chip);
          }}
        >
          {chip.name}
        </button>
      </CursorHint>
      {showEditor ? (
        <button
          type="button"
          className={`${minervaTheme.focusRing} ${styles.chipMenu}`}
          title={`Edit ${chip.name}`}
          aria-label={`Edit ${chip.name}`}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            onOpenEditor(chip);
          }}
        >
          <ChevronIcon direction={open ? "up" : "down"} />
        </button>
      ) : null}
    </div>
  );
}

/** Keep in sync with `repeat(5, …)` on `.chipWrap`. */
const CHIP_COLS = 5;

function ChipGrid(props: {
  chips: ImageChannelChip[];
  openChip: ImageChannelChip | null;
  shownIds: ReadonlySet<string>;
  blockedIds: ReadonlySet<string>;
  onChip: (chip: ImageChannelChip) => void;
  onOpenEditor: (chip: ImageChannelChip) => void;
  onDismissEditor: () => void;
}) {
  const { chips, openChip, shownIds, blockedIds, onDismissEditor } = props;
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingIds = useSyncExternalStore(
    subscribeStackPalettePending,
    getStackPalettePendingIds,
    getStackPalettePendingIds,
  );
  const gmmPendingIds = useSyncExternalStore(
    subscribeGmmFit,
    getGmmPendingIds,
    getGmmPendingIds,
  );
  const openIndex = openChip
    ? chips.findIndex((c) => c.key === openChip.key)
    : -1;
  const rowEnd =
    openIndex < 0
      ? -1
      : Math.min(
          chips.length - 1,
          openIndex - (openIndex % CHIP_COLS) + CHIP_COLS - 1,
        );
  useEffect(() => {
    if (openIndex < 0) return;
    const onDoc = (e: MouseEvent) => {
      const root = editorRef.current;
      if (!root) return;
      const t = e.target;
      if (t instanceof Node && root.contains(t)) return;
      if (t instanceof Element && t.closest("[data-minerva-color-picker]")) {
        return;
      }
      const r = root.getBoundingClientRect();
      if (
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom
      ) {
        return;
      }
      onDismissEditor();
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [openIndex, onDismissEditor]);
  return (
    <div className={styles.chipWrap}>
      {chips.map((chip, i) => (
        <Fragment key={chip.key}>
          <ChipButton
            chip={chip}
            open={openChip?.key === chip.key}
            dim={openChip != null && openChip.key !== chip.key}
            colorPending={pendingIds.includes(chip.sourceId)}
            gmmPending={gmmPendingIds.includes(chip.sourceId)}
            shown={shownIds.has(chip.sourceId)}
            showBlocked={blockedIds.has(chip.sourceId)}
            onClick={props.onChip}
            onOpenEditor={props.onOpenEditor}
          />
          {i === rowEnd && openChip ? (
            <div ref={editorRef} className={styles.editor}>
              <ChannelEditor chip={openChip} />
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

function GroupStrip(props: {
  name: string;
  chips: ImageChannelChip[];
  openChip: ImageChannelChip | null;
  shownIds: ReadonlySet<string>;
  blockedIds: ReadonlySet<string>;
  onChip: (chip: ImageChannelChip) => void;
  onOpenEditor: (chip: ImageChannelChip) => void;
  onDismissEditor: () => void;
  allVisible?: boolean;
  showAllBlocked?: boolean;
  onToggleVisibility?: () => void;
  nameFilter?: string;
  onNameFilterChange?: (value: string) => void;
}) {
  const visLabel = props.allVisible
    ? `Hide every channel in ${props.name}`
    : `Show every channel in ${props.name}`;
  const filtering = props.onNameFilterChange != null;
  return (
    <div className={styles.groupCard}>
      <div className={styles.groupHeader}>
        {props.onToggleVisibility ? (
          <ChannelVisibilitySwatch
            visible={Boolean(props.allVisible)}
            title={visLabel}
            ariaLabel={visLabel}
            blocked={props.showAllBlocked}
            onClick={props.onToggleVisibility}
          />
        ) : null}
        <div className={styles.groupLabel}>{props.name}</div>
        {props.onNameFilterChange ? (
          <input
            className={styles.channelFilter}
            type="text"
            value={props.nameFilter ?? ""}
            placeholder="Search..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Filter channels by name"
            onChange={(e) => props.onNameFilterChange?.(e.target.value)}
          />
        ) : null}
      </div>
      {filtering && props.chips.length === 0 ? (
        <div className={styles.filterEmpty}>No matching channels</div>
      ) : (
        <ChipGrid
          chips={props.chips}
          openChip={props.openChip}
          shownIds={props.shownIds}
          blockedIds={props.blockedIds}
          onChip={props.onChip}
          onOpenEditor={props.onOpenEditor}
          onDismissEditor={props.onDismissEditor}
        />
      )}
    </div>
  );
}

export function ImageChannelOverviewCard(props: { image: Image }) {
  const { image } = props;
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const stackVisibilities = useAppStore((s) => s.channelVisibilities);
  const groupRowVisibilities = useAppStore(
    (s) => s.channelGroupRowVisibilities,
  );
  const setChannelVisibilities = useAppStore((s) => s.setChannelVisibilities);
  const setChannelGroupRowVisibilities = useAppStore(
    (s) => s.setChannelGroupRowVisibilities,
  );
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const nav = useAuthorChannelNav();
  const [openKey, setOpenKey] = useState<string | null | undefined>(undefined);
  const [channelNameFilter, setChannelNameFilter] = useState("");

  const allSourceChannels = useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );
  const filledStackVis = useMemo(
    () =>
      applyStackVisibilities(
        allSourceChannels,
        stackVisibilities,
        visibilityKindForMap(stackVisibilities),
      ),
    [allSourceChannels, stackVisibilities],
  );
  const filledGroupVis = useMemo(
    () =>
      applyGroupRowVisibilities(
        channelGroups,
        groupRowVisibilities,
        visibilityKindForMap(groupRowVisibilities),
      ),
    [channelGroups, groupRowVisibilities],
  );
  const model = useMemo(
    () =>
      buildImageChannelOverview({
        image,
        channelGroups,
        allSourceChannels,
        stackVisibilities: filledStackVis,
        groupRowVisibilities: filledGroupVis,
        activeChannelGroupId,
      }),
    [
      image,
      channelGroups,
      allSourceChannels,
      filledStackVis,
      filledGroupVis,
      activeChannelGroupId,
    ],
  );

  const filteredAllChannels = useMemo(
    () =>
      model.allChannels.filter((chip) =>
        channelNameMatchesQuery(chip.name, channelNameFilter),
      ),
    [model.allChannels, channelNameFilter],
  );
  const rgbDisplay = isRgbDisplayImage(image);
  const rgbChannels = flattenImageChannelsInDocumentOrder([image]);
  const showAllChannelsStrip =
    model.allChannels.length > 0 &&
    !isRgbDisplayFullyGrouped(rgbChannels, channelGroups);

  const overviewChips = [
    ...model.groups.flatMap((g) => g.chips),
    ...model.allChannels,
  ];
  const maskIds = new Set(
    image.channels.filter(isMaskChannel).map((c) => c.id),
  );
  const defaultMaskKey =
    maskIds.size === 0
      ? null
      : (overviewChips.find((c) => maskIds.has(c.sourceId))?.key ?? null);
  const resolvedOpenKey = openKey === undefined ? defaultMaskKey : openKey;

  const openChip =
    resolvedOpenKey == null
      ? null
      : (overviewChips.find((c) => c.key === resolvedOpenKey) ?? null);

  const onOpenEditor = (chip: ImageChannelChip) => {
    setOpenKey((cur) => {
      const current = cur === undefined ? defaultMaskKey : cur;
      return current === chip.key ? null : chip.key;
    });
  };
  const dismissEditor = useCallback(() => setOpenKey(null), []);

  const capVis: VivIntensityCapVis = {
    channels: allSourceChannels,
    activeGroup: channelGroups.find((g) => g.id === activeChannelGroupId),
    channelGroups,
    stackVisibilities: filledStackVis,
    groupRowVisibilities: filledGroupVis,
  };
  const shownIds = vivShownIntensitySourceIds(capVis);
  const atCap =
    vivIntensityLayerCount(image.id, capVis) >= MAX_VIV_INTENSITY_CHANNELS;
  const fits = (
    next: Partial<
      Pick<VivIntensityCapVis, "stackVisibilities" | "groupRowVisibilities">
    >,
  ) => !vivIntensityCapExceeded(image.id, { ...capVis, ...next });

  const applyRgbUnit = (visible: boolean) => {
    const next = visibilitiesForRgbUnit({
      rgbChannels,
      channelGroups,
      groupRowVisibilities: filledGroupVis,
      stackVisibilities: filledStackVis,
      visible,
    });
    if (
      visible &&
      !fits({
        stackVisibilities: next.channelVisibilities,
        groupRowVisibilities: next.channelGroupRowVisibilities,
      })
    ) {
      return;
    }
    setChannelGroupRowVisibilities(next.channelGroupRowVisibilities);
    setChannelVisibilities(next.channelVisibilities);
  };

  const onGroupChip = (chip: ImageChannelChip) => {
    if (!chip.groupRowId) return;
    if (rgbDisplay) {
      applyRgbUnit(!chip.visible);
      return;
    }
    const vis = filledGroupVis;
    if (chip.visible) {
      setChannelGroupRowVisibilities({
        ...vis,
        [chip.groupRowId]: false,
      });
      return;
    }
    const next = withGroupRowVisible(vis, channelGroups, chip.groupRowId, true);
    if (!fits({ groupRowVisibilities: next })) return;
    setChannelGroupRowVisibilities(next);
    void nav?.ensureChannelHistograms?.([chip.sourceId]).catch(() => undefined);
  };

  const onAllChannelsChip = (chip: ImageChannelChip) => {
    if (rgbDisplay) {
      applyRgbUnit(!chip.visible);
      return;
    }
    if (chip.groupRowId) {
      const vis = filledGroupVis;
      const nextOn = !chip.visible;
      const next = nextOn
        ? withGroupRowVisible(vis, channelGroups, chip.groupRowId, true)
        : { ...vis };
      if (!nextOn) {
        for (const g of channelGroups) {
          for (const gc of g.channels) {
            if (gc.channelId === chip.sourceId) next[gc.id] = false;
          }
        }
      }
      if (nextOn && !fits({ groupRowVisibilities: next })) return;
      setChannelGroupRowVisibilities(next);
      if (nextOn) {
        void nav
          ?.ensureChannelHistograms?.([chip.sourceId])
          .catch(() => undefined);
      }
      return;
    }
    const vis = filledStackVis;
    const turningOn = !isStackVisible(vis, chip.sourceId);
    const nextStack = { ...vis, [chip.sourceId]: turningOn };
    if (turningOn && !fits({ stackVisibilities: nextStack })) return;
    if (turningOn && !chip.hex) {
      assignUngroupedStackSeedColor(chip.sourceId);
      void optimizeUngroupedStackChannel(chip.sourceId);
    }
    setChannelVisibilities(nextStack);
    if (!turningOn) return;
    void nav?.ensureChannelHistograms?.([chip.sourceId]).catch(() => undefined);
  };

  const blockedIds = new Set<string>();
  if (atCap) {
    for (const chip of overviewChips) {
      if (!chip.visible && !shownIds.has(chip.sourceId)) {
        blockedIds.add(chip.sourceId);
      }
    }
  }

  if (image.channels.length === 0) return null;

  return (
    <div className={styles.root}>
      {model.groups.map((group) => {
        const rgbUnit =
          rgbDisplay && group.chips[0]
            ? [
                heUnitChip(
                  group.chips[0],
                  `g:${group.id}:rgb`,
                  group.allVisible,
                ),
              ]
            : group.chips;
        const docGroup = channelGroups.find((g) => g.id === group.id);
        const showAllNext = { ...filledGroupVis };
        if (docGroup) {
          for (const gc of docGroup.channels) showAllNext[gc.id] = true;
        }
        const showAllBlocked =
          !group.allVisible &&
          !rgbDisplay &&
          docGroup != null &&
          !fits({ groupRowVisibilities: showAllNext });
        return (
          <GroupStrip
            key={group.id}
            name={group.name}
            chips={rgbUnit}
            openChip={openChip}
            shownIds={shownIds}
            blockedIds={blockedIds}
            allVisible={group.allVisible}
            showAllBlocked={showAllBlocked}
            onChip={onGroupChip}
            onOpenEditor={onOpenEditor}
            onDismissEditor={dismissEditor}
            onToggleVisibility={() => {
              if (rgbDisplay) {
                applyRgbUnit(!group.allVisible);
                return;
              }
              if (!docGroup || docGroup.channels.length === 0) return;
              const allOn = docGroup.channels.every((gc) =>
                isGroupRowVisible(filledGroupVis, gc.id),
              );
              const next = { ...filledGroupVis };
              for (const gc of docGroup.channels) next[gc.id] = !allOn;
              if (!allOn && !fits({ groupRowVisibilities: next })) return;
              setChannelGroupRowVisibilities(next);
            }}
          />
        );
      })}
      {showAllChannelsStrip ? (
        <GroupStrip
          name="All channels"
          chips={
            rgbDisplay && filteredAllChannels[0]
              ? [
                  heUnitChip(
                    filteredAllChannels[0],
                    "e:rgb",
                    filteredAllChannels.every((c) => c.visible),
                  ),
                ]
              : filteredAllChannels
          }
          openChip={openChip}
          shownIds={shownIds}
          blockedIds={blockedIds}
          onChip={onAllChannelsChip}
          onOpenEditor={onOpenEditor}
          onDismissEditor={dismissEditor}
          nameFilter={channelNameFilter}
          onNameFilterChange={setChannelNameFilter}
        />
      ) : null}
    </div>
  );
}

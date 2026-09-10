import * as React from "react";
import { createPortal } from "react-dom";
import { colorPickerAnchorPosition } from "@/components/shared/ColorPickerPopover";
import { useAuthorChannelNav } from "@/components/shared/channel/AuthorChannelNav";
import {
  contrastEditorPropsForGroupRow,
  contrastEditorPropsForSource,
} from "@/components/shared/channel/ChannelContrastEditor";
import {
  ChannelColorPicker,
  type ChannelColorTarget,
  commitChannelColorTarget,
} from "@/components/shared/channel/ChannelEditorPopover";
import { ChannelRow } from "@/components/shared/channel/ChannelRow";
import { ChannelVisibilitySwatch } from "@/components/shared/channel/ChannelVisibilitySwatch";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import { PlusIcon } from "@/components/shared/common/PlusIcon";
import { TrashIcon } from "@/components/shared/common/TrashIcon";
import LockIcon from "@/components/shared/icons/lock.svg?react";
import LockOpenIcon from "@/components/shared/icons/lock-open.svg?react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import { CompactHeader } from "@/components/shared/panel/CompactHeader";
import { PanelIconButton } from "@/components/shared/panel/PanelButtons";
import panel from "@/components/shared/panel/panelShared.module.css";
import type { ContrastLimits } from "@/lib/imaging/autoContrast";
import {
  applyGroupRowVisibilities,
  buildCompositedIntensityLayers,
  defaultVisibilitiesForSources,
  isDisplayedViaGroupRow,
  isGroupRowVisible,
  isStackVisible,
} from "@/lib/imaging/channelCompositor";
import {
  DEFAULT_MASK_VISUALIZATION,
  isImageChannel,
  isMaskChannel,
  isRgbDisplayChannel,
  type MaskVisualization,
  planarRgbDisplayColor,
} from "@/lib/imaging/channelKind";
import { ensureGmm, refitGmm } from "@/lib/imaging/gmmScheduler";
import {
  scheduleBackgroundTask,
  sourceDistributionYValuesLength,
} from "@/lib/imaging/histogramLazy";
import { SELECTION_MASK_CHANNEL_KEY } from "@/lib/imaging/maskLayers";
import {
  applyOptimizedColorsToChannelGroup,
  getStackPalettePendingIds,
  isGroupEligibleForPsudoOptimize,
  optimizeChannelGroupWithLocks,
  seedRgbForGroupChannelIndex,
  setStackPalettePendingMany,
  subscribeStackPalettePending,
} from "@/lib/imaging/psudoPalette";
import {
  assignedDisplayHex,
  effectiveDisplayColor,
  effectiveMaskVisualization,
  effectiveSourceColor,
  effectiveSourceLimits,
  rgbToHex,
} from "@/lib/imaging/sourceChannelStyle";
import { MAX_VIV_INTENSITY_CHANNELS } from "@/lib/imaging/viv";
import { useAppStore } from "@/lib/stores/appStore";
import type {
  Channel,
  ChannelGroup,
  ChannelGroupChannel,
} from "@/lib/stores/documentStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import {
  patchSourceChannelOnImages,
  uniqueImageDisplayLabels,
} from "@/lib/stores/storeUtils";
import styles from "./ChannelGroupsMasterDetail.module.css";

const CHANNEL_DRAG_MIME = "application/x-minerva-channel-ref";

function toggleWithScrollOnShow(
  event: React.MouseEvent<HTMLButtonElement>,
  becomingVisible: boolean,
  apply: () => void,
) {
  apply();
  if (!becomingVisible) return;
  const block = event.currentTarget.closest("li");
  if (!block) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      block.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  });
}

function imageSubtitleIfDistinct(
  channelName: string,
  imageLabel: string | null | undefined,
): string | null {
  if (!imageLabel) return null;
  if (imageLabel.trim().toLowerCase() === channelName.trim().toLowerCase()) {
    return null;
  }
  return imageLabel;
}

type ChannelDragPayload = {
  sourceId: string;
};

const EMPTY_LOCKED_ROW_IDS = new Set<string>();

function readDragPayload(e: React.DragEvent): ChannelDragPayload | null {
  const raw = e.dataTransfer.getData(CHANNEL_DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChannelDragPayload;
  } catch {
    return null;
  }
}

function startChannelDrag(e: React.DragEvent, payload: ChannelDragPayload) {
  e.dataTransfer.setData(CHANNEL_DRAG_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "copy";
}

function ChannelDragHandle(props: {
  label: string;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <button
      type="button"
      className={styles.dragHandle}
      draggable
      onDragStart={props.onDragStart}
      title={`Drag ${props.label}`}
      aria-label={`Drag ${props.label}`}
    >
      ⋮⋮
    </button>
  );
}

function useAnchoredMenu(opts: {
  align: "start" | "end";
  estimateHeight: number;
}) {
  const { align, estimateHeight } = opts;
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({});

  const close = React.useCallback(() => setOpen(false), []);

  const toggleFromButton = (btn: HTMLButtonElement) => {
    if (open) {
      close();
      return;
    }
    const rect = btn.getBoundingClientRect();
    const openUp =
      rect.bottom + estimateHeight + 8 > window.innerHeight &&
      rect.top > estimateHeight;
    const top = openUp ? rect.top - 4 - estimateHeight : rect.bottom + 4;
    setMenuStyle(
      align === "end"
        ? { top, right: Math.max(8, window.innerWidth - rect.right) }
        : {
            top,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 188)),
          },
    );
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, wrapRef, menuRef, menuStyle, toggleFromButton, close };
}

type ChannelRowMoreMenuProps = {
  channelName: string;
  onFitContrast?: () => void;
  fitBusy?: boolean;
  onRemoveFromGroup?: () => void;
};

function ChannelRowMoreMenu(props: ChannelRowMoreMenuProps) {
  const { channelName, onFitContrast, fitBusy, onRemoveFromGroup } = props;
  const hasItems = Boolean(onFitContrast || onRemoveFromGroup);
  const menu = useAnchoredMenu({ align: "end", estimateHeight: 72 });

  if (!hasItems) return null;

  return (
    <div ref={menu.wrapRef}>
      <button
        type="button"
        className={styles.channelActionButton}
        aria-label={`More actions for ${channelName}`}
        aria-expanded={menu.open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          menu.toggleFromButton(e.currentTarget);
        }}
      >
        ⋮
      </button>
      {menu.open
        ? createPortal(
            <div
              ref={menu.menuRef}
              className={minervaTheme.menuFixed}
              role="menu"
              style={menu.menuStyle}
            >
              {onFitContrast ? (
                <button
                  type="button"
                  role="menuitem"
                  className={minervaTheme.menuItem}
                  disabled={fitBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    menu.close();
                    onFitContrast();
                  }}
                >
                  {fitBusy ? "Fitting contrast…" : "Fit contrast"}
                </button>
              ) : null}
              {onRemoveFromGroup ? (
                <button
                  type="button"
                  role="menuitem"
                  className={minervaTheme.menuItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    menu.close();
                    onRemoveFromGroup();
                  }}
                >
                  Remove from group
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function GearIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden={true}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type GroupFolderGearMenuProps = {
  groupName: string;
  canOptimize: boolean;
  optimizeBusy: boolean;
  onOptimize: () => void;
};

function GroupFolderGearMenu(props: GroupFolderGearMenuProps) {
  const { groupName, canOptimize, optimizeBusy, onOptimize } = props;
  const menu = useAnchoredMenu({ align: "start", estimateHeight: 44 });

  return (
    <div ref={menu.wrapRef}>
      <PanelIconButton
        variant="row"
        title="Group settings"
        aria-label={`Group settings for ${groupName}`}
        aria-expanded={menu.open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          menu.toggleFromButton(e.currentTarget);
        }}
      >
        <GearIcon />
      </PanelIconButton>
      {menu.open
        ? createPortal(
            <div
              ref={menu.menuRef}
              className={minervaTheme.menuFixed}
              role="menu"
              style={menu.menuStyle}
            >
              <button
                type="button"
                role="menuitem"
                className={minervaTheme.menuItem}
                disabled={!canOptimize || optimizeBusy}
                title={
                  canOptimize ? undefined : "Needs at least two image channels"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (!canOptimize || optimizeBusy) return;
                  menu.close();
                  onOptimize();
                }}
              >
                {optimizeBusy ? "Optimizing…" : "Optimize colors"}
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function dedupeGroupChannels(
  channels: ChannelGroupChannel[],
): ChannelGroupChannel[] {
  const seen = new Set<string>();
  return channels.filter((gc) => {
    if (seen.has(gc.channelId)) return false;
    seen.add(gc.channelId);
    return true;
  });
}

function makeGroupChannelRow(
  sc: Channel,
  slotIndex: number,
  sourceChannels: Channel[],
): ChannelGroupChannel {
  const [srcLo, srcHi] = effectiveSourceLimits(sc);
  const srcColor = effectiveSourceColor(sc, sourceChannels);
  const seed =
    planarRgbDisplayColor(sc, sourceChannels) ??
    seedRgbForGroupChannelIndex(slotIndex);
  const isMask = isMaskChannel(sc);
  return {
    id: crypto.randomUUID(),
    lowerLimit: srcLo,
    upperLimit: srcHi,
    color: sc.color ?? seed ?? srcColor,
    channelId: sc.id,
    ...(isMask
      ? {
          maskVisualization: sc.maskVisualization ?? DEFAULT_MASK_VISUALIZATION,
        }
      : {}),
  };
}

function groupOptimizePendingSourceIds(
  group: ChannelGroup,
  sourceChannels: Channel[],
  lockedRowIds: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  for (const gc of group.channels) {
    if (lockedRowIds.has(gc.id)) continue;
    const sc = findSourceChannel(sourceChannels, gc.channelId);
    if (
      !sc ||
      !isImageChannel(sc) ||
      sc.samples === 3 ||
      isMaskChannel(sc) ||
      isRgbDisplayChannel(sc, sourceChannels)
    ) {
      continue;
    }
    ids.push(sc.id);
  }
  return ids;
}

export type ChannelGroupsMasterDetailProps = {
  noLoader: boolean;
  contrastEditable?: boolean;
};

export const ChannelGroupsMasterDetail = (
  props: ChannelGroupsMasterDetailProps,
) => {
  const setActiveChannelGroup = useAppStore((s) => s.setActiveChannelGroup);
  const clearImageSelectionMask = useAppStore((s) => s.clearImageSelectionMask);
  const setImageSelectionMaskVisualization = useAppStore(
    (s) => s.setImageSelectionMaskVisualization,
  );
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const imageSelectionMask = useAppStore((s) => s.imageSelectionMask);
  const channelVisibilities = useAppStore((s) => s.channelVisibilities);
  const channelGroupRowVisibilities = useAppStore(
    (s) => s.channelGroupRowVisibilities,
  );
  const setChannelGroupRowVisibilities = useAppStore(
    (s) => s.setChannelGroupRowVisibilities,
  );
  const channelRendering = useAppStore((s) => s.channelRendering);
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const setChannelGroups = useDocumentStore((s) => s.setChannelGroups);
  const setImages = useDocumentStore((s) => s.setImages);
  const setImagesAndChannelGroups = useDocumentStore(
    (s) => s.setImagesAndChannelGroups,
  );
  const setGroupNames = useAppStore((s) => s.setGroupNames);
  const setChannelVisibilities = useAppStore((s) => s.setChannelVisibilities);

  const sourceChannels = React.useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );

  const uniqueSourceChannels = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Channel[] = [];
    for (const sc of sourceChannels) {
      if (seen.has(sc.id)) continue;
      seen.add(sc.id);
      out.push(sc);
    }
    return out;
  }, [sourceChannels]);

  const stackVisibilities = React.useMemo(
    () => defaultVisibilitiesForSources(sourceChannels, channelVisibilities),
    [sourceChannels, channelVisibilities],
  );
  const palettePendingIds = React.useSyncExternalStore(
    subscribeStackPalettePending,
    getStackPalettePendingIds,
    getStackPalettePendingIds,
  );

  const [loadingHistogramSourceIds, setLoadingHistogramSourceIds] =
    React.useState<string[]>([]);
  const [colorPickerTarget, setColorPickerTarget] =
    React.useState<ChannelColorTarget | null>(null);
  const [colorPickerPos, setColorPickerPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [optimizePaletteBusy, setOptimizePaletteBusy] = React.useState(false);
  const [refittingContrastIds, setRefittingContrastIds] = React.useState(
    () => new Set<string>(),
  );
  const [dragOverGroupId, setDragOverGroupId] = React.useState<string | null>(
    null,
  );
  const [lockedColorRowIdsByGroup, setLockedColorRowIdsByGroup] =
    React.useState<Map<string, Set<string>>>(() => new Map());

  React.useEffect(() => {
    setLockedColorRowIdsByGroup((prev) => {
      const validGroupIds = new Set(channelGroups.map((g) => g.id));
      const validRowIds = new Set(
        channelGroups.flatMap((g) => g.channels.map((gc) => gc.id)),
      );
      let changed = false;
      const next = new Map<string, Set<string>>();
      for (const [groupId, rowIds] of prev) {
        if (!validGroupIds.has(groupId)) {
          changed = true;
          continue;
        }
        const filtered = new Set(
          [...rowIds].filter((rowId) => validRowIds.has(rowId)),
        );
        if (filtered.size !== rowIds.size) changed = true;
        if (filtered.size > 0) next.set(groupId, filtered);
      }
      return changed ? next : prev;
    });
  }, [channelGroups]);

  const lockedIdsForGroup = React.useCallback(
    (groupId: string) =>
      lockedColorRowIdsByGroup.get(groupId) ?? EMPTY_LOCKED_ROW_IDS,
    [lockedColorRowIdsByGroup],
  );

  const toggleColorLock = React.useCallback(
    (groupId: string, rowId: string) => {
      setLockedColorRowIdsByGroup((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(groupId) ?? []);
        if (set.has(rowId)) set.delete(rowId);
        else set.add(rowId);
        if (set.size === 0) next.delete(groupId);
        else next.set(groupId, set);
        return next;
      });
    },
    [],
  );

  const selectionMaskVisible =
    channelVisibilities[SELECTION_MASK_CHANNEL_KEY] ?? true;

  const syncGroupState = React.useCallback(
    (newGroups: ChannelGroup[]) => {
      const normalized = newGroups.map((g) => ({
        ...g,
        channels: dedupeGroupChannels(g.channels),
      }));
      setChannelGroups(normalized);
      setGroupNames(
        Object.fromEntries(normalized.map(({ name, id }) => [id, name])),
      );
      setChannelGroupRowVisibilities(
        applyGroupRowVisibilities(
          normalized,
          useAppStore.getState().channelGroupRowVisibilities,
          { kind: "sync" },
        ),
      );
    },
    [setChannelGroups, setGroupNames, setChannelGroupRowVisibilities],
  );

  const activateGroup = React.useCallback(
    (groupId: string) => {
      setActiveChannelGroup(groupId);
      const groups = useDocumentStore.getState().channelGroups;
      syncGroupState(
        groups.map((g) => ({
          ...g,
          expanded: g.id === groupId,
        })),
      );
    },
    [setActiveChannelGroup, syncGroupState],
  );

  const renameSourceChannelDisplayName = React.useCallback(
    (channelId: string, rawName: string) => {
      const trimmed = rawName.trim();
      if (!trimmed) return;
      const doc = useDocumentStore.getState();
      const flatBefore = flattenImageChannelsInDocumentOrder(doc.images);
      const prev = findSourceChannel(flatBefore, channelId);
      if (!prev || prev.name === trimmed) return;
      const nextImages = doc.images.map((im) => ({
        ...im,
        channels: im.channels.map((ch) =>
          ch.id === channelId ? { ...ch, name: trimmed } : ch,
        ),
      }));
      setImages(nextImages);
    },
    [setImages],
  );

  const createGroup = () => {
    const seedingFirst = channelGroups.length === 0;
    const toSeed = seedingFirst
      ? uniqueSourceChannels.filter((sc) =>
          isStackVisible(stackVisibilities, sc.id),
        )
      : [];
    const sourcesNow = flattenImageChannelsInDocumentOrder(
      useDocumentStore.getState().images,
    );
    const seededChannels = seedingFirst
      ? toSeed.map((sc, i) => {
          const fresh = sourcesNow.find((c) => c.id === sc.id) ?? sc;
          return makeGroupChannelRow(fresh, i, sourcesNow);
        })
      : [];
    const newGroup: ChannelGroup = {
      id: crypto.randomUUID(),
      name: `Group ${channelGroups.length + 1}`,
      expanded: true,
      channels: seededChannels,
    };
    syncGroupState([
      ...channelGroups.map((g) => ({ ...g, expanded: false })),
      newGroup,
    ]);
    setActiveChannelGroup(newGroup.id);
    if (seedingFirst && seededChannels.length > 0) {
      const stackOff = { ...stackVisibilities };
      for (const gc of seededChannels) {
        const sc = findSourceChannel(sourcesNow, gc.channelId);
        if (sc) stackOff[sc.id] = false;
      }
      setChannelVisibilities(stackOff);
      setChannelGroupRowVisibilities({
        ...useAppStore.getState().channelGroupRowVisibilities,
        ...Object.fromEntries(seededChannels.map((gc) => [gc.id, true])),
      });
    }
  };

  const deleteGroup = (groupId: string) => {
    const newGroups = channelGroups.filter(({ id }) => id !== groupId);
    syncGroupState(newGroups);
    setLockedColorRowIdsByGroup((prev) => {
      if (!prev.has(groupId)) return prev;
      const next = new Map(prev);
      next.delete(groupId);
      return next;
    });
    if (activeChannelGroupId === groupId) {
      const next = newGroups[0]?.id;
      if (next) activateGroup(next);
      else useAppStore.setState({ activeChannelGroupId: null });
    }
  };

  const renameGroup = (groupId: string, newName: string) => {
    const groups = useDocumentStore.getState().channelGroups;
    syncGroupState(
      groups.map((g) => (g.id === groupId ? { ...g, name: newName } : g)),
    );
  };

  const toggleGroupExpanded = (groupId: string) => {
    const groups = useDocumentStore.getState().channelGroups;
    syncGroupState(
      groups.map((g, i) => {
        if (g.id !== groupId) return g;
        const currentlyExpanded = g.expanded ?? i === 0;
        return { ...g, expanded: !currentlyExpanded };
      }),
    );
  };

  const toggleGroupMasterVisibility = (group: ChannelGroup) => {
    if (group.channels.length === 0) return;
    const allOn = group.channels.every((gc) =>
      isGroupRowVisible(channelGroupRowVisibilities, gc.id),
    );
    const next = { ...channelGroupRowVisibilities };
    for (const gc of group.channels) {
      next[gc.id] = !allOn;
    }
    setChannelGroupRowVisibilities(next);
  };

  const { ensureChannelHistograms } = useAuthorChannelNav() ?? {};

  const refitAutoContrast = React.useCallback(
    async (sourceChannelId: string) => {
      const sc = sourceChannels.find((c) => c.id === sourceChannelId);
      if (!sc || isMaskChannel(sc) || isRgbDisplayChannel(sc, sourceChannels)) {
        return;
      }
      setRefittingContrastIds((prev) => {
        const next = new Set(prev);
        next.add(sourceChannelId);
        return next;
      });
      useAppStore.getState().clearChannelRendering();
      try {
        const limits = await refitGmm(sourceChannelId);
        if (!limits) return;
        const groups = useDocumentStore.getState().channelGroups;
        let changed = false;
        const nextGroups = groups.map((g) => {
          const channels = g.channels.map((gc) => {
            if (gc.channelId !== sourceChannelId) return gc;
            changed = true;
            return {
              ...gc,
              lowerLimit: limits.lower,
              upperLimit: limits.upper,
            };
          });
          return { ...g, channels };
        });
        if (changed) setChannelGroups(nextGroups);
      } catch {
      } finally {
        setRefittingContrastIds((prev) => {
          const next = new Set(prev);
          next.delete(sourceChannelId);
          return next;
        });
      }
    },
    [setChannelGroups, sourceChannels],
  );

  const canFitContrast = (sc: Channel | undefined): sc is Channel =>
    Boolean(
      props.contrastEditable &&
        sc &&
        !isMaskChannel(sc) &&
        !isRgbDisplayChannel(sc, sourceChannels),
    );

  const channelMoreMenu = (
    sc: Channel | undefined,
    name: string,
    onRemoveFromGroup?: () => void,
  ) => (
    <ChannelRowMoreMenu
      channelName={name}
      onFitContrast={
        canFitContrast(sc) ? () => void refitAutoContrast(sc.id) : undefined
      }
      fitBusy={sc ? refittingContrastIds.has(sc.id) : false}
      onRemoveFromGroup={onRemoveFromGroup}
    />
  );

  const addChannelToGroup = React.useCallback(
    async (groupId: string, sourceChannelUUID: string) => {
      if (optimizePaletteBusy) return;
      const group = channelGroups.find((g) => g.id === groupId);
      if (!group) return;
      if (group.channels.some((gc) => gc.channelId === sourceChannelUUID)) {
        return;
      }
      const sc = sourceChannels.find(({ id }) => id === sourceChannelUUID);
      if (!sc) return;
      const lockedIds = new Set(group.channels.map((gc) => gc.id));
      const slotIndex = group.channels.length;
      const isMask = isMaskChannel(sc);
      let fittedLimits: ContrastLimits | null = null;
      if (!isMask) {
        fittedLimits = sc.gmmContrastLimits
          ? {
              lower: sc.gmmContrastLimits.lower,
              upper: sc.gmmContrastLimits.upper,
            }
          : null;
        if (!fittedLimits) {
          try {
            const map = await ensureGmm([sc.id]);
            fittedLimits = map.get(sc.id) ?? null;
          } catch {}
        }
      }

      const newChannel = makeGroupChannelRow(sc, slotIndex, sourceChannels);
      if (fittedLimits) {
        newChannel.lowerLimit = fittedLimits.lower;
        newChannel.upperLimit = fittedLimits.upper;
      }

      const newGroups = channelGroups.map((g) =>
        g.id !== groupId ? g : { ...g, channels: [...g.channels, newChannel] },
      );

      const updatedGroup = newGroups.find((g) => g.id === groupId);
      setChannelGroupRowVisibilities({
        ...useAppStore.getState().channelGroupRowVisibilities,
        [newChannel.id]: true,
      });

      if (
        !updatedGroup ||
        isMask ||
        !isGroupEligibleForPsudoOptimize(updatedGroup, sourceChannels)
      ) {
        syncGroupState(newGroups);
        return;
      }

      setOptimizePaletteBusy(true);
      const pendingIds = groupOptimizePendingSourceIds(
        updatedGroup,
        sourceChannels,
        lockedIds,
      );
      setStackPalettePendingMany(pendingIds, true);
      useAppStore.getState().clearChannelRendering();
      try {
        const colors = await optimizeChannelGroupWithLocks(
          updatedGroup,
          sourceChannels,
          lockedIds,
        );
        syncGroupState(
          applyOptimizedColorsToChannelGroup(newGroups, groupId, colors, {
            lockedChannelRowIds: lockedIds,
          }),
        );
      } catch {
        syncGroupState(newGroups);
      } finally {
        setStackPalettePendingMany(pendingIds, false);
        setOptimizePaletteBusy(false);
      }
    },
    [
      channelGroups,
      sourceChannels,
      syncGroupState,
      optimizePaletteBusy,
      setChannelGroupRowVisibilities,
    ],
  );

  const removeChannelFromGroup = (groupId: string, rowId: string) => {
    const groups = useDocumentStore.getState().channelGroups;
    syncGroupState(
      groups.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, channels: g.channels.filter((gc) => gc.id !== rowId) },
      ),
    );
    setLockedColorRowIdsByGroup((prev) => {
      const set = prev.get(groupId);
      if (!set?.has(rowId)) return prev;
      const next = new Map(prev);
      const updated = new Set(set);
      updated.delete(rowId);
      if (updated.size === 0) next.delete(groupId);
      else next.set(groupId, updated);
      return next;
    });
  };

  const syncMaskVisualization = (
    sourceId: string,
    viz: MaskVisualization,
    groupId?: string,
    rowId?: string,
  ) => {
    const doc = useDocumentStore.getState();
    const nextImages = patchSourceChannelOnImages(doc.images, sourceId, {
      maskVisualization: viz,
    });
    const nextGroups = doc.channelGroups.map((g) => ({
      ...g,
      channels: g.channels.map((gc) => {
        if (groupId != null && rowId != null) {
          return g.id === groupId && gc.id === rowId
            ? { ...gc, maskVisualization: viz }
            : gc;
        }
        return gc.channelId === sourceId
          ? { ...gc, maskVisualization: viz }
          : gc;
      }),
    }));
    setImagesAndChannelGroups(nextImages, nextGroups);
    useAppStore.getState().setMaskVisualizationPreview(null);
  };

  const previewMaskVisualization = (
    sourceId: string,
    viz: MaskVisualization | null,
  ) => {
    useAppStore.getState().setMaskVisualizationPreview(
      viz
        ? {
            sourceChannelId: sourceId,
            visualization: viz,
          }
        : null,
    );
  };

  const runOptimizePaletteForGroup = async (groupId: string) => {
    if (optimizePaletteBusy) return;
    const group = channelGroups.find((g) => g.id === groupId);
    if (!group || !isGroupEligibleForPsudoOptimize(group, sourceChannels)) {
      return;
    }
    const lockedIds = lockedIdsForGroup(groupId);
    const pendingIds = groupOptimizePendingSourceIds(
      group,
      sourceChannels,
      lockedIds,
    );
    setOptimizePaletteBusy(true);
    setStackPalettePendingMany(pendingIds, true);
    useAppStore.getState().clearChannelRendering();
    try {
      const colors = await optimizeChannelGroupWithLocks(
        group,
        sourceChannels,
        lockedIds,
      );
      syncGroupState(
        applyOptimizedColorsToChannelGroup(
          useDocumentStore.getState().channelGroups,
          groupId,
          colors,
          { lockedChannelRowIds: lockedIds },
        ),
      );
    } catch {
    } finally {
      setStackPalettePendingMany(pendingIds, false);
      setOptimizePaletteBusy(false);
    }
  };

  const handleDropOnGroup = (groupId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverGroupId(null);
    const payload = readDragPayload(e);
    if (!payload?.sourceId) return;
    void addChannelToGroup(groupId, payload.sourceId);
  };

  const visibleHistogramTargets = React.useMemo(() => {
    const ids: string[] = [];
    for (const sc of uniqueSourceChannels) {
      if (!isImageChannel(sc)) continue;
      if (isRgbDisplayChannel(sc, sourceChannels)) continue;
      if (sourceDistributionYValuesLength(sc) > 0) continue;

      const stackOn = isStackVisible(stackVisibilities, sc.id);
      const groupRowOn = channelGroups.some((g) =>
        g.channels.some(
          (gc) =>
            gc.channelId === sc.id &&
            isGroupRowVisible(channelGroupRowVisibilities, gc.id),
        ),
      );
      if (!stackOn && !groupRowOn) continue;
      ids.push(sc.id);
    }
    return ids;
  }, [
    uniqueSourceChannels,
    stackVisibilities,
    channelGroupRowVisibilities,
    channelGroups,
    sourceChannels,
  ]);

  React.useEffect(() => {
    if (!ensureChannelHistograms || props.noLoader) return;
    if (visibleHistogramTargets.length === 0) {
      setLoadingHistogramSourceIds([]);
      return;
    }
    let cancelled = false;
    const targets = visibleHistogramTargets;
    const idleHandle = scheduleBackgroundTask(() => {
      if (cancelled) return;
      setLoadingHistogramSourceIds(targets);
      void (async () => {
        try {
          await ensureChannelHistograms(targets);
        } finally {
          if (!cancelled) setLoadingHistogramSourceIds([]);
        }
      })();
    });
    return () => {
      cancelled = true;
      idleHandle.cancel();
      setLoadingHistogramSourceIds([]);
    };
  }, [visibleHistogramTargets, ensureChannelHistograms, props.noLoader]);

  const openColorPicker = (target: ChannelColorTarget, rect: DOMRect) => {
    commitChannelColorTarget(colorPickerTarget);
    setColorPickerTarget(target);
    setColorPickerPos(colorPickerAnchorPosition(rect));
  };

  const compositedIntensityLayers = React.useMemo(
    () =>
      buildCompositedIntensityLayers({
        onLoader: uniqueSourceChannels.filter((sc) => isImageChannel(sc)),
        activeGroup: activeChannelGroupId
          ? channelGroups.find((g) => g.id === activeChannelGroupId)
          : undefined,
        channelGroups,
        stackVisibilities,
        groupRowVisibilities: channelGroupRowVisibilities,
        hasVisibilityMap: Object.keys(stackVisibilities).length > 0,
      }),
    [
      uniqueSourceChannels,
      activeChannelGroupId,
      channelGroups,
      stackVisibilities,
      channelGroupRowVisibilities,
    ],
  );

  const visibleIntensitySourceIds = new Set<string>();
  for (let i = 0; i < compositedIntensityLayers.length; i++) {
    if (i < MAX_VIV_INTENSITY_CHANNELS) {
      visibleIntensitySourceIds.add(compositedIntensityLayers[i].sc.id);
    }
  }

  const showImageBadge = images.length > 1;
  const imageLabels = React.useMemo(
    () => uniqueImageDisplayLabels(images),
    [images],
  );

  const renderGroupFolder = (group: ChannelGroup, groupIndex: number) => {
    const expanded = group.expanded ?? groupIndex === 0;
    const isActive = activeChannelGroupId === group.id;
    const isDropTarget = dragOverGroupId === group.id;
    const rowsVisible =
      group.channels.length === 0 ||
      group.channels.some((gc) =>
        isGroupRowVisible(channelGroupRowVisibilities, gc.id),
      );
    const addable = uniqueSourceChannels.filter(
      (sc) => !group.channels.some((gc) => gc.channelId === sc.id),
    );
    const lockedIds = lockedIdsForGroup(group.id);

    const folderDropProps = {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(CHANNEL_DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragOverGroupId(group.id);
      },
      onDragLeave: () => {
        if (dragOverGroupId === group.id) setDragOverGroupId(null);
      },
      onDrop: (e: React.DragEvent) => handleDropOnGroup(group.id, e),
    };

    return (
      <div
        key={group.id}
        className={[
          styles.groupFolder,
          isActive ? minervaTheme.selectLeft : "",
          isDropTarget ? styles.dropTargetActive : "",
        ].join(" ")}
        {...folderDropProps}
      >
        <div className={styles.groupFolderHeader}>
          <button
            type="button"
            className={`${minervaTheme.focusRing} ${styles.groupFolderActivate}`}
            aria-label={`Select group ${group.name}`}
            aria-pressed={isActive}
            onClick={() => activateGroup(group.id)}
          />
          <button
            type="button"
            className={styles.groupFolderChevron}
            aria-expanded={expanded}
            title={expanded ? "Collapse group" : "Expand group"}
            onClick={() => toggleGroupExpanded(group.id)}
          >
            <ChevronIcon direction={expanded ? "down" : "right"} />
          </button>
          <ChannelVisibilitySwatch
            visible={rowsVisible}
            title="Toggle visibility for all channels in this group"
            ariaLabel={`Toggle visibility for group ${group.name}`}
            onClick={() => toggleGroupMasterVisibility(group)}
          />
          <input
            className={`${minervaTheme.input} ${styles.groupFolderName}`}
            type="text"
            defaultValue={group.name}
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
            aria-label="Group name"
            onClick={() => activateGroup(group.id)}
            onFocus={() => activateGroup(group.id)}
            onBlur={(e) => {
              const trimmed = e.target.value.trim() || "Untitled group";
              if (trimmed === group.name) return;
              renameGroup(group.id, trimmed);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          <div className={styles.groupFolderTrailing}>
            <GroupFolderGearMenu
              groupName={group.name}
              canOptimize={isGroupEligibleForPsudoOptimize(
                group,
                sourceChannels,
              )}
              optimizeBusy={optimizePaletteBusy}
              onOptimize={() => {
                void runOptimizePaletteForGroup(group.id);
              }}
            />
            <PanelIconButton
              variant="row"
              title="Delete group"
              aria-label={`Delete group ${group.name}`}
              onClick={(event) => {
                event.stopPropagation();
                deleteGroup(group.id);
              }}
            >
              <TrashIcon title="Delete" size={14} />
            </PanelIconButton>
          </div>
        </div>
        {expanded ? (
          <div className={styles.groupFolderBody}>
            <ul className={styles.groupChildList}>
              {group.channels.map((gc) => {
                const sc = findSourceChannel(sourceChannels, gc.channelId);
                const name = sc?.name ?? "Unknown";
                const visible = isGroupRowVisible(
                  channelGroupRowVisibilities,
                  gc.id,
                );
                const hex = sc
                  ? assignedDisplayHex(sc, sourceChannels, gc)
                  : rgbToHex(gc.color);
                const palettePending = palettePendingIds.includes(gc.channelId);
                const rgbDisplay = sc
                  ? isRgbDisplayChannel(sc, sourceChannels)
                  : false;
                const contrast =
                  props.contrastEditable &&
                  sc &&
                  isImageChannel(sc) &&
                  visible &&
                  !rgbDisplay
                    ? {
                        ...contrastEditorPropsForGroupRow(
                          channelRendering,
                          group.id,
                          gc,
                          sc,
                        ),
                        histogramLoading: loadingHistogramSourceIds.includes(
                          sc.id,
                        ),
                      }
                    : undefined;

                const imageSubtitle =
                  showImageBadge && sc
                    ? imageSubtitleIfDistinct(
                        name,
                        imageLabels.get(sc.imageId) ?? null,
                      )
                    : null;
                const channelMeta = sc
                  ? imageSubtitle
                    ? `${imageSubtitle} · index ${sc.index}`
                    : `Index ${sc.index}`
                  : "";
                const colorLocked = lockedIds.has(gc.id);
                const showColorLock = !(sc && isMaskChannel(sc)) && !rgbDisplay;

                return (
                  <li key={gc.id} className={styles.groupChildBlock}>
                    <div className={styles.channelRowWrap}>
                      <ChannelDragHandle
                        label={name}
                        onDragStart={(e) =>
                          startChannelDrag(e, { sourceId: gc.channelId })
                        }
                      />
                      <ChannelRow
                        visible={visible}
                        visibilityTitle={
                          visible ? `Hide ${name}` : `Show ${name}`
                        }
                        visibilityAriaLabel={`Toggle visibility for ${name}`}
                        onToggleVisibility={(event) =>
                          toggleWithScrollOnShow(event, !visible, () => {
                            setChannelGroupRowVisibilities({
                              ...channelGroupRowVisibilities,
                              [gc.id]: !visible,
                            });
                          })
                        }
                        name={
                          sc
                            ? {
                                mode: "editable",
                                name,
                                meta: channelMeta,
                                onBlur: (value) =>
                                  renameSourceChannelDisplayName(sc.id, value),
                              }
                            : {
                                mode: "label",
                                name,
                                title: name,
                                className: styles.groupChildName,
                              }
                        }
                        imageSubtitle={imageSubtitle}
                        contrast={contrast}
                        locked={colorLocked}
                        {...(!rgbDisplay && sc && isMaskChannel(sc)
                          ? {
                              isMask: true,
                              maskVisualization: effectiveMaskVisualization(gc),
                              maskAriaLabel: `Mask display for ${name}`,
                              onMaskVisualizationChange: (viz) =>
                                syncMaskVisualization(
                                  gc.channelId,
                                  viz,
                                  group.id,
                                  gc.id,
                                ),
                              onMaskVisualizationPreview: (viz) => {
                                previewMaskVisualization(gc.channelId, viz);
                              },
                            }
                          : !rgbDisplay
                            ? {
                                busy: palettePending,
                                colorHex: hex,
                                colorTitle: `Pick color for ${name} in this group`,
                                onColorClick: (
                                  e: React.MouseEvent<HTMLButtonElement>,
                                ) => {
                                  openColorPicker(
                                    {
                                      scope: "group",
                                      groupId: group.id,
                                      rowId: gc.id,
                                    },
                                    e.currentTarget.getBoundingClientRect(),
                                  );
                                },
                              }
                            : {})}
                        trailing={
                          rgbDisplay ? (
                            channelMoreMenu(sc, name, () =>
                              removeChannelFromGroup(group.id, gc.id),
                            )
                          ) : (
                            <>
                              {showColorLock ? (
                                <button
                                  type="button"
                                  className={[
                                    styles.channelActionButton,
                                    colorLocked
                                      ? styles.colorLockButtonLocked
                                      : "",
                                  ].join(" ")}
                                  title={
                                    colorLocked ? "Unlock color" : "Lock color"
                                  }
                                  aria-label={
                                    colorLocked
                                      ? `Unlock color for ${name}`
                                      : `Lock color for ${name}`
                                  }
                                  aria-pressed={colorLocked}
                                  onClick={() =>
                                    toggleColorLock(group.id, gc.id)
                                  }
                                >
                                  {colorLocked ? (
                                    <LockIcon
                                      width={12}
                                      height={12}
                                      aria-hidden
                                    />
                                  ) : (
                                    <LockOpenIcon
                                      width={12}
                                      height={12}
                                      aria-hidden
                                    />
                                  )}
                                </button>
                              ) : null}
                              {channelMoreMenu(sc, name, () =>
                                removeChannelFromGroup(group.id, gc.id),
                              )}
                            </>
                          )
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className={styles.addChannelRow}>
              <select
                className={`${minervaTheme.input} ${styles.addChannelSelect}`}
                defaultValue=""
                disabled={optimizePaletteBusy || addable.length === 0}
                onChange={(e) => {
                  if (e.target.value) {
                    void addChannelToGroup(group.id, e.target.value);
                    e.target.value = "";
                  }
                }}
              >
                <option value="" disabled>
                  {optimizePaletteBusy ? "Optimizing…" : "Add channel…"}
                </option>
                {addable.map((sc) => {
                  const imageLabel = showImageBadge
                    ? imageLabels.get(sc.imageId)
                    : undefined;
                  return (
                    <option key={sc.id} value={sc.id}>
                      {imageLabel ? `${sc.name} (${imageLabel})` : sc.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const stackLayerTitle = (sc: Channel, stackOn: boolean) => {
    if (channelGroups.length === 0) {
      return stackOn ? `Hide ${sc.name}` : `Show ${sc.name}`;
    }
    return stackOn
      ? `Hide ${sc.name} layer on top of groups`
      : `Show ${sc.name} on top of groups`;
  };

  const renderAllChannelsRow = (sc: Channel) => {
    const stackOn = isStackVisible(stackVisibilities, sc.id);
    const groupRows = channelGroups.flatMap((g) =>
      g.channels
        .filter((gc) => gc.channelId === sc.id)
        .map((gc) => ({ groupId: g.id, row: gc })),
    );
    const inAnyGroup = groupRows.length > 0;
    const viaGroup = isDisplayedViaGroupRow(
      sc.id,
      channelGroups,
      channelGroupRowVisibilities,
    );
    const shownInViewer = inAnyGroup ? viaGroup : stackOn;
    const home =
      groupRows.find((m) =>
        isGroupRowVisible(channelGroupRowVisibilities, m.row.id),
      ) ??
      groupRows.find((m) => m.groupId === activeChannelGroupId) ??
      groupRows[0];
    const imageLabel = showImageBadge
      ? (imageLabels.get(sc.imageId) ?? "")
      : "";
    const imageSubtitle = imageSubtitleIfDistinct(sc.name, imageLabel || null);
    const meta = imageLabel
      ? `${imageLabel} · index ${sc.index}`
      : `Index ${sc.index}`;
    const visibilityAriaLabel = imageLabel
      ? `Toggle layer for ${sc.name} from ${imageLabel}`
      : `Toggle layer for ${sc.name}`;

    const toggleAllChannelsVisibility = (nextVisible: boolean) => {
      if (groupRows.length > 0) {
        const vis = { ...channelGroupRowVisibilities };
        for (const { row } of groupRows) vis[row.id] = nextVisible;
        setChannelGroupRowVisibilities(vis);
        return;
      }
      setChannelVisibilities({
        ...stackVisibilities,
        [sc.id]: nextVisible,
      });
    };

    const dragHandle = (
      <ChannelDragHandle
        label={sc.name}
        onDragStart={(e) => startChannelDrag(e, { sourceId: sc.id })}
      />
    );
    const palettePending = palettePendingIds.includes(sc.id);
    const rgbDisplay = isRgbDisplayChannel(sc, sourceChannels);
    const hex = assignedDisplayHex(sc, sourceChannels, home?.row ?? null);
    const colorSwatch =
      rgbDisplay || isMaskChannel(sc)
        ? undefined
        : {
            busy: palettePending,
            colorHex: hex,
            colorTitle: `Pick color for ${sc.name}`,
            onColorClick: (e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              if (home) {
                openColorPicker(
                  {
                    scope: "group",
                    groupId: home.groupId,
                    rowId: home.row.id,
                  },
                  e.currentTarget.getBoundingClientRect(),
                );
                return;
              }
              openColorPicker(
                { scope: "source" as const, sourceId: sc.id },
                e.currentTarget.getBoundingClientRect(),
              );
            },
          };

    const expanded = !inAnyGroup && shownInViewer;
    const capped =
      expanded &&
      isImageChannel(sc) &&
      stackOn &&
      Boolean(sc.color) &&
      !visibleIntensitySourceIds.has(sc.id);
    const displayColor = effectiveDisplayColor(sc, sourceChannels, null);
    const displayLimits = effectiveSourceLimits(sc);
    const contrast =
      expanded && props.contrastEditable && isImageChannel(sc) && !rgbDisplay
        ? {
            ...contrastEditorPropsForSource(
              channelRendering,
              sc,
              displayColor,
              displayLimits,
            ),
            histogramLoading: loadingHistogramSourceIds.includes(sc.id),
          }
        : undefined;

    return (
      <li key={`all-${sc.id}`} className={styles.rootChannelBlock}>
        <div className={styles.channelRowWrap}>
          {dragHandle}
          <ChannelRow
            visible={shownInViewer}
            visibilityTitle={
              capped
                ? `Over Viv limit (${MAX_VIV_INTENSITY_CHANNELS}) — hide another channel`
                : home
                  ? shownInViewer
                    ? `Hide ${sc.name} in groups`
                    : `Show ${sc.name} in groups`
                  : stackLayerTitle(sc, shownInViewer)
            }
            visibilityAriaLabel={visibilityAriaLabel}
            onToggleVisibility={
              expanded
                ? () => toggleAllChannelsVisibility(false)
                : (event) =>
                    toggleWithScrollOnShow(event, !shownInViewer, () => {
                      toggleAllChannelsVisibility(!shownInViewer);
                    })
            }
            name={{
              mode: "editable",
              name: sc.name,
              meta,
              onBlur: (value) => renameSourceChannelDisplayName(sc.id, value),
            }}
            imageSubtitle={imageSubtitle}
            contrast={contrast}
            {...(expanded && !rgbDisplay && isMaskChannel(sc)
              ? {
                  isMask: true,
                  maskVisualization: effectiveMaskVisualization(sc),
                  maskAriaLabel: `Mask display for ${sc.name}`,
                  onMaskVisualizationChange: (viz) =>
                    syncMaskVisualization(sc.id, viz),
                  onMaskVisualizationPreview: (viz) =>
                    previewMaskVisualization(sc.id, viz),
                }
              : colorSwatch)}
            trailing={
              expanded && !rgbDisplay ? channelMoreMenu(sc, sc.name) : undefined
            }
          />
        </div>
      </li>
    );
  };

  return (
    <div className={panel.authorPanel}>
      <CompactHeader
        actions={
          <PanelIconButton
            title="Add"
            aria-label="Add group"
            onClick={createGroup}
          >
            <PlusIcon />
          </PanelIconButton>
        }
      />

      <div className={[panel.authorPanelBody, panel.thinScrollbar].join(" ")}>
        {channelGroups.length > 0 ? (
          <div className={styles.groupFolders}>
            {channelGroups.map((group, i) => renderGroupFolder(group, i))}
          </div>
        ) : null}

        {uniqueSourceChannels.length > 0 ? (
          <div className={styles.treeSeparator}>All channels</div>
        ) : null}

        {uniqueSourceChannels.length === 0 ? (
          channelGroups.length === 0 ? (
            <div className={panel.emptyMessage}>No channels yet</div>
          ) : null
        ) : (
          <ul className={styles.rootChannelList}>
            {uniqueSourceChannels.map(renderAllChannelsRow)}
          </ul>
        )}

        {imageSelectionMask ? (
          <ChannelRow
            visible={selectionMaskVisible}
            visibilityTitle="Toggle selection mask visibility"
            visibilityAriaLabel="Toggle selection mask visibility"
            onToggleVisibility={() => {
              setChannelVisibilities({
                ...stackVisibilities,
                [SELECTION_MASK_CHANNEL_KEY]: !selectionMaskVisible,
              });
            }}
            name={{
              mode: "label",
              className: styles.groupChildName,
              name: `${SELECTION_MASK_CHANNEL_KEY}${
                imageSelectionMask.sourceShapeLabel
                  ? ` (${imageSelectionMask.sourceShapeLabel})`
                  : ""
              }`,
            }}
            isMask
            maskVisualization={
              imageSelectionMask.maskVisualization ?? DEFAULT_MASK_VISUALIZATION
            }
            maskAriaLabel="Selection mask display"
            onMaskVisualizationChange={(viz) => {
              setImageSelectionMaskVisualization(viz);
              previewMaskVisualization(SELECTION_MASK_CHANNEL_KEY, null);
            }}
            onMaskVisualizationPreview={(viz) =>
              previewMaskVisualization(SELECTION_MASK_CHANNEL_KEY, viz)
            }
            fixedColorHex="ffcc00"
            trailing={
              <button
                type="button"
                className={styles.channelActionButton}
                title="Clear selection"
                aria-label="Clear selection"
                onClick={() => clearImageSelectionMask()}
              >
                <TrashIcon title="Remove from group" size={12} />
              </button>
            }
          />
        ) : null}
      </div>

      {colorPickerTarget && colorPickerPos ? (
        <ChannelColorPicker
          target={colorPickerTarget}
          position={colorPickerPos}
          onDismiss={() => {
            setColorPickerTarget(null);
            setColorPickerPos(null);
          }}
        />
      ) : null}
    </div>
  );
};

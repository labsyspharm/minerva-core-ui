import * as React from "react";
import {
  ChromeColorPickerPopover,
  chromeColorPickerAnchorPosition,
} from "@/components/shared/ChromeColorPickerPopover";
import { ChannelRow, rgbToHex } from "@/components/shared/channel/ChannelRow";
import { ChannelVisibilitySwatch } from "@/components/shared/channel/ChannelVisibilitySwatch";
import {
  channelItemAttrsForGroupRow,
  channelItemAttrsForSource,
  colorRenderingForSource,
} from "@/components/shared/channel/channelLiveRendering";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import type { ContrastLimits } from "@/lib/imaging/autoContrast";
import {
  buildCompositedIntensityLayers,
  isDisplayedViaActiveGroup,
  isGroupRowVisible,
  isShownFirstInAllChannelsList,
  isStackVisible,
  sourceChannelInAnyGroup,
} from "@/lib/imaging/channelCompositor";
import {
  DEFAULT_MASK_VISUALIZATION,
  isImageChannel,
  isMaskChannel,
  isRgbDisplayChannel,
  type MaskVisualization,
  planarRgbDisplayColor,
} from "@/lib/imaging/channelKind";
import {
  scheduleBackgroundTask,
  sourceDistributionYValuesLength,
} from "@/lib/imaging/histogramLazy";
import { SELECTION_MASK_CHANNEL_KEY } from "@/lib/imaging/maskLayers";
import {
  applyOptimizedColorsToChannelGroup,
  isGroupEligibleForPsudoOptimize,
  lockedRowIdsForGroup,
  optimizeChannelGroupWithLocks,
  seedRgbForGroupChannelIndex,
} from "@/lib/imaging/psudoPalette";
import {
  effectiveDisplayColor,
  effectiveMaskVisualization,
  effectiveSourceColor,
  effectiveSourceLimits,
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
import { patchSourceChannelOnImages } from "@/lib/stores/storeUtils";
import styles from "./ChannelList.module.css";

const CHANNEL_DRAG_MIME = "application/x-minerva-channel-ref";

type ChannelDragPayload = {
  sourceId: string;
  fromGroupId?: string;
};

type ColorPickerTarget =
  | { scope: "source"; sourceId: string }
  | { scope: "group"; groupId: string; rowId: string };

const TrashIcon = (props: { title: string; size?: number }) => (
  <svg
    width={props.size ?? 14}
    height={props.size ?? 14}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <title>{props.title}</title>
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

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

/** Group row copy of a source channel (independent color/limits from the source). */
function makeGroupChannelRow(
  sc: Channel,
  slotIndex: number,
  sourceChannels: Channel[],
): ChannelGroupChannel {
  const [srcLo, srcHi] = effectiveSourceLimits(sc);
  const idx = sourceChannels.findIndex((c) => c.id === sc.id);
  const srcColor = effectiveSourceColor(sc, idx >= 0 ? idx : 0, sourceChannels);
  const seed =
    planarRgbDisplayColor(sc, sourceChannels) ??
    seedRgbForGroupChannelIndex(slotIndex);
  const isMask = isMaskChannel(sc);
  return {
    id: crypto.randomUUID(),
    lowerLimit: sc.lowerLimit ?? srcLo,
    upperLimit: sc.upperLimit ?? srcHi,
    color: sc.color ?? seed ?? srcColor,
    channelId: sc.id,
    ...(isMask
      ? {
          maskVisualization: sc.maskVisualization ?? DEFAULT_MASK_VISUALIZATION,
        }
      : {}),
  };
}

export type ChannelGroupsMasterDetailProps = {
  channelItemElement: string;
  noLoader: boolean;
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
  ensureChannelGmmContrastLimits?: (
    channelIds: string[],
    opts?: { overwriteExistingLimits?: boolean },
  ) => Promise<Map<string, ContrastLimits>>;
};

export const ChannelGroupsMasterDetail = (
  props: ChannelGroupsMasterDetailProps,
) => {
  const {
    setActiveChannelGroup,
    clearImageSelectionMask,
    setImageSelectionMaskVisualization,
  } = useAppStore();
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
  const setGroupNames = useAppStore((s) => s.setGroupNames);
  const setGroupChannelLists = useAppStore((s) => s.setGroupChannelLists);
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

  const activeChannelGroup = React.useMemo(
    () =>
      activeChannelGroupId
        ? channelGroups.find((g) => g.id === activeChannelGroupId)
        : undefined,
    [channelGroups, activeChannelGroupId],
  );

  const allChannelsOrdered = React.useMemo(() => {
    const first: Channel[] = [];
    const rest: Channel[] = [];
    for (const sc of uniqueSourceChannels) {
      if (
        isShownFirstInAllChannelsList(
          sc,
          channelVisibilities,
          activeChannelGroup,
          channelGroupRowVisibilities,
        )
      ) {
        first.push(sc);
      } else {
        rest.push(sc);
      }
    }
    return [...first, ...rest];
  }, [
    uniqueSourceChannels,
    channelVisibilities,
    activeChannelGroup,
    channelGroupRowVisibilities,
  ]);

  const [loadingHistogramSourceIds, setLoadingHistogramSourceIds] =
    React.useState<string[]>([]);
  const [colorPickerTarget, setColorPickerTarget] =
    React.useState<ColorPickerTarget | null>(null);
  const [colorPickerPos, setColorPickerPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [optimizePaletteBusy, setOptimizePaletteBusy] = React.useState(false);
  const [optimizePaletteMessage, setOptimizePaletteMessage] = React.useState<
    string | null
  >(null);
  const [dragOverGroupId, setDragOverGroupId] = React.useState<string | null>(
    null,
  );
  const [lockedColorRowIdsByGroup, setLockedColorRowIdsByGroup] =
    React.useState<Map<string, Set<string>>>(() => new Map());

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
      const lists = Object.fromEntries(
        normalized.map(({ name, channels }) => [
          name,
          channels
            .map((gc) => findSourceChannel(sourceChannels, gc.channelId))
            .filter(Boolean)
            .map((sc) => sc?.name),
        ]),
      );
      setGroupChannelLists(lists);
    },
    [sourceChannels, setChannelGroups, setGroupNames, setGroupChannelLists],
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
      const flatAfter = flattenImageChannelsInDocumentOrder(nextImages);
      const groups = useDocumentStore.getState().channelGroups;
      setGroupChannelLists(
        Object.fromEntries(
          groups.map(({ name, channels }) => [
            name,
            channels
              .map((gc) => findSourceChannel(flatAfter, gc.channelId))
              .filter(Boolean)
              .map((sc) => sc?.name as string),
          ]),
        ),
      );
    },
    [setImages, setGroupChannelLists],
  );

  const createGroup = () => {
    const seedingFirst = channelGroups.length === 0;
    const toSeed = seedingFirst
      ? uniqueSourceChannels.filter((sc) =>
          isStackVisible(channelVisibilities, sc.id),
        )
      : [];
    const seededChannels = seedingFirst
      ? toSeed.map((sc, i) => makeGroupChannelRow(sc, i, sourceChannels))
      : [];
    const newGroup: ChannelGroup = {
      id: crypto.randomUUID(),
      name: `Group ${channelGroups.length + 1}`,
      expanded: true,
      channels: seededChannels,
    };
    syncGroupState([...channelGroups, newGroup]);
    setActiveChannelGroup(newGroup.id);
    if (seedingFirst && seededChannels.length > 0) {
      const stackOff = { ...useAppStore.getState().channelVisibilities };
      for (const gc of seededChannels) {
        const sc = findSourceChannel(sourceChannels, gc.channelId);
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
    if (activeChannelGroupId === groupId) {
      const next = newGroups[0]?.id;
      if (next) setActiveChannelGroup(next);
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
      groups.map((g) =>
        g.id === groupId ? { ...g, expanded: !(g.expanded ?? true) } : g,
      ),
    );
  };

  const toggleGroupMasterVisibility = (group: ChannelGroup) => {
    if (group.channels.length === 0) return;
    const allOn = group.channels.every((gc) =>
      isGroupRowVisible(channelGroupRowVisibilities, gc.id),
    );
    const next = { ...channelGroupRowVisibilities };
    for (const gc of group.channels) next[gc.id] = !allOn;
    setChannelGroupRowVisibilities(next);
  };

  const { ensureChannelGmmContrastLimits, ensureChannelHistograms } = props;

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
      const lockedIds = lockedRowIdsForGroup(group);
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
        if (!fittedLimits && ensureChannelGmmContrastLimits) {
          try {
            const map = await ensureChannelGmmContrastLimits([sc.id]);
            fittedLimits = map.get(sc.id) ?? null;
          } catch {
            /* ignore */
          }
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
        setOptimizePaletteBusy(false);
      }
    },
    [
      channelGroups,
      sourceChannels,
      syncGroupState,
      optimizePaletteBusy,
      ensureChannelGmmContrastLimits,
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
  };

  const syncMaskVisualization = (
    sourceId: string,
    viz: MaskVisualization,
    groupId?: string,
    rowId?: string,
  ) => {
    const doc = useDocumentStore.getState();
    setImages(
      patchSourceChannelOnImages(doc.images, sourceId, {
        maskVisualization: viz,
      }),
    );
    const groups = useDocumentStore.getState().channelGroups;
    syncGroupState(
      groups.map((g) => ({
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
      })),
    );
  };

  const setGroupMaskVisualization = (
    groupId: string,
    rowId: string,
    viz: MaskVisualization,
  ) => {
    const row = useDocumentStore
      .getState()
      .channelGroups.find((g) => g.id === groupId)
      ?.channels.find((gc) => gc.id === rowId);
    const sourceId = row?.channelId;
    if (!sourceId) return;
    syncMaskVisualization(sourceId, viz, groupId, rowId);
  };

  const setSourceMaskVisualization = (
    sourceId: string,
    viz: MaskVisualization,
  ) => {
    syncMaskVisualization(sourceId, viz);
  };

  const runOptimizePaletteForGroup = async (groupId: string) => {
    if (optimizePaletteBusy) return;
    const group = channelGroups.find((g) => g.id === groupId);
    if (!group || !isGroupEligibleForPsudoOptimize(group, sourceChannels)) {
      setOptimizePaletteMessage(
        "Need at least two non-RGB channels to optimize colors.",
      );
      return;
    }
    const lockedIds =
      lockedColorRowIdsByGroup.get(groupId) ?? EMPTY_LOCKED_ROW_IDS;
    setOptimizePaletteBusy(true);
    setOptimizePaletteMessage(null);
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
      setOptimizePaletteMessage("Palette optimized.");
    } catch (e) {
      setOptimizePaletteMessage(
        e instanceof Error ? e.message : "Could not optimize palette.",
      );
    } finally {
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

  /**
   * Only fetch histograms for currently visible source channels. Keying by the
   * sorted list of visible ids that don't yet have a distribution avoids
   * re-firing the effect when other (hidden) channels change.
   */
  const visibleHistogramTargets = React.useMemo(() => {
    const ids: string[] = [];
    for (const sc of uniqueSourceChannels) {
      if (!isStackVisible(channelVisibilities, sc.id)) continue;
      if (!isImageChannel(sc)) continue;
      if (isRgbDisplayChannel(sc, sourceChannels)) continue;
      if (sourceDistributionYValuesLength(sc) > 0) continue;
      ids.push(sc.id);
    }
    return ids;
  }, [uniqueSourceChannels, channelVisibilities, sourceChannels]);

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

  const pickingColorHex = React.useMemo(() => {
    if (!colorPickerTarget) return null;
    if (colorPickerTarget.scope === "source") {
      const live = colorRenderingForSource(
        channelRendering,
        colorPickerTarget.sourceId,
      );
      if (live) return rgbToHex(live);
      const sc = findSourceChannel(sourceChannels, colorPickerTarget.sourceId);
      if (!sc) return null;
      const idx = sourceChannels.findIndex((c) => c.id === sc.id);
      return rgbToHex(
        effectiveSourceColor(sc, idx >= 0 ? idx : 0, sourceChannels),
      );
    }
    const g = channelGroups.find((x) => x.id === colorPickerTarget.groupId);
    const gc = g?.channels.find((c) => c.id === colorPickerTarget.rowId);
    if (!gc) return null;
    const sc = findSourceChannel(sourceChannels, gc.channelId);
    const live = colorRenderingForSource(channelRendering, gc.channelId);
    if (live) return rgbToHex(live);
    return rgbToHex(
      sc ? effectiveDisplayColor(sc, sourceChannels, gc) : gc.color,
    );
  }, [colorPickerTarget, channelRendering, sourceChannels, channelGroups]);

  const closeColorPicker = React.useCallback(() => {
    const target = colorPickerTarget;
    const live = useAppStore.getState().channelRendering;
    if (target?.scope === "source") {
      const colorLive = colorRenderingForSource(live, target.sourceId);
      if (colorLive) {
        const doc = useDocumentStore.getState();
        setImages(
          patchSourceChannelOnImages(doc.images, target.sourceId, {
            color: { r: colorLive.r, g: colorLive.g, b: colorLive.b },
          }),
        );
      }
    } else if (target?.scope === "group") {
      const row = useDocumentStore
        .getState()
        .channelGroups.find((g) => g.id === target.groupId)
        ?.channels.find((gc) => gc.id === target.rowId);
      const colorLive = row
        ? colorRenderingForSource(live, row.channelId)
        : null;
      if (colorLive) {
        syncGroupState(
          useDocumentStore.getState().channelGroups.map((g) =>
            g.id !== target.groupId
              ? g
              : {
                  ...g,
                  channels: g.channels.map((gc) =>
                    gc.id === target.rowId
                      ? {
                          ...gc,
                          color: {
                            r: colorLive.r,
                            g: colorLive.g,
                            b: colorLive.b,
                          },
                        }
                      : gc,
                  ),
                },
          ),
        );
      }
    }
    useAppStore.getState().clearChannelRendering();
    setColorPickerTarget(null);
    setColorPickerPos(null);
  }, [colorPickerTarget, setImages, syncGroupState]);

  const compositedIntensityLayers = React.useMemo(
    () =>
      buildCompositedIntensityLayers({
        onLoader: uniqueSourceChannels.filter((sc) => isImageChannel(sc)),
        activeGroup: activeChannelGroupId
          ? channelGroups.find((g) => g.id === activeChannelGroupId)
          : undefined,
        channelGroups,
        stackVisibilities: channelVisibilities,
        groupRowVisibilities: channelGroupRowVisibilities,
        hasVisibilityMap: Object.keys(channelVisibilities).length > 0,
      }),
    [
      uniqueSourceChannels,
      activeChannelGroupId,
      channelGroups,
      channelVisibilities,
      channelGroupRowVisibilities,
    ],
  );

  const visibleIntensitySourceIds = new Set<string>();
  for (let i = 0; i < compositedIntensityLayers.length; i++) {
    if (i < MAX_VIV_INTENSITY_CHANNELS) {
      visibleIntensitySourceIds.add(compositedIntensityLayers[i].sc.id);
    }
  }

  // Show which image each channel came from only when more than one image
  // is loaded. With a single image the badge would be redundant noise.
  const showImageBadge = images.length > 1;

  const renderGroupFolder = (group: ChannelGroup) => {
    const expanded = group.expanded ?? true;
    const isActive = activeChannelGroupId === group.id;
    const isDropTarget = dragOverGroupId === group.id;
    const rowsVisible =
      group.channels.length === 0 ||
      group.channels.some((gc) =>
        isGroupRowVisible(channelGroupRowVisibilities, gc.id),
      );
    // Inactive groups are not composited — show the master eye as off until selected.
    const masterVisible = isActive && rowsVisible;
    const addable = uniqueSourceChannels.filter(
      (sc) => !group.channels.some((gc) => gc.channelId === sc.id),
    );
    const psudoEligible = isGroupEligibleForPsudoOptimize(
      group,
      sourceChannels,
    );

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
          isActive ? styles.groupFolderActive : "",
          isDropTarget ? styles.dropTargetActive : "",
        ].join(" ")}
        {...folderDropProps}
      >
        <div className={styles.groupFolderHeader}>
          <button
            type="button"
            className={styles.groupFolderChevron}
            aria-expanded={expanded}
            title={expanded ? "Collapse group" : "Expand group"}
            onClick={() => toggleGroupExpanded(group.id)}
          >
            <ChevronDownIcon
              className={
                expanded
                  ? styles.waypointChevronDown
                  : styles.waypointChevronRight
              }
              aria-hidden
            />
          </button>
          <ChannelVisibilitySwatch
            visible={masterVisible}
            title="Toggle visibility for all channels in this group"
            ariaLabel={`Toggle visibility for group ${group.name}`}
            onClick={() => toggleGroupMasterVisibility(group)}
          />
          <input
            className={`${styles.detailTitleInput} ${styles.groupFolderName}`}
            type="text"
            defaultValue={group.name}
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
            aria-label="Group name"
            onClick={() => setActiveChannelGroup(group.id)}
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
          <div className={styles.groupFolderActions}>
            {psudoEligible ? (
              <button
                type="button"
                className={styles.headerButton}
                disabled={optimizePaletteBusy}
                title="Optimize colors in this group"
                onClick={() => void runOptimizePaletteForGroup(group.id)}
              >
                Optimize
              </button>
            ) : null}
            <button
              type="button"
              className={styles.iconHeaderButton}
              title="Delete group"
              onClick={() => deleteGroup(group.id)}
            >
              <TrashIcon title="Delete group" />
            </button>
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
                const hex = rgbToHex(
                  sc ? effectiveDisplayColor(sc, sourceChannels, gc) : gc.color,
                );
                const kind = sc
                  ? isMaskChannel(sc)
                    ? "mask"
                    : "channel"
                  : "channel";
                const rgbDisplay = sc
                  ? isRgbDisplayChannel(sc, sourceChannels)
                  : false;
                const legacyItem =
                  sc && isImageChannel(sc) && visible && !rgbDisplay
                    ? React.createElement(props.channelItemElement, {
                        key: `grp-${group.id}-${gc.id}`,
                        ...channelItemAttrsForGroupRow(
                          channelRendering,
                          group.id,
                          gc,
                          sc,
                        ),
                        histogram_loading: loadingHistogramSourceIds.includes(
                          sc.id,
                        )
                          ? "true"
                          : "false",
                      })
                    : null;

                const imageSubtitle =
                  showImageBadge && sc
                    ? images
                        .find((i) => i.id === sc.imageId)
                        ?.basename?.trim() || null
                    : null;
                const channelMeta = sc
                  ? imageSubtitle
                    ? `${imageSubtitle} · index ${sc.index}`
                    : `Index ${sc.index}`
                  : "";

                return (
                  <li key={gc.id} className={styles.groupChildBlock}>
                    <div className={styles.groupChildRowWrap}>
                      <ChannelDragHandle
                        label={name}
                        onDragStart={(e) =>
                          startChannelDrag(e, {
                            sourceId: gc.channelId,
                            fromGroupId: group.id,
                          })
                        }
                      />
                      {rgbDisplay ? (
                        <ChannelRow
                          rowClassName={styles.groupChildRow}
                          compact
                          visible={visible}
                          visibilityTitle={
                            visible ? `Hide ${name}` : `Show ${name}`
                          }
                          visibilityAriaLabel={`Toggle visibility for ${name}`}
                          onToggleVisibility={() => {
                            setChannelGroupRowVisibilities({
                              ...channelGroupRowVisibilities,
                              [gc.id]: !visible,
                            });
                          }}
                          name={
                            sc
                              ? {
                                  mode: "editable",
                                  name,
                                  meta: channelMeta,
                                  onBlur: (value) =>
                                    renameSourceChannelDisplayName(
                                      sc.id,
                                      value,
                                    ),
                                }
                              : {
                                  mode: "label",
                                  name,
                                  title: name,
                                  className: styles.groupChildName,
                                }
                          }
                          imageSubtitle={imageSubtitle}
                          trailing={
                            <button
                              type="button"
                              className={styles.channelActionButton}
                              title="Remove from group"
                              aria-label={`Remove ${name} from group`}
                              onClick={() =>
                                removeChannelFromGroup(group.id, gc.id)
                              }
                            >
                              <TrashIcon title="Remove from group" size={12} />
                            </button>
                          }
                        />
                      ) : (
                        <ChannelRow
                          rowClassName={styles.groupChildRow}
                          visible={visible}
                          visibilityTitle={
                            visible ? `Hide ${name}` : `Show ${name}`
                          }
                          visibilityAriaLabel={`Toggle visibility for ${name}`}
                          onToggleVisibility={() => {
                            setChannelGroupRowVisibilities({
                              ...channelGroupRowVisibilities,
                              [gc.id]: !visible,
                            });
                          }}
                          name={
                            sc
                              ? {
                                  mode: "editable",
                                  name,
                                  meta: channelMeta,
                                  onBlur: (value) =>
                                    renameSourceChannelDisplayName(
                                      sc.id,
                                      value,
                                    ),
                                }
                              : {
                                  mode: "label",
                                  name,
                                  title: name,
                                  className: styles.groupChildName,
                                }
                          }
                          imageSubtitle={imageSubtitle}
                          {...(kind === "mask"
                            ? {
                                isMask: true as const,
                                maskVisualization:
                                  effectiveMaskVisualization(gc),
                                maskAriaLabel: `Mask display for ${name}`,
                                onMaskVisualizationChange: (viz) =>
                                  setGroupMaskVisualization(
                                    group.id,
                                    gc.id,
                                    viz,
                                  ),
                              }
                            : {
                                colorHex: hex,
                                colorTitle: `Pick color for ${name} in this group`,
                                colorAriaLabel: `Pick color for ${name} in this group`,
                                onColorClick: (e) => {
                                  const rect =
                                    e.currentTarget.getBoundingClientRect();
                                  setColorPickerTarget({
                                    scope: "group",
                                    groupId: group.id,
                                    rowId: gc.id,
                                  });
                                  setColorPickerPos(
                                    chromeColorPickerAnchorPosition(rect),
                                  );
                                },
                              })}
                          trailing={
                            <button
                              type="button"
                              className={styles.channelActionButton}
                              title="Remove from group"
                              aria-label={`Remove ${name} from group`}
                              onClick={() =>
                                removeChannelFromGroup(group.id, gc.id)
                              }
                            >
                              <TrashIcon title="Remove from group" size={12} />
                            </button>
                          }
                        />
                      )}
                    </div>
                    {legacyItem ? (
                      <div className={styles.detailChannelItemEmbed}>
                        {legacyItem}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className={styles.addChannelRow}>
              <select
                className={styles.addChannelSelect}
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
                {addable.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const stackLayerTitle = (sc: Channel, stackOn: boolean) => {
    if (!activeChannelGroupId) {
      return stackOn ? `Hide ${sc.name}` : `Show ${sc.name}`;
    }
    return stackOn
      ? `Hide ${sc.name} layer on top of active group`
      : `Show ${sc.name} on top of active group`;
  };

  const allChannelsLayerTitle = (
    sc: Channel,
    shown: boolean,
    viaActiveGroup: boolean,
  ) => {
    if (viaActiveGroup) {
      return shown
        ? `Hide ${sc.name} in active group`
        : `Show ${sc.name} in active group`;
    }
    return stackLayerTitle(sc, shown);
  };

  const renderAllChannelsRow = (sc: Channel) => {
    const stackOn = isStackVisible(channelVisibilities, sc.id);
    const activeRow = activeChannelGroup?.channels.find(
      (gc) => gc.channelId === sc.id,
    );
    const inAnyGroup = sourceChannelInAnyGroup(channelGroups, sc.id);
    const viaActiveGroup = isDisplayedViaActiveGroup(
      sc.id,
      activeChannelGroup,
      channelGroupRowVisibilities,
    );
    const shownInViewer = viaActiveGroup || stackOn;
    const im = images.find((i) => i.id === sc.imageId);
    const imageLabel = im?.basename?.trim() ?? "";
    const meta = imageLabel
      ? `${imageLabel} · index ${sc.index}`
      : `Index ${sc.index}`;

    const toggleAllChannelsVisibility = (nextVisible: boolean) => {
      if (viaActiveGroup && activeRow) {
        setChannelGroupRowVisibilities({
          ...channelGroupRowVisibilities,
          [activeRow.id]: nextVisible,
        });
        return;
      }
      setChannelVisibilities({
        ...channelVisibilities,
        [sc.id]: nextVisible,
      });
    };

    const dragHandle = (
      <ChannelDragHandle
        label={sc.name}
        onDragStart={(e) => startChannelDrag(e, { sourceId: sc.id })}
      />
    );

    // Contrast/histogram live on the group row when this source is grouped.
    if (inAnyGroup) {
      return (
        <li
          key={`all-${sc.id}`}
          className={[
            styles.rootChannelBlock,
            styles.rootChannelBlockCompact,
          ].join(" ")}
        >
          <div className={styles.rootChannelRowWrap}>
            {dragHandle}
            <ChannelRow
              rowClassName={styles.rootChannelRow}
              compact
              visible={shownInViewer}
              visibilityTitle={allChannelsLayerTitle(
                sc,
                shownInViewer,
                viaActiveGroup,
              )}
              visibilityAriaLabel={`Toggle layer for ${sc.name}`}
              onToggleVisibility={() =>
                toggleAllChannelsVisibility(!shownInViewer)
              }
              name={{
                mode: "label",
                name: sc.name,
                title: meta,
                className: styles.rootChannelCompactName,
              }}
            />
          </div>
        </li>
      );
    }

    const capped =
      isImageChannel(sc) && stackOn && !visibleIntensitySourceIds.has(sc.id);
    const colorIdx = sourceChannels.findIndex((c) => c.id === sc.id);
    const displayColor = effectiveDisplayColor(
      sc,
      sourceChannels,
      null,
      colorIdx >= 0 ? colorIdx : 0,
    );
    const displayLimits = effectiveSourceLimits(sc);
    const hex = rgbToHex(displayColor);

    if (!shownInViewer) {
      return (
        <li
          key={`all-${sc.id}`}
          className={[
            styles.rootChannelBlock,
            styles.rootChannelBlockCompact,
          ].join(" ")}
        >
          <div className={styles.rootChannelRowWrap}>
            {dragHandle}
            <ChannelRow
              rowClassName={styles.rootChannelRow}
              compact
              visible={false}
              visibilityTitle={stackLayerTitle(sc, false)}
              visibilityAriaLabel={`Toggle layer for ${sc.name}`}
              onToggleVisibility={() => toggleAllChannelsVisibility(true)}
              name={{
                mode: "label",
                name: sc.name,
                title: meta,
                className: styles.rootChannelCompactName,
              }}
            />
          </div>
        </li>
      );
    }

    const rgbDisplay = isRgbDisplayChannel(sc, sourceChannels);
    const showHistogramEmbed = isImageChannel(sc) && !rgbDisplay;
    const legacyItem = showHistogramEmbed
      ? React.createElement(props.channelItemElement, {
          key: `all-${sc.id}`,
          ...channelItemAttrsForSource(
            channelRendering,
            sc,
            displayColor,
            displayLimits,
          ),
          histogram_loading: loadingHistogramSourceIds.includes(sc.id)
            ? "true"
            : "false",
        })
      : null;

    return (
      <li key={`all-${sc.id}`} className={styles.rootChannelBlock}>
        <div className={styles.rootChannelRowWrap}>
          {dragHandle}
          {rgbDisplay ? (
            <ChannelRow
              rowClassName={styles.rootChannelRow}
              compact
              visible
              visibilityTitle={
                capped
                  ? `Over Viv limit (${MAX_VIV_INTENSITY_CHANNELS}) — hide another channel`
                  : stackLayerTitle(sc, true)
              }
              visibilityAriaLabel={`Toggle layer for ${sc.name}`}
              onToggleVisibility={() => toggleAllChannelsVisibility(false)}
              name={{
                mode: "editable",
                name: sc.name,
                meta,
                onBlur: (value) => renameSourceChannelDisplayName(sc.id, value),
              }}
              imageSubtitle={showImageBadge && imageLabel ? imageLabel : null}
            />
          ) : (
            <ChannelRow
              rowClassName={styles.rootChannelRow}
              visible
              visibilityTitle={
                capped
                  ? `Over Viv limit (${MAX_VIV_INTENSITY_CHANNELS}) — hide another channel`
                  : stackLayerTitle(sc, true)
              }
              visibilityAriaLabel={`Toggle layer for ${sc.name}`}
              onToggleVisibility={() => toggleAllChannelsVisibility(false)}
              name={{
                mode: "editable",
                name: sc.name,
                meta,
                onBlur: (value) => renameSourceChannelDisplayName(sc.id, value),
              }}
              imageSubtitle={showImageBadge && imageLabel ? imageLabel : null}
              {...(isMaskChannel(sc)
                ? {
                    isMask: true as const,
                    maskVisualization: effectiveMaskVisualization(sc),
                    maskAriaLabel: `Mask display for ${sc.name}`,
                    onMaskVisualizationChange: (viz) =>
                      setSourceMaskVisualization(sc.id, viz),
                  }
                : {
                    colorHex: hex,
                    colorTitle: `Pick color for ${sc.name}`,
                    colorAriaLabel: `Pick color for ${sc.name}`,
                    onColorClick: (e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setColorPickerTarget({
                        scope: "source",
                        sourceId: sc.id,
                      });
                      setColorPickerPos(chromeColorPickerAnchorPosition(rect));
                    },
                  })}
            />
          )}
        </div>
        {legacyItem ? (
          <div className={styles.detailChannelItemEmbed}>{legacyItem}</div>
        ) : null}
      </li>
    );
  };

  return (
    <div className={[styles.panel, styles.black].join(" ")}>
      <div className={styles.compactHeader}>
        <div className={styles.headerTitle}>
          <span className={styles.headerCount}>Channels</span>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerActionButton}
            onClick={createGroup}
            title="Add group"
            aria-label="Add group"
          >
            Add group
          </button>
        </div>
      </div>

      {optimizePaletteMessage ? (
        <output className={styles.optimizePaletteMessage}>
          {optimizePaletteMessage}
        </output>
      ) : null}

      <div className={styles.treeScroll}>
        {channelGroups.length > 0 ? (
          <div className={styles.groupFolders}>
            {channelGroups.map(renderGroupFolder)}
          </div>
        ) : null}

        <div className={styles.treeSeparator}>All Channels</div>

        {uniqueSourceChannels.length === 0 ? (
          <div className={styles.emptyMessage}>No channels loaded</div>
        ) : (
          <ul className={styles.rootChannelList}>
            {allChannelsOrdered.map(renderAllChannelsRow)}
          </ul>
        )}

        {imageSelectionMask ? (
          <ChannelRow
            rowClassName={[
              styles.rootChannelRow,
              styles.rootChannelRowInline,
            ].join(" ")}
            visible={selectionMaskVisible}
            visibilityTitle="Toggle selection mask visibility"
            visibilityAriaLabel="Toggle selection mask visibility"
            onToggleVisibility={() => {
              setChannelVisibilities({
                ...channelVisibilities,
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
            onMaskVisualizationChange={setImageSelectionMaskVisualization}
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

      {colorPickerTarget && colorPickerPos && pickingColorHex ? (
        <ChromeColorPickerPopover
          position={colorPickerPos}
          onClose={closeColorPicker}
          color={`#${pickingColorHex}`}
          showAlpha={false}
          onChange={(c) => {
            const raw = c.hex.replace(/^#/, "").slice(0, 6);
            if (raw.length < 6) return;
            const R = Number.parseInt(raw.slice(0, 2), 16);
            const G = Number.parseInt(raw.slice(2, 4), 16);
            const B = Number.parseInt(raw.slice(4, 6), 16);
            if ([R, G, B].some((n) => Number.isNaN(n))) return;
            const sourceId =
              colorPickerTarget.scope === "source"
                ? colorPickerTarget.sourceId
                : useDocumentStore
                    .getState()
                    .channelGroups.find(
                      (g) => g.id === colorPickerTarget.groupId,
                    )
                    ?.channels.find((gc) => gc.id === colorPickerTarget.rowId)
                    ?.channelId;
            if (!sourceId) return;
            useAppStore.getState().setChannelRendering({
              kind: "color",
              sourceChannelId: sourceId,
              r: R,
              g: G,
              b: B,
            });
          }}
        />
      ) : null}
    </div>
  );
};

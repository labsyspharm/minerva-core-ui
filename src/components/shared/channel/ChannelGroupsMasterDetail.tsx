import * as React from "react";
import {
  ChromeColorPickerPopover,
  chromeColorPickerAnchorPosition,
} from "@/components/shared/ChromeColorPickerPopover";
import {
  ChannelContrastEditor,
  type ChannelContrastEditorProps,
} from "@/components/shared/channel/ChannelContrastEditor";
import { ChannelRow, rgbToHex } from "@/components/shared/channel/ChannelRow";
import { ChannelVisibilitySwatch } from "@/components/shared/channel/ChannelVisibilitySwatch";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import { PlusIcon } from "@/components/shared/common/PlusIcon";
import { TrashIcon } from "@/components/shared/common/TrashIcon";
import LockIcon from "@/components/shared/icons/lock.svg?react";
import LockOpenIcon from "@/components/shared/icons/lock-open.svg?react";
import { CompactHeader } from "@/components/shared/panel/CompactHeader";
import {
  PanelActionButton,
  PanelIconButton,
} from "@/components/shared/panel/PanelButtons";
import chrome from "@/components/shared/panel/panelChrome.module.css";
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
} from "@/lib/imaging/pseudoPalette";
import {
  effectiveDisplayColor,
  effectiveMaskVisualization,
  effectiveSourceColor,
  effectiveSourceLimits,
} from "@/lib/imaging/sourceChannelStyle";
import { MAX_VIV_INTENSITY_CHANNELS } from "@/lib/imaging/viv";
import { type ChannelRendering, useAppStore } from "@/lib/stores/appStore";
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
import styles from "./channelShared.module.css";

const CHANNEL_DRAG_MIME = "application/x-minerva-channel-ref";

function colorRenderingForSource(
  live: ChannelRendering | null,
  sourceChannelId: string,
): Extract<ChannelRendering, { kind: "color" }> | null {
  if (live?.kind === "color" && live.sourceChannelId === sourceChannelId) {
    return live;
  }
  return null;
}

function contrastRenderingForSource(
  live: ChannelRendering | null,
  sourceChannelId: string,
): Extract<ChannelRendering, { kind: "contrast" }> | null {
  if (live?.kind === "contrast" && live.sourceChannelId === sourceChannelId) {
    return live;
  }
  return null;
}

function contrastEditorPropsForSource(
  channelRendering: ChannelRendering | null,
  sc: Channel,
  color: { r?: number; g?: number; b?: number },
  limits: [number, number],
): ChannelContrastEditorProps {
  const liveColor = colorRenderingForSource(channelRendering, sc.id);
  const c = liveColor ?? color;
  const liveContrast = contrastRenderingForSource(channelRendering, sc.id);
  return {
    groupId: "",
    channelId: sc.id,
    sourceChannelId: sc.id,
    r: c.r ?? 0,
    g: c.g ?? 0,
    b: c.b ?? 0,
    lowerLimit: liveContrast ? liveContrast.lower : limits[0],
    upperLimit: liveContrast ? liveContrast.upper : limits[1],
    distribution: sc.sourceDistribution ?? null,
  };
}

function contrastEditorPropsForGroupRow(
  channelRendering: ChannelRendering | null,
  groupId: string,
  gc: ChannelGroupChannel,
  sc: Channel | undefined,
): ChannelContrastEditorProps {
  const sourceId = sc?.id ?? gc.channelId;
  const liveColor = colorRenderingForSource(channelRendering, sourceId);
  const c = liveColor ?? gc.color;
  const liveContrast = contrastRenderingForSource(channelRendering, sourceId);
  return {
    groupId,
    channelId: gc.id,
    sourceChannelId: sourceId,
    r: c.r ?? 0,
    g: c.g ?? 0,
    b: c.b ?? 0,
    lowerLimit: liveContrast ? liveContrast.lower : gc.lowerLimit,
    upperLimit: liveContrast ? liveContrast.upper : gc.upperLimit,
    distribution: sc?.sourceDistribution ?? null,
  };
}

type ChannelDragPayload = {
  sourceId: string;
  fromGroupId?: string;
};

type ColorPickerTarget =
  | { scope: "source"; sourceId: string }
  | { scope: "group"; groupId: string; rowId: string };

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
  // Prefer fitted auto-contrast (`gmmContrastLimits`) over import seed limits.
  const [srcLo, srcHi] = effectiveSourceLimits(sc);
  const idx = sourceChannels.findIndex((c) => c.id === sc.id);
  const srcColor = effectiveSourceColor(sc, idx >= 0 ? idx : 0, sourceChannels);
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

export type ChannelGroupsMasterDetailProps = {
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
  const [refittingContrastIds, setRefittingContrastIds] = React.useState(
    () => new Set<string>(),
  );
  const [dragOverGroupId, setDragOverGroupId] = React.useState<string | null>(
    null,
  );
  const [lockedColorRowIdsByGroup, setLockedColorRowIdsByGroup] =
    React.useState<Map<string, Set<string>>>(() => new Map());

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

  const createGroup = async () => {
    const seedingFirst = channelGroups.length === 0;
    const toSeed = seedingFirst
      ? uniqueSourceChannels.filter((sc) =>
          isStackVisible(channelVisibilities, sc.id),
        )
      : [];

    // First group is seeded from the currently visible stack channels — ensure
    // auto-contrast has run so we don't bake in import-default limits.
    if (seedingFirst && toSeed.length > 0 && ensureChannelGmmContrastLimits) {
      const needFit = toSeed.filter(
        (sc) => !isMaskChannel(sc) && !sc.gmmContrastLimits,
      );
      if (needFit.length > 0) {
        try {
          await ensureChannelGmmContrastLimits(needFit.map((sc) => sc.id));
        } catch {
          /* ignore — fall back to whatever limits are on the source */
        }
      }
    }

    const sourcesNow = flattenImageChannelsInDocumentOrder(
      useDocumentStore.getState().images,
    );
    const seededChannels = seedingFirst
      ? toSeed.map((sc) => {
          const fresh = sourcesNow.find((c) => c.id === sc.id) ?? sc;
          const i = toSeed.findIndex((s) => s.id === sc.id);
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
      const stackOff = { ...useAppStore.getState().channelVisibilities };
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
    for (const gc of group.channels) next[gc.id] = !allOn;
    setChannelGroupRowVisibilities(next);
  };

  const { ensureChannelGmmContrastLimits, ensureChannelHistograms } = props;

  const refitAutoContrast = React.useCallback(
    async (sourceChannelId: string) => {
      if (!ensureChannelGmmContrastLimits) return;
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
        await ensureChannelGmmContrastLimits([sourceChannelId], {
          overwriteExistingLimits: true,
        });
      } catch {
        /* ignore — keep prior limits */
      } finally {
        setRefittingContrastIds((prev) => {
          const next = new Set(prev);
          next.delete(sourceChannelId);
          return next;
        });
      }
    },
    [ensureChannelGmmContrastLimits, sourceChannels],
  );

  const autoContrastActionButton = (sc: Channel | undefined, name: string) => {
    if (
      !sc ||
      !ensureChannelGmmContrastLimits ||
      isMaskChannel(sc) ||
      isRgbDisplayChannel(sc, sourceChannels)
    ) {
      return null;
    }
    const busy = refittingContrastIds.has(sc.id);
    return (
      <button
        type="button"
        className={styles.channelActionButton}
        disabled={busy}
        title="Re-fit contrast with psudo GMM (resets manual limits)"
        aria-label={`Re-fit GMM contrast for ${name}`}
        onClick={() => void refitAutoContrast(sc.id)}
      >
        {busy ? "…" : "Fit"}
      </button>
    );
  };

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
      return;
    }
    const lockedIds = lockedIdsForGroup(groupId);
    setOptimizePaletteBusy(true);
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
      /* ignore — UI stays as-is */
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
   * Fetch histograms for channels that are on in the stack **or** in a group
   * row (group eyes). After seeding a group we turn stack visibility off, so
   * stack-only targeting would never load distributions for grouped channels.
   */
  const visibleHistogramTargets = React.useMemo(() => {
    const ids: string[] = [];
    for (const sc of uniqueSourceChannels) {
      if (!isImageChannel(sc)) continue;
      if (isRgbDisplayChannel(sc, sourceChannels)) continue;
      if (sourceDistributionYValuesLength(sc) > 0) continue;

      const stackOn = isStackVisible(channelVisibilities, sc.id);
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
    channelVisibilities,
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

  const renderGroupFolder = (group: ChannelGroup, groupIndex: number) => {
    const expanded = group.expanded ?? groupIndex === 0;
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
          isActive ? styles.groupFolderActive : "",
          isDropTarget ? styles.dropTargetActive : "",
        ].join(" ")}
        {...folderDropProps}
      >
        <div className={styles.groupFolderHeader}>
          <button
            type="button"
            className={styles.groupFolderActivate}
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
                const contrastEditor =
                  sc && isImageChannel(sc) && visible && !rgbDisplay ? (
                    <ChannelContrastEditor
                      key={`grp-${group.id}-${gc.id}`}
                      {...contrastEditorPropsForGroupRow(
                        channelRendering,
                        group.id,
                        gc,
                        sc,
                      )}
                      histogramLoading={loadingHistogramSourceIds.includes(
                        sc.id,
                      )}
                    />
                  ) : null;

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
                const colorLocked = lockedIds.has(gc.id);
                const showColorLock = kind !== "mask" && !rgbDisplay;

                return (
                  <li
                    key={gc.id}
                    className={[
                      styles.groupChildBlock,
                      colorLocked ? styles.detailChannelRowLocked : "",
                    ].join(" ")}
                  >
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
                            <div className={styles.channelActionCluster}>
                              {autoContrastActionButton(sc, name)}
                              <button
                                type="button"
                                className={styles.channelActionButton}
                                title="Remove from group"
                                aria-label={`Remove ${name} from group`}
                                onClick={() =>
                                  removeChannelFromGroup(group.id, gc.id)
                                }
                              >
                                <TrashIcon
                                  title="Remove from group"
                                  size={12}
                                />
                              </button>
                            </div>
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
                            <div className={styles.channelActionCluster}>
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
                              {kind === "mask"
                                ? null
                                : autoContrastActionButton(sc, name)}
                              <button
                                type="button"
                                className={styles.channelActionButton}
                                title="Remove from group"
                                aria-label={`Remove ${name} from group`}
                                onClick={() =>
                                  removeChannelFromGroup(group.id, gc.id)
                                }
                              >
                                <TrashIcon
                                  title="Remove from group"
                                  size={12}
                                />
                              </button>
                            </div>
                          }
                        />
                      )}
                    </div>
                    {contrastEditor ? (
                      <div className={styles.detailChannelItemEmbed}>
                        {contrastEditor}
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
    const shownInViewer = inAnyGroup
      ? activeRow
        ? viaActiveGroup
        : false
      : viaActiveGroup || stackOn;
    const im = images.find((i) => i.id === sc.imageId);
    const imageLabel = im?.basename?.trim() ?? "";
    const meta = imageLabel
      ? `${imageLabel} · index ${sc.index}`
      : `Index ${sc.index}`;

    const toggleAllChannelsVisibility = (nextVisible: boolean) => {
      if (activeRow) {
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
              visibilityTitle={
                activeRow
                  ? shownInViewer
                    ? `Hide ${sc.name} in active group`
                    : `Show ${sc.name} in active group`
                  : allChannelsLayerTitle(sc, shownInViewer, viaActiveGroup)
              }
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
    const contrastEditor = showHistogramEmbed ? (
      <ChannelContrastEditor
        key={`all-${sc.id}`}
        {...contrastEditorPropsForSource(
          channelRendering,
          sc,
          displayColor,
          displayLimits,
        )}
        histogramLoading={loadingHistogramSourceIds.includes(sc.id)}
      />
    ) : null;

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
              trailing={autoContrastActionButton(sc, sc.name)}
            />
          )}
        </div>
        {contrastEditor ? (
          <div className={styles.detailChannelItemEmbed}>{contrastEditor}</div>
        ) : null}
      </li>
    );
  };

  const activeGroup = channelGroups.find((g) => g.id === activeChannelGroupId);
  const canOptimizeActiveGroup =
    !!activeGroup &&
    isGroupEligibleForPsudoOptimize(activeGroup, sourceChannels);

  return (
    <div className={chrome.authorPanel}>
      <CompactHeader
        title="Channel Groups"
        actions={
          <>
            <PanelActionButton
              disabled={!canOptimizeActiveGroup || optimizePaletteBusy}
              title={
                !activeGroup
                  ? "Select a group first"
                  : canOptimizeActiveGroup
                    ? "Optimize colors"
                    : "Need at least two non-RGB channels"
              }
              aria-label="Optimize colors"
              onClick={() => {
                if (!activeGroup) return;
                void runOptimizePaletteForGroup(activeGroup.id);
              }}
            >
              Optimize colors
            </PanelActionButton>
            <PanelIconButton
              title="Delete active group"
              aria-label="Delete group"
              disabled={!activeGroup}
              onClick={() => {
                if (!activeGroup) return;
                deleteGroup(activeGroup.id);
              }}
            >
              <TrashIcon />
            </PanelIconButton>
            <PanelIconButton
              title="Add group"
              aria-label="Add group"
              onClick={createGroup}
            >
              <PlusIcon />
            </PanelIconButton>
          </>
        }
      />

      <div className={[chrome.authorPanelBody, chrome.thinScrollbar].join(" ")}>
        {channelGroups.length > 0 ? (
          <div className={styles.groupFolders}>
            {channelGroups.map((group, i) => renderGroupFolder(group, i))}
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

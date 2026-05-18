import * as React from "react";
import {
  ChromeColorPickerPopover,
  chromeColorPickerAnchorPosition,
} from "@/components/shared/ChromeColorPickerPopover";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import { sourceDistributionYValuesLength } from "@/lib/imaging/histogramLazy";
import {
  applyOptimizedColorsToChannelGroup,
  IMPORT_DEFAULT_LOWER_LIMIT,
  IMPORT_DEFAULT_UPPER_LIMIT,
  isGroupEligibleForPsudoOptimize,
  lockedRowIdsForGroup,
  optimizeChannelGroupWithLocks,
  seedRgbForGroupChannelIndex,
  warmupPsudoPalette,
} from "@/lib/imaging/psudoPalette";
import type { ChannelRendering } from "@/lib/stores/appStore";
import { useAppStore } from "@/lib/stores/appStore";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import {
  documentChannelGroups,
  documentSourceChannels,
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import styles from "./ChannelList.module.css";

const TrashIcon = () => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

const PlusIcon = () => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

const ReplaceIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <title>Replace channel</title>
    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
  </svg>
);

const RemoveIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <title>Remove channel</title>
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

const PinIcon = () => (
  <svg
    aria-hidden="true"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
  </svg>
);

const EMPTY_LOCKED_ROW_IDS = new Set<string>();

function channelNamesForGroup(
  group: ChannelGroup,
  sourceChannels: Channel[],
): string[] {
  return (group.channels ?? [])
    .map((gc) => findSourceChannel(sourceChannels, gc.channelId))
    .filter((sc): sc is Channel => sc != null)
    .map((sc) => sc.name);
}

/** Active color-only in-flight render for this group/channel, if any. */
function colorRenderingFor(
  live: ChannelRendering | null,
  groupId: string,
  channelId: string,
): Extract<ChannelRendering, { kind: "color" }> | null {
  if (
    live?.kind === "color" &&
    live.groupId === groupId &&
    live.channelId === channelId
  ) {
    return live;
  }
  return null;
}

/** Active contrast-only in-flight render for this group/channel, if any. */
function contrastRenderingFor(
  live: ChannelRendering | null,
  groupId: string,
  channelId: string,
): Extract<ChannelRendering, { kind: "contrast" }> | null {
  if (
    live?.kind === "contrast" &&
    live.groupId === groupId &&
    live.channelId === channelId
  ) {
    return live;
  }
  return null;
}

export type ChannelGroupsMasterDetailProps = {
  channelItemElement: string;
  noLoader: boolean;
  /** OME-TIFF: lazy-load histograms for visible source indices (see `histogramLazy.ts`). */
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
};

export const ChannelGroupsMasterDetail = (
  props: ChannelGroupsMasterDetailProps,
) => {
  const { setActiveChannelGroup } = useAppStore();
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const sourceChannels = React.useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );

  /** One listing per `Channel.id` (first occurrence in image order) — avoids duplicate rows if the same id appears twice after hydrate/reload. */
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

  /**
   * One row per distinct display name. Each image in the document often has its own
   * channel UUIDs with the same labels as other images; listing by id repeats the
   * entire block once per image (mistaken for “duplicates” or HMR bugs).
   */
  const channelNamesTabRows = React.useMemo(() => {
    const seenName = new Set<string>();
    const out: Channel[] = [];
    for (const sc of uniqueSourceChannels) {
      if (seenName.has(sc.name)) continue;
      seenName.add(sc.name);
      out.push(sc);
    }
    return out;
  }, [uniqueSourceChannels]);

  const setChannelGroups = useDocumentStore((s) => s.setChannelGroups);
  const setImages = useDocumentStore((s) => s.setImages);
  const setGroupNames = useAppStore((s) => s.setGroupNames);
  const setGroupChannelLists = useAppStore((s) => s.setGroupChannelLists);
  const setChannelVisibilities = useAppStore((s) => s.setChannelVisibilities);

  const detailBodyRef = React.useRef<HTMLDivElement | null>(null);
  const renameFieldId = React.useId();

  // Master-detail state
  const [detailGroupId, setDetailGroupId] = React.useState<string | null>(null);
  /** Left column: group membership vs renaming source-channel display names */
  const [channelPanelTab, setChannelPanelTab] = React.useState<
    "groups" | "names"
  >("groups");
  /** Source channel UUIDs currently fetching histogram tiles (spinner on each chart). */
  const [loadingHistogramSourceIds, setLoadingHistogramSourceIds] =
    React.useState<string[]>([]);

  // Editing state
  const [replacingChannelUUID, setReplacingChannelUUID] = React.useState<
    string | null
  >(null);
  const replaceChannelSelectRef = React.useRef<HTMLSelectElement | null>(null);
  const [colorPickerChannelUUID, setColorPickerChannelUUID] = React.useState<
    string | null
  >(null);
  const [colorPickerGroupId, setColorPickerGroupId] = React.useState<
    string | null
  >(null);
  const [colorPickerPos, setColorPickerPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [optimizePaletteBusy, setOptimizePaletteBusy] = React.useState(false);
  const [optimizePaletteMessage, setOptimizePaletteMessage] = React.useState<
    string | null
  >(null);
  /** Per-group channel row ids with locked pseudocolors (session-only). */
  const [lockedColorRowIdsByGroup, setLockedColorRowIdsByGroup] =
    React.useState<Map<string, Set<string>>>(() => new Map());

  const channelRendering = useAppStore((s) => s.channelRendering);

  // When opening or switching the detail group, close the replace-channel control.
  // When detail context changes at all (including back to list), drop in-flight color
  // rendering and close the picker — those are scoped to the detail editor.
  React.useEffect(() => {
    if (detailGroupId) {
      setReplacingChannelUUID(null);
    }
    useAppStore.getState().clearChannelRendering();
    setColorPickerChannelUUID(null);
    setColorPickerGroupId(null);
    setColorPickerPos(null);
    setOptimizePaletteMessage(null);
  }, [detailGroupId]);

  React.useEffect(() => {
    if (replacingChannelUUID === null) return;
    const id = window.requestAnimationFrame(() => {
      replaceChannelSelectRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [replacingChannelUUID]);

  const detailGroup = detailGroupId
    ? (channelGroups.find((g) => g.id === detailGroupId) ?? null)
    : null;

  const detailGroupPsudoEligible = detailGroup
    ? isGroupEligibleForPsudoOptimize(detailGroup, sourceChannels)
    : false;

  const detailGroupLockedRowIds = detailGroup
    ? (lockedColorRowIdsByGroup.get(detailGroup.id) ?? EMPTY_LOCKED_ROW_IDS)
    : EMPTY_LOCKED_ROW_IDS;

  const detailGroupAllColorsLocked =
    detailGroup != null &&
    detailGroup.channels.length > 0 &&
    detailGroup.channels.every((gc) => detailGroupLockedRowIds.has(gc.id));

  const setGroupColorLocks = React.useCallback(
    (groupId: string, next: Set<string>) => {
      setLockedColorRowIdsByGroup((prev) => {
        const map = new Map(prev);
        if (next.size === 0) {
          map.delete(groupId);
        } else {
          map.set(groupId, next);
        }
        return map;
      });
    },
    [],
  );

  const toggleColorLock = React.useCallback(
    (groupId: string, rowId: string) => {
      setLockedColorRowIdsByGroup((prev) => {
        const map = new Map(prev);
        const current = new Set(map.get(groupId) ?? []);
        if (current.has(rowId)) {
          current.delete(rowId);
        } else {
          current.add(rowId);
        }
        if (current.size === 0) {
          map.delete(groupId);
        } else {
          map.set(groupId, current);
        }
        return map;
      });
    },
    [],
  );

  const lockAllColorsInGroup = React.useCallback(
    (groupId: string) => {
      const g = useDocumentStore
        .getState()
        .channelGroups.find((x) => x.id === groupId);
      if (!g) return;
      setGroupColorLocks(groupId, new Set(g.channels.map((gc) => gc.id)));
    },
    [setGroupColorLocks],
  );

  const unlockAllColorsInGroup = React.useCallback(
    (groupId: string) => {
      setGroupColorLocks(groupId, new Set());
    },
    [setGroupColorLocks],
  );

  const pruneColorLock = React.useCallback((groupId: string, rowId: string) => {
    setLockedColorRowIdsByGroup((prev) => {
      const current = prev.get(groupId);
      if (!current?.has(rowId)) return prev;
      const map = new Map(prev);
      const next = new Set(current);
      next.delete(rowId);
      if (next.size === 0) {
        map.delete(groupId);
      } else {
        map.set(groupId, next);
      }
      return map;
    });
  }, []);

  React.useEffect(() => {
    if (!detailGroupId || !detailGroupPsudoEligible) return;
    void warmupPsudoPalette();
  }, [detailGroupId, detailGroupPsudoEligible]);

  // Sync derived store state after group mutations.
  const syncGroupState = React.useCallback(
    (newGroups: ChannelGroup[]) => {
      setChannelGroups(newGroups);
      setGroupNames(
        Object.fromEntries(newGroups.map(({ name, id }) => [id, name])),
      );
      const lists = Object.fromEntries(
        newGroups.map(({ name, channels }) => [
          name,
          channels
            .map((gc) => findSourceChannel(sourceChannels, gc.channelId))
            .filter(Boolean)
            .map((sc) => sc?.name),
        ]),
      );
      setGroupChannelLists(lists);
      const namesInUse = new Set<string>();
      for (const g of newGroups) {
        for (const gc of g.channels) {
          const sc = findSourceChannel(sourceChannels, gc.channelId);
          if (sc?.name) {
            namesInUse.add(sc.name);
          }
        }
      }
      const prev = useAppStore.getState().channelVisibilities;
      const merged = { ...prev };
      for (const name of namesInUse) {
        if (merged[name] === undefined) {
          merged[name] = true;
        }
      }
      setChannelVisibilities(merged);
    },
    [
      sourceChannels,
      setChannelGroups,
      setGroupNames,
      setGroupChannelLists,
      setChannelVisibilities,
    ],
  );

  const runOptimizePalette = React.useCallback(async () => {
    if (!detailGroup || optimizePaletteBusy) return;
    if (!isGroupEligibleForPsudoOptimize(detailGroup, sourceChannels)) {
      setOptimizePaletteMessage(
        "Need at least two non-RGB channels to optimize colors.",
      );
      return;
    }
    const lockedIds =
      lockedColorRowIdsByGroup.get(detailGroup.id) ?? EMPTY_LOCKED_ROW_IDS;
    if (
      detailGroup.channels.length > 0 &&
      detailGroup.channels.every((gc) => lockedIds.has(gc.id))
    ) {
      setOptimizePaletteMessage("Unlock at least one channel to optimize.");
      return;
    }
    useAppStore.getState().clearChannelRendering();
    setOptimizePaletteBusy(true);
    setOptimizePaletteMessage(null);
    try {
      const group =
        useDocumentStore
          .getState()
          .channelGroups.find((g) => g.id === detailGroup.id) ?? detailGroup;
      const colors = await optimizeChannelGroupWithLocks(
        group,
        sourceChannels,
        lockedIds,
      );
      const newGroups = applyOptimizedColorsToChannelGroup(
        useDocumentStore.getState().channelGroups,
        detailGroup.id,
        colors,
        { lockedChannelRowIds: lockedIds },
      );
      syncGroupState(newGroups);
      const nLocked = lockedIds.size;
      setOptimizePaletteMessage(
        nLocked > 0
          ? `Palette optimized (${nLocked} locked).`
          : "Palette optimized.",
      );
    } catch (e) {
      setOptimizePaletteMessage(
        e instanceof Error ? e.message : "Could not optimize palette.",
      );
    } finally {
      setOptimizePaletteBusy(false);
    }
  }, [
    detailGroup,
    optimizePaletteBusy,
    sourceChannels,
    syncGroupState,
    lockedColorRowIdsByGroup,
  ]);

  /** Persisted source channel label for one `ImageChannel.id`; updates visibility (name keys) and group lists. */
  const renameSourceChannelDisplayName = React.useCallback(
    (channelId: string, rawName: string) => {
      const trimmed = rawName.trim();
      if (!trimmed) return;
      const doc = useDocumentStore.getState();
      const flatBefore = flattenImageChannelsInDocumentOrder(doc.images);
      const prev = findSourceChannel(flatBefore, channelId);
      if (!prev || prev.name === trimmed) return;

      const oldName = prev.name;

      const nextImages = doc.images.map((im) => ({
        ...im,
        channels: im.channels.map((ch) =>
          ch.id === channelId ? { ...ch, name: trimmed } : ch,
        ),
      }));
      setImages(nextImages);

      const flatAfter = flattenImageChannelsInDocumentOrder(nextImages);
      const stillUsesOldName = flatAfter.some((c) => c.name === oldName);

      const vis = useAppStore.getState().channelVisibilities;
      const nextVis = { ...vis };
      if (nextVis[trimmed] === undefined) {
        nextVis[trimmed] = nextVis[oldName] ?? true;
      }
      if (!stillUsesOldName && oldName !== trimmed) {
        delete nextVis[oldName];
      }
      setChannelVisibilities(nextVis);

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
    [setImages, setChannelVisibilities, setGroupChannelLists],
  );

  // --- Group CRUD ---
  const createGroup = () => {
    const name = `Group ${channelGroups.length + 1}`;
    const newGroup: ChannelGroup = {
      id: crypto.randomUUID(),
      name,
      expanded: true,
      channels: [],
    };
    const newGroups = [...channelGroups, newGroup];
    syncGroupState(newGroups);
    setActiveChannelGroup(newGroup.id);
    setDetailGroupId(newGroup.id);
    requestAnimationFrame(() => {
      detailBodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const deleteGroup = (groupId: string) => {
    if (channelGroups.length <= 1) return;
    const newGroups = channelGroups.filter(({ id }) => id !== groupId);
    syncGroupState(newGroups);
    if (activeChannelGroupId === groupId) {
      setActiveChannelGroup(newGroups[0].id);
    }
    if (detailGroupId === groupId) {
      setDetailGroupId(null);
    }
  };

  const renameGroup = (groupId: string, newName: string) => {
    const newGroups = channelGroups.map((g) =>
      g.id === groupId ? { ...g, name: newName } : g,
    );
    syncGroupState(newGroups);
  };

  const addChannelToGroup = React.useCallback(
    async (groupId: string, sourceChannelUUID: string) => {
      if (optimizePaletteBusy) return;
      const group = channelGroups.find((g) => g.id === groupId);
      if (!group) return;
      const sc = sourceChannels.find(({ id }) => id === sourceChannelUUID);
      if (!sc) return;
      if (group.channels.some((gc) => gc.channelId === sourceChannelUUID)) {
        return;
      }

      const lockedIds = lockedRowIdsForGroup(group);
      const slotIndex = group.channels.length;
      const seed = seedRgbForGroupChannelIndex(slotIndex);
      const newChannel = {
        id: crypto.randomUUID(),
        lowerLimit: IMPORT_DEFAULT_LOWER_LIMIT,
        upperLimit: IMPORT_DEFAULT_UPPER_LIMIT,
        color: { r: seed.r, g: seed.g, b: seed.b },
        channelId: sc.id,
      };

      const newGroups = channelGroups.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, channels: [...g.channels, newChannel] };
      });

      const updatedGroup = newGroups.find((g) => g.id === groupId);
      if (
        !updatedGroup ||
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
        const optimizedGroups = applyOptimizedColorsToChannelGroup(
          newGroups,
          groupId,
          colors,
          { lockedChannelRowIds: lockedIds },
        );
        syncGroupState(optimizedGroups);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn("[psudo] add-channel palette optimization failed", e);
        }
        syncGroupState(newGroups);
      } finally {
        setOptimizePaletteBusy(false);
      }
    },
    [channelGroups, sourceChannels, syncGroupState, optimizePaletteBusy],
  );

  const removeChannelFromGroup = (groupId: string, channelUUID: string) => {
    const newGroups = channelGroups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        channels: g.channels.filter((gc) => gc.id !== channelUUID),
      };
    });
    syncGroupState(newGroups);
    pruneColorLock(groupId, channelUUID);
  };

  const replaceChannelInGroup = (
    groupId: string,
    oldChannelUUID: string,
    newSourceChannelUUID: string,
  ) => {
    const newSc = sourceChannels.find(({ id }) => id === newSourceChannelUUID);
    if (!newSc) {
      setReplacingChannelUUID(null);
      return;
    }
    const newGroups = channelGroups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        channels: g.channels.map((gc) => {
          if (gc.id !== oldChannelUUID) return gc;
          return {
            ...gc,
            channelId: newSc.id,
          };
        }),
      };
    });
    syncGroupState(newGroups);
    setReplacingChannelUUID(null);
  };

  const pickingColorHex = React.useMemo(() => {
    if (!colorPickerChannelUUID) return null;
    if (colorPickerGroupId) {
      const live = colorRenderingFor(
        channelRendering,
        colorPickerGroupId,
        colorPickerChannelUUID,
      );
      if (live) {
        const { r, g, b } = live;
        return [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
      }
      const g = channelGroups.find((cg) => cg.id === colorPickerGroupId);
      const gc = g?.channels.find((c) => c.id === colorPickerChannelUUID);
      if (gc) {
        const { r, g: gg, b } = gc.color;
        return [r, gg, b].map((n) => n.toString(16).padStart(2, "0")).join("");
      }
      return null;
    }
    for (const g of channelGroups) {
      const gc = g.channels.find((c) => c.id === colorPickerChannelUUID);
      if (gc) {
        const { r, g: gg, b } = gc.color;
        return [r, gg, b].map((n) => n.toString(16).padStart(2, "0")).join("");
      }
    }
    return null;
  }, [
    channelGroups,
    colorPickerChannelUUID,
    colorPickerGroupId,
    channelRendering,
  ]);

  const closeColorPicker = React.useCallback(() => {
    const live =
      colorPickerChannelUUID && colorPickerGroupId
        ? colorRenderingFor(
            useAppStore.getState().channelRendering,
            colorPickerGroupId,
            colorPickerChannelUUID,
          )
        : null;
    if (live && colorPickerGroupId && colorPickerChannelUUID) {
      const groupId = colorPickerGroupId;
      const channelId = colorPickerChannelUUID;
      const doc = useDocumentStore.getState().channelGroups;
      const newGroups = doc.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              channels: g.channels.map((gc) =>
                gc.id === channelId
                  ? { ...gc, color: { r: live.r, g: live.g, b: live.b } }
                  : gc,
              ),
            },
      );
      syncGroupState(newGroups);
    }
    useAppStore.getState().clearChannelRendering();
    setColorPickerChannelUUID(null);
    setColorPickerGroupId(null);
    setColorPickerPos(null);
  }, [colorPickerChannelUUID, colorPickerGroupId, syncGroupState]);

  const activeGroup =
    activeChannelGroupId ||
    (channelGroups.length > 0 ? channelGroups[0].id : null);

  const { ensureChannelHistograms } = props;

  const detailGroupSourcesKey = React.useMemo(() => {
    if (!detailGroupId) return "";
    const g = channelGroups.find((x) => x.id === detailGroupId);
    if (!g) return "";
    return g.channels.map((gc) => gc.channelId).join("\0");
  }, [detailGroupId, channelGroups]);

  React.useEffect(() => {
    void detailGroupSourcesKey;
    if (!detailGroupId || !ensureChannelHistograms || props.noLoader) return;
    let cancelled = false;
    void (async () => {
      try {
        const st = useDocumentStore.getState();
        const gList = documentChannelGroups(st);
        const scList = documentSourceChannels(st);
        const g = gList.find((x) => x.id === detailGroupId);
        if (!g) return;
        const channelIds: string[] = [];
        for (const gc of g.channels) {
          const sc = findSourceChannel(scList, gc.channelId);
          if (!sc) continue;
          if (sourceDistributionYValuesLength(sc) > 0) continue;
          channelIds.push(sc.id);
        }
        if (channelIds.length === 0 || cancelled) return;
        setLoadingHistogramSourceIds(channelIds);
        await new Promise<void>((r) => {
          requestAnimationFrame(() => r());
        });
        if (cancelled) return;
        await ensureChannelHistograms(channelIds);
      } finally {
        if (!cancelled) {
          setLoadingHistogramSourceIds([]);
        }
      }
    })();
    return () => {
      cancelled = true;
      setLoadingHistogramSourceIds([]);
    };
  }, [
    detailGroupId,
    detailGroupSourcesKey,
    ensureChannelHistograms,
    props.noLoader,
  ]);

  const openDetailForGroup = (groupId: string) => {
    setActiveChannelGroup(groupId);
    setDetailGroupId(groupId);
    requestAnimationFrame(() => {
      detailBodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  // Available channels not yet in the detail group
  const availableChannels = React.useMemo(() => {
    if (!detailGroupId) return [];
    const g = channelGroups.find(({ id }) => id === detailGroupId);
    if (!g) return [];
    const usedFlatIds = new Set(g.channels.map((gc) => gc.channelId));
    return sourceChannels.filter(({ id }) => !usedFlatIds.has(id));
  }, [detailGroupId, channelGroups, sourceChannels]);

  const renderChannelNamesPanel = () => {
    if (channelNamesTabRows.length === 0) {
      return (
        <div className={[styles.panel, styles.channelNamesPanel].join(" ")}>
          <div className={styles.emptyMessage}>No channels loaded</div>
        </div>
      );
    }

    return (
      <div className={[styles.panel, styles.channelNamesPanel].join(" ")}>
        <ul className={styles.channelNamesRows}>
          {channelNamesTabRows.map((sc) => {
            const im = images.find((i) => i.id === sc.imageId);
            const meta = im?.basename
              ? `${im.basename} · index ${sc.index}`
              : `Index ${sc.index}`;
            const nameInputId = `ch-name-${sc.id}`;
            return (
              <li key={sc.id} className={styles.channelNameRow}>
                <div className={styles.channelNameLabel}>
                  <span className={styles.channelNameIndex} title={meta}>
                    {sc.index}
                  </span>
                  <input
                    id={nameInputId}
                    className={`${styles.detailTitleInput} ${styles.channelNameInput}`}
                    type="text"
                    defaultValue={sc.name}
                    maxLength={200}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={`Channel name (${meta})`}
                    onBlur={(e) =>
                      renameSourceChannelDisplayName(sc.id, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  // ── List view ──

  const listHeader = (
    <div className={styles.compactHeader}>
      <div className={styles.headerTitle}>
        <span className={styles.headerCount}>
          {channelGroups.length}{" "}
          {channelGroups.length === 1 ? "group" : "groups"}
        </span>
      </div>
      <div className={styles.headerActions}>
        <button
          type="button"
          className={styles.iconHeaderButton}
          onClick={() => {
            if (channelGroups.length <= 1) return;
            if (!activeGroup) return;
            deleteGroup(activeGroup);
          }}
          disabled={channelGroups.length <= 1}
          title="Delete active group"
        >
          <TrashIcon />
        </button>
        <button
          type="button"
          className={styles.iconHeaderButton}
          onClick={createGroup}
          title="Add group"
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );

  const renderList = () => (
    <div className={styles.panel}>
      {listHeader}
      {channelGroups.length === 0 ? (
        <div className={styles.emptyMessage}>No channel groups yet</div>
      ) : (
        <ul className={styles.rows}>
          {channelGroups.map((group) => {
            const isActive = activeGroup === group.id;
            const channelNames = channelNamesForGroup(group, sourceChannels);
            const subtitle = channelNames.join(", ");

            return (
              <li
                key={group.id}
                className={[
                  styles.groupRow,
                  isActive ? styles.groupRowActive : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  className={styles.rowOpenDetailButton}
                  title="Edit group"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetailForGroup(group.id);
                  }}
                >
                  <ChevronDownIcon
                    className={styles.waypointChevronRight}
                    aria-hidden
                  />
                </button>

                <button
                  type="button"
                  className={styles.groupRowMainHit}
                  aria-label={`Select group: ${group.name}`}
                  onClick={() => setActiveChannelGroup(group.id)}
                  onDoubleClick={() => openDetailForGroup(group.id)}
                >
                  <div className={styles.rowTextStack}>
                    <span className={styles.rowTitle} title={group.name}>
                      {group.name}
                    </span>
                    <span className={styles.rowContent} title={subtitle}>
                      {subtitle || "No channels"}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  // ── Detail view ──

  const renderDetail = () => {
    if (!detailGroup) return renderList();

    const handleTitleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      const trimmed = raw.trim();
      if (trimmed === "") {
        renameGroup(detailGroup.id, "Untitled group");
      } else if (trimmed !== raw) {
        renameGroup(detailGroup.id, trimmed);
      }
    };

    const channels = detailGroup.channels.map((gc) => {
      const sc = findSourceChannel(sourceChannels, gc.channelId);
      let rr = gc.color.r;
      let gCol = gc.color.g;
      let bb = gc.color.b;
      const liveColor = colorRenderingFor(
        channelRendering,
        detailGroup.id,
        gc.id,
      );
      if (liveColor) {
        rr = liveColor.r;
        gCol = liveColor.g;
        bb = liveColor.b;
      }
      const hex = [rr, gCol, bb]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      return {
        channelUUID: gc.id,
        sourceUUID: sc?.id ?? "",
        name: sc?.name ?? "Unknown",
        hex,
        r: rr,
        g: gCol,
        b: bb,
      };
    });

    const replaceOptions = (currentSourceUUID: string) =>
      sourceChannels.filter(({ id }) => id !== currentSourceUUID);

    const channelItemAttrsFor = (gc: (typeof detailGroup.channels)[0]) => {
      const flat = findSourceChannel(sourceChannels, gc.channelId);
      let pr = gc.color.r;
      let pg = gc.color.g;
      let pb = gc.color.b;
      const liveColor = colorRenderingFor(
        channelRendering,
        detailGroup.id,
        gc.id,
      );
      if (liveColor) {
        pr = liveColor.r;
        pg = liveColor.g;
        pb = liveColor.b;
      }
      let lower = gc.lowerLimit;
      let upper = gc.upperLimit;
      const liveContrast = contrastRenderingFor(
        channelRendering,
        detailGroup.id,
        gc.id,
      );
      if (liveContrast) {
        lower = liveContrast.lower;
        upper = liveContrast.upper;
      }
      return {
        group_uuid: detailGroup.id,
        channel_uuid: gc.id,
        source_uuid: flat?.id ?? "",
        r: String(pr),
        g: String(pg),
        b: String(pb),
        lower_range: String(lower),
        upper_range: String(upper),
      };
    };

    return (
      <div className={styles.detailView}>
        <div className={styles.detailHeader}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => setDetailGroupId(null)}
            title="Back to group list"
          >
            <ChevronDownIcon
              className={styles.waypointChevronLeft}
              aria-hidden
            />
            <span>Back</span>
          </button>
          <div className={styles.detailTitle} title={detailGroup.name}>
            {detailGroup.name}
          </div>
        </div>

        <div className={styles.detailBody} ref={detailBodyRef}>
          <div className={styles.detailBodyInner}>
            {/* Rename field */}
            <div className={styles.detailTitleFieldWrap}>
              <label
                className={styles.detailTitleLabel}
                htmlFor={renameFieldId}
              >
                Name
              </label>
              <input
                id={renameFieldId}
                className={styles.detailTitleInput}
                type="text"
                value={detailGroup.name ?? ""}
                onChange={(e) => renameGroup(detailGroup.id, e.target.value)}
                onBlur={handleTitleBlur}
                maxLength={200}
                autoComplete="off"
                spellCheck={false}
                placeholder="Group name"
              />
            </div>

            {/* Channels — always visible (detail view is only this group + channels) */}
            <div className={styles.detailChannelsSection}>
              <div className={styles.detailChannelsSectionHeader}>
                <div className={styles.detailChannelsSectionTitle}>
                  Channels{" "}
                  <span className={styles.detailCollapsibleCount}>
                    ({channels.length})
                  </span>
                </div>
                <div className={styles.paletteLockActions}>
                  <button
                    type="button"
                    className={styles.paletteLockAllButton}
                    disabled={channels.length === 0}
                    title="Lock all channel colors in this group"
                    onClick={() => lockAllColorsInGroup(detailGroup.id)}
                  >
                    Lock all
                  </button>
                  <button
                    type="button"
                    className={styles.paletteLockAllButton}
                    disabled={detailGroupLockedRowIds.size === 0}
                    title="Unlock all channel colors in this group"
                    onClick={() => unlockAllColorsInGroup(detailGroup.id)}
                  >
                    Unlock all
                  </button>
                  <button
                    type="button"
                    className={styles.optimizePaletteButton}
                    disabled={
                      !detailGroupPsudoEligible ||
                      optimizePaletteBusy ||
                      detailGroupAllColorsLocked
                    }
                    title={
                      detailGroupAllColorsLocked
                        ? "Unlock at least one channel to optimize"
                        : detailGroupPsudoEligible
                          ? detailGroupLockedRowIds.size > 0
                            ? `Optimize unlocked channels (${detailGroupLockedRowIds.size} locked)`
                            : "Optimize channel colors with psudo (perceptual palette)"
                          : "Need at least two non-RGB channels"
                    }
                    onClick={() => void runOptimizePalette()}
                  >
                    {optimizePaletteBusy ? "Optimizing…" : "Optimize colors"}
                  </button>
                </div>
              </div>
              {optimizePaletteMessage ? (
                <output className={styles.optimizePaletteMessage}>
                  {optimizePaletteMessage}
                </output>
              ) : null}
              <div className={styles.detailChannelsSectionBody}>
                {channels.map((ch) => {
                  const isReplacing = replacingChannelUUID === ch.channelUUID;
                  const gc = detailGroup.channels.find(
                    (c) => c.id === ch.channelUUID,
                  );
                  const legacyChannelItem =
                    gc &&
                    React.createElement(props.channelItemElement, {
                      key: `embed-${ch.channelUUID}-${ch.sourceUUID}`,
                      ...channelItemAttrsFor(gc),
                      histogram_loading: loadingHistogramSourceIds.includes(
                        ch.sourceUUID,
                      )
                        ? "true"
                        : "false",
                    });

                  const colorLocked = detailGroupLockedRowIds.has(
                    ch.channelUUID,
                  );

                  return (
                    <div
                      key={ch.channelUUID}
                      className={styles.detailChannelBlock}
                    >
                      <div
                        className={
                          colorLocked
                            ? `${styles.channelRow} ${styles.detailChannelRowLocked}`
                            : styles.channelRow
                        }
                      >
                        <button
                          type="button"
                          className={styles.channelColorSwatch}
                          style={{ backgroundColor: `#${ch.hex}` }}
                          title={`Pick color for ${ch.name}`}
                          aria-label={`Pick color for ${ch.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            setColorPickerGroupId(detailGroup.id);
                            setColorPickerChannelUUID(ch.channelUUID);
                            setColorPickerPos(
                              chromeColorPickerAnchorPosition(rect),
                            );
                          }}
                        />
                        <button
                          type="button"
                          className={
                            colorLocked
                              ? `${styles.colorLockButton} ${styles.colorLockButtonLocked}`
                              : styles.colorLockButton
                          }
                          aria-pressed={colorLocked}
                          title={
                            colorLocked
                              ? "Unlock color — included when optimizing"
                              : "Lock color — won't change when optimizing"
                          }
                          aria-label={
                            colorLocked
                              ? `Unlock color for ${ch.name}`
                              : `Lock color for ${ch.name}`
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleColorLock(detailGroup.id, ch.channelUUID);
                          }}
                        >
                          <PinIcon />
                        </button>
                        {isReplacing ? (
                          <select
                            ref={replaceChannelSelectRef}
                            className={styles.addChannelSelect}
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                replaceChannelInGroup(
                                  detailGroup.id,
                                  ch.channelUUID,
                                  e.target.value,
                                );
                              }
                            }}
                            onBlur={() => setReplacingChannelUUID(null)}
                          >
                            <option value="" disabled>
                              Replace with...
                            </option>
                            {replaceOptions(ch.sourceUUID).map((sc) => (
                              <option key={sc.id} value={sc.id}>
                                {sc.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={styles.channelName}>{ch.name}</span>
                        )}
                        <button
                          type="button"
                          className={styles.channelActionButton}
                          title="Replace channel"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplacingChannelUUID(
                              isReplacing ? null : ch.channelUUID,
                            );
                          }}
                        >
                          <ReplaceIcon />
                        </button>
                        <button
                          type="button"
                          className={styles.channelActionButton}
                          title="Remove channel"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeChannelFromGroup(
                              detailGroup.id,
                              ch.channelUUID,
                            );
                          }}
                        >
                          <RemoveIcon />
                        </button>
                      </div>
                      {legacyChannelItem ? (
                        <div className={styles.detailChannelItemEmbed}>
                          {legacyChannelItem}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {/* Add channel */}
                <div className={styles.addChannelRow}>
                  {availableChannels.length === 0 ? (
                    <span className={styles.allChannelsNote}>
                      All channels in group
                    </span>
                  ) : (
                    <select
                      className={styles.addChannelSelect}
                      defaultValue=""
                      disabled={optimizePaletteBusy}
                      onChange={(e) => {
                        if (e.target.value) {
                          void addChannelToGroup(
                            detailGroup.id,
                            e.target.value,
                          );
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="" disabled>
                        {optimizePaletteBusy
                          ? "Optimizing color…"
                          : "Add channel..."}
                      </option>
                      {availableChannels.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={[styles.panel, styles.black].join(" ")}>
      <div
        className={styles.channelPanelTabRow}
        role="tablist"
        aria-label="Channel panel"
      >
        <button
          type="button"
          role="tab"
          aria-selected={channelPanelTab === "groups"}
          className={
            channelPanelTab === "groups"
              ? `${styles.channelPanelTab} ${styles.channelPanelTabActive}`
              : styles.channelPanelTab
          }
          onClick={() => setChannelPanelTab("groups")}
        >
          Channel groups
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={channelPanelTab === "names"}
          className={
            channelPanelTab === "names"
              ? `${styles.channelPanelTab} ${styles.channelPanelTabActive}`
              : styles.channelPanelTab
          }
          onClick={() => {
            setChannelPanelTab("names");
            setDetailGroupId(null);
          }}
        >
          Channel names
        </button>
      </div>
      {channelPanelTab === "names"
        ? renderChannelNamesPanel()
        : detailGroupId
          ? renderDetail()
          : renderList()}
      {colorPickerChannelUUID && colorPickerPos && pickingColorHex ? (
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
            if (!colorPickerGroupId || !colorPickerChannelUUID) return;
            useAppStore.getState().setChannelRendering({
              kind: "color",
              groupId: colorPickerGroupId,
              channelId: colorPickerChannelUUID,
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

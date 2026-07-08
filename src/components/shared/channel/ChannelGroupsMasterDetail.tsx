import * as React from "react";
import {
  ChromeColorPickerPopover,
  chromeColorPickerAnchorPosition,
} from "@/components/shared/ChromeColorPickerPopover";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import {
  addSourceChannelToGroup,
  removeGroupChannel,
  renameSourceChannelDisplayName,
  syncChannelGroupState,
} from "@/lib/channel/channelGroupMutations";
import { sourceDistributionYValuesLength } from "@/lib/imaging/histogramLazy";
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
import { ChannelContrastEditor } from "./ChannelContrastEditor";
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

  const syncGroupState = React.useCallback(
    (newGroups: ChannelGroup[]) => {
      syncChannelGroupState(newGroups, sourceChannels);
    },
    [sourceChannels],
  );

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

    const contrastEditorPropsFor = (gc: (typeof detailGroup.channels)[0]) => {
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
        groupId: detailGroup.id,
        channelId: gc.id,
        sourceChannelId: flat?.id ?? "",
        r: pr,
        g: pg,
        b: pb,
        lowerLimit: lower,
        upperLimit: upper,
        distribution: flat?.sourceDistribution ?? null,
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
              <div className={styles.detailChannelsSectionTitle}>
                Channels{" "}
                <span className={styles.detailCollapsibleCount}>
                  ({channels.length})
                </span>
              </div>
              <div className={styles.detailChannelsSectionBody}>
                {channels.map((ch) => {
                  const isReplacing = replacingChannelUUID === ch.channelUUID;
                  const gc = detailGroup.channels.find(
                    (c) => c.id === ch.channelUUID,
                  );
                  const contrastEditor = gc ? (
                    <ChannelContrastEditor
                      key={`embed-${ch.channelUUID}-${ch.sourceUUID}`}
                      {...contrastEditorPropsFor(gc)}
                      histogramLoading={loadingHistogramSourceIds.includes(
                        ch.sourceUUID,
                      )}
                    />
                  ) : null;

                  return (
                    <div
                      key={ch.channelUUID}
                      className={styles.detailChannelBlock}
                    >
                      <div className={styles.channelRow}>
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
                            removeGroupChannel(detailGroup.id, ch.channelUUID);
                          }}
                        >
                          <RemoveIcon />
                        </button>
                      </div>
                      {contrastEditor ? (
                        <div className={styles.detailChannelItemEmbed}>
                          {contrastEditor}
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
                      onChange={(e) => {
                        if (e.target.value) {
                          addSourceChannelToGroup(
                            detailGroup.id,
                            e.target.value,
                          );
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="" disabled>
                        Add channel...
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

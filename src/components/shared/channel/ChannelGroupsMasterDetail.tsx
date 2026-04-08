import * as React from "react";
import {
  ChromeColorPickerPopover,
  chromeColorPickerAnchorPosition,
} from "@/components/shared/ChromeColorPickerPopover";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import { sourceDistributionYValuesLength } from "@/lib/imaging/histogramLazy";
import { useAppStore } from "@/lib/stores/appStore";
import type {
  ConfigGroup,
  ConfigSourceChannel,
} from "@/lib/stores/documentStore";
import { useDocumentStore } from "@/lib/stores/documentStore";
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
  group: ConfigGroup,
  sourceChannels: ConfigSourceChannel[],
): string[] {
  return (group.GroupChannels ?? [])
    .map(({ sourceChannelId }) =>
      sourceChannels.find((sc) => sc.id === sourceChannelId),
    )
    .filter((sc): sc is ConfigSourceChannel => sc != null)
    .map((sc) => sc.Name);
}

export type ChannelGroupsMasterDetailProps = {
  channelItemElement: string;
  retrievingMetadata: boolean;
  noLoader: boolean;
  /** OME-TIFF: lazy-load histograms for visible source indices (see `histogramLazy.ts`). */
  ensureChannelHistograms?: (sourceIndices: number[]) => Promise<void>;
};

export const ChannelGroupsMasterDetail = (
  props: ChannelGroupsMasterDetailProps,
) => {
  const { setActiveChannelGroup } = useAppStore();
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const Groups = useDocumentStore((s) => s.channelGroups);
  const SourceChannels = useDocumentStore((s) => s.sourceChannels);
  const setChannelGroups = useDocumentStore((s) => s.setChannelGroups);
  const setGroupNames = useAppStore((s) => s.setGroupNames);
  const setGroupChannelLists = useAppStore((s) => s.setGroupChannelLists);
  const setChannelVisibilities = useAppStore((s) => s.setChannelVisibilities);

  const detailBodyRef = React.useRef<HTMLDivElement | null>(null);
  const renameFieldId = React.useId();

  // Master-detail state
  const [detailGroupId, setDetailGroupId] = React.useState<string | null>(null);
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
  const [colorPickerPos, setColorPickerPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  // Reset detail state when switching groups
  React.useEffect(() => {
    if (detailGroupId) {
      setReplacingChannelUUID(null);
    }
  }, [detailGroupId]);

  React.useEffect(() => {
    if (replacingChannelUUID === null) return;
    const id = window.requestAnimationFrame(() => {
      replaceChannelSelectRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [replacingChannelUUID]);

  const detailGroup = detailGroupId
    ? (Groups.find((g) => g.id === detailGroupId) ?? null)
    : null;

  // Sync derived store state after group mutations.
  const syncGroupState = React.useCallback(
    (newGroups: ConfigGroup[]) => {
      setChannelGroups(newGroups);
      setGroupNames(
        Object.fromEntries(newGroups.map(({ Name, id }) => [id, Name])),
      );
      const lists = Object.fromEntries(
        newGroups.map(({ Name, GroupChannels }) => [
          Name,
          GroupChannels.map(({ sourceChannelId }) =>
            SourceChannels.find(({ id }) => id === sourceChannelId),
          )
            .filter(Boolean)
            .map((sc) => sc?.Name),
        ]),
      );
      setGroupChannelLists(lists);
      const namesInUse = new Set<string>();
      for (const g of newGroups) {
        for (const gc of g.GroupChannels) {
          const sc = SourceChannels.find(({ id }) => id === gc.sourceChannelId);
          if (sc?.Name) {
            namesInUse.add(sc.Name);
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
      SourceChannels,
      setChannelGroups,
      setGroupNames,
      setGroupChannelLists,
      setChannelVisibilities,
    ],
  );

  // --- Group CRUD ---
  const createGroup = () => {
    const name = `Group ${Groups.length + 1}`;
    const newGroup: ConfigGroup = {
      id: crypto.randomUUID(),
      Name: name,
      GroupChannels: [],
      State: { Expanded: true },
    };
    const newGroups = [...Groups, newGroup];
    syncGroupState(newGroups);
    setActiveChannelGroup(newGroup.id);
    setDetailGroupId(newGroup.id);
    requestAnimationFrame(() => {
      detailBodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const deleteGroup = (groupId: string) => {
    if (Groups.length <= 1) return;
    const newGroups = Groups.filter(({ id }) => id !== groupId);
    syncGroupState(newGroups);
    if (activeChannelGroupId === groupId) {
      setActiveChannelGroup(newGroups[0].id);
    }
    if (detailGroupId === groupId) {
      setDetailGroupId(null);
    }
  };

  const renameGroup = (groupId: string, newName: string) => {
    const newGroups = Groups.map((g) =>
      g.id === groupId ? { ...g, Name: newName } : g,
    );
    syncGroupState(newGroups);
  };

  const addChannelToGroup = (groupId: string, sourceChannelUUID: string) => {
    const sc = SourceChannels.find(({ id }) => id === sourceChannelUUID);
    if (!sc) return;
    const newGroups = Groups.map((g) => {
      if (g.id !== groupId) return g;
      const already = g.GroupChannels.some(
        (gc) => gc.sourceChannelId === sourceChannelUUID,
      );
      if (already) return g;
      const newChannel = {
        id: crypto.randomUUID(),
        LowerRange: 0,
        UpperRange: 65535,
        Color: { R: 255, G: 255, B: 255 },
        sourceChannelId: sourceChannelUUID,
        groupId,
        State: { Expanded: true },
      };
      return { ...g, GroupChannels: [...g.GroupChannels, newChannel] };
    });
    syncGroupState(newGroups);
  };

  const removeChannelFromGroup = (groupId: string, channelUUID: string) => {
    const newGroups = Groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        GroupChannels: g.GroupChannels.filter((gc) => gc.id !== channelUUID),
      };
    });
    syncGroupState(newGroups);
  };

  const replaceChannelInGroup = (
    groupId: string,
    oldChannelUUID: string,
    newSourceChannelUUID: string,
  ) => {
    const newGroups = Groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        GroupChannels: g.GroupChannels.map((gc) => {
          if (gc.id !== oldChannelUUID) return gc;
          return { ...gc, sourceChannelId: newSourceChannelUUID };
        }),
      };
    });
    syncGroupState(newGroups);
    setReplacingChannelUUID(null);
  };

  const updateChannelColor = (
    channelUUID: string,
    rgb: { R: number; G: number; B: number },
  ) => {
    const newGroups = Groups.map((g) => ({
      ...g,
      GroupChannels: g.GroupChannels.map((gc) =>
        gc.id === channelUUID ? { ...gc, Color: rgb } : gc,
      ),
    }));
    syncGroupState(newGroups);
  };

  // Color picker helpers
  const pickingColorHex = React.useMemo(() => {
    if (!colorPickerChannelUUID) return null;
    for (const g of Groups) {
      const gc = g.GroupChannels.find((c) => c.id === colorPickerChannelUUID);
      if (gc) {
        const { R, G, B } = gc.Color;
        return [R, G, B].map((n) => n.toString(16).padStart(2, "0")).join("");
      }
    }
    return null;
  }, [Groups, colorPickerChannelUUID]);

  const closeColorPicker = React.useCallback(() => {
    setColorPickerChannelUUID(null);
    setColorPickerPos(null);
  }, []);

  const activeGroup =
    activeChannelGroupId || (Groups.length > 0 ? Groups[0].id : null);

  const { ensureChannelHistograms } = props;

  const detailGroupSourcesKey = React.useMemo(() => {
    if (!detailGroupId) return "";
    const g = Groups.find((x) => x.id === detailGroupId);
    if (!g) return "";
    return g.GroupChannels.map((gc) => gc.sourceChannelId).join("\0");
  }, [detailGroupId, Groups]);

  React.useEffect(() => {
    void detailGroupSourcesKey;
    if (!detailGroupId || !ensureChannelHistograms || props.noLoader) return;
    let cancelled = false;
    void (async () => {
      try {
        const { channelGroups: gList, sourceChannels: scList } =
          useDocumentStore.getState();
        const g = gList.find((x) => x.id === detailGroupId);
        if (!g) return;
        const indices: number[] = [];
        const sourceIds: string[] = [];
        for (const gc of g.GroupChannels) {
          const sc = scList.find((s) => s.id === gc.sourceChannelId);
          if (!sc) continue;
          if (sourceDistributionYValuesLength(sc) > 0) continue;
          indices.push(sc.SourceIndex);
          sourceIds.push(sc.id);
        }
        if (indices.length === 0 || cancelled) return;
        setLoadingHistogramSourceIds(sourceIds);
        await new Promise<void>((r) => {
          requestAnimationFrame(() => r());
        });
        if (cancelled) return;
        await ensureChannelHistograms(indices);
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
    const g = Groups.find(({ id }) => id === detailGroupId);
    if (!g) return [];
    const usedUUIDs = new Set(g.GroupChannels.map((gc) => gc.sourceChannelId));
    return SourceChannels.filter(({ id }) => !usedUUIDs.has(id));
  }, [detailGroupId, Groups, SourceChannels]);

  // ── List view ──

  const listHeader = (
    <div className={styles.compactHeader}>
      <div className={styles.headerTitle}>
        <span>Channel Groups</span>
        <span className={styles.headerCount}>({Groups.length})</span>
      </div>
      <div className={styles.headerActions}>
        <button
          type="button"
          className={styles.iconHeaderButton}
          onClick={() => {
            if (Groups.length <= 1) return;
            if (!activeGroup) return;
            deleteGroup(activeGroup);
          }}
          disabled={Groups.length <= 1}
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
      {Groups.length === 0 ? (
        <div className={styles.emptyMessage}>No groups yet</div>
      ) : (
        <ul className={styles.rows}>
          {Groups.map((group) => {
            const isActive = activeGroup === group.id;
            const channelNames = channelNamesForGroup(group, SourceChannels);
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
                  aria-label={`Select group: ${group.Name}`}
                  onClick={() => setActiveChannelGroup(group.id)}
                  onDoubleClick={() => openDetailForGroup(group.id)}
                >
                  <div className={styles.rowTextStack}>
                    <span className={styles.rowTitle} title={group.Name}>
                      {group.Name}
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

    const channels = detailGroup.GroupChannels.map((gc) => {
      const sc = SourceChannels.find(({ id }) => id === gc.sourceChannelId);
      const { R, G, B } = gc.Color;
      const hex = [R, G, B]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      return {
        channelUUID: gc.id,
        sourceUUID: gc.sourceChannelId,
        name: sc?.Name ?? "Unknown",
        hex,
        r: R,
        g: G,
        b: B,
      };
    });

    const replaceOptions = (currentSourceUUID: string) =>
      SourceChannels.filter(({ id }) => id !== currentSourceUUID);

    const channelItemAttrsFor = (
      gc: (typeof detailGroup.GroupChannels)[0],
    ) => ({
      group_uuid: detailGroup.id,
      channel_uuid: gc.id,
      source_uuid: gc.sourceChannelId,
      r: String(gc.Color.R),
      g: String(gc.Color.G),
      b: String(gc.Color.B),
      lower_range: String(gc.LowerRange),
      upper_range: String(gc.UpperRange),
    });

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
          <div className={styles.detailTitle} title={detailGroup.Name}>
            {detailGroup.Name}
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
                value={detailGroup.Name ?? ""}
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
                  const gc = detailGroup.GroupChannels.find(
                    (c) => c.id === ch.channelUUID,
                  );
                  const legacyChannelItem =
                    gc &&
                    !props.retrievingMetadata &&
                    !props.noLoader &&
                    React.createElement(props.channelItemElement, {
                      key: `embed-${ch.channelUUID}-${ch.sourceUUID}`,
                      ...channelItemAttrsFor(gc),
                      histogram_loading: loadingHistogramSourceIds.includes(
                        ch.sourceUUID,
                      )
                        ? "true"
                        : "false",
                    });

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
                                {sc.Name}
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
                      onChange={(e) => {
                        if (e.target.value) {
                          addChannelToGroup(detailGroup.id, e.target.value);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="" disabled>
                        Add channel...
                      </option>
                      {availableChannels.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.Name}
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
      {detailGroupId ? renderDetail() : renderList()}
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
            updateChannelColor(colorPickerChannelUUID, { R, G, B });
          }}
        />
      ) : null}
    </div>
  );
};

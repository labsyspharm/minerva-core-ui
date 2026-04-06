import { Chrome } from "@uiw/react-color";
import * as React from "react";
import { createPortal } from "react-dom";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import type { ConfigGroup, ConfigSourceChannel } from "@/lib/document-store";
import { useOverlayStore } from "@/lib/stores";
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
    .map(({ SourceChannel }) =>
      sourceChannels.find((sc) => sc.UUID === SourceChannel.UUID),
    )
    .filter((sc): sc is ConfigSourceChannel => sc != null)
    .map((sc) => sc.Name);
}

export type ChannelGroupsMasterDetailProps = {
  channelItemElement: string;
  retrievingMetadata: boolean;
  noLoader: boolean;
};

export const ChannelGroupsMasterDetail = (
  props: ChannelGroupsMasterDetailProps,
) => {
  const { setActiveChannelGroup } = useOverlayStore();
  const activeChannelGroupId = useOverlayStore((s) => s.activeChannelGroupId);
  const Groups = useOverlayStore((s) => s.Groups);
  const SourceChannels = useOverlayStore((s) => s.SourceChannels);
  const setGroups = useOverlayStore((s) => s.setGroups);
  const setGroupNames = useOverlayStore((s) => s.setGroupNames);
  const setGroupChannelLists = useOverlayStore((s) => s.setGroupChannelLists);
  const setChannelVisibilities = useOverlayStore(
    (s) => s.setChannelVisibilities,
  );

  const detailBodyRef = React.useRef<HTMLDivElement | null>(null);
  const renameFieldId = React.useId();

  // Master-detail state
  const [detailGroupId, setDetailGroupId] = React.useState<string | null>(null);

  // Editing state
  const [replacingChannelUUID, setReplacingChannelUUID] = React.useState<
    string | null
  >(null);
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

  const detailGroup = detailGroupId
    ? (Groups.find((g) => g.UUID === detailGroupId) ?? null)
    : null;

  // Sync derived store state after group mutations.
  const syncGroupState = React.useCallback(
    (newGroups: ConfigGroup[]) => {
      setGroups(newGroups);
      setGroupNames(
        Object.fromEntries(newGroups.map(({ Name, UUID }) => [UUID, Name])),
      );
      const lists = Object.fromEntries(
        newGroups.map(({ Name, GroupChannels }) => [
          Name,
          GroupChannels.map(({ SourceChannel }) =>
            SourceChannels.find(({ UUID }) => UUID === SourceChannel.UUID),
          )
            .filter(Boolean)
            .map((sc) => sc?.Name),
        ]),
      );
      setGroupChannelLists(lists);
      const namesInUse = new Set<string>();
      for (const g of newGroups) {
        for (const gc of g.GroupChannels) {
          const sc = SourceChannels.find(
            ({ UUID }) => UUID === gc.SourceChannel.UUID,
          );
          if (sc?.Name) {
            namesInUse.add(sc.Name);
          }
        }
      }
      const prev = useOverlayStore.getState().channelVisibilities;
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
      setGroups,
      setGroupNames,
      setGroupChannelLists,
      setChannelVisibilities,
    ],
  );

  // --- Group CRUD ---
  const createGroup = () => {
    const name = `Group ${Groups.length + 1}`;
    const newGroup: ConfigGroup = {
      UUID: crypto.randomUUID(),
      Name: name,
      GroupChannels: [],
      State: { Expanded: true },
    };
    const newGroups = [...Groups, newGroup];
    syncGroupState(newGroups);
    setActiveChannelGroup(newGroup.UUID);
    setDetailGroupId(newGroup.UUID);
    requestAnimationFrame(() => {
      detailBodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const deleteGroup = (groupId: string) => {
    if (Groups.length <= 1) return;
    const newGroups = Groups.filter(({ UUID }) => UUID !== groupId);
    syncGroupState(newGroups);
    if (activeChannelGroupId === groupId) {
      setActiveChannelGroup(newGroups[0].UUID);
    }
    if (detailGroupId === groupId) {
      setDetailGroupId(null);
    }
  };

  const renameGroup = (groupId: string, newName: string) => {
    const newGroups = Groups.map((g) =>
      g.UUID === groupId ? { ...g, Name: newName } : g,
    );
    syncGroupState(newGroups);
  };

  const addChannelToGroup = (groupId: string, sourceChannelUUID: string) => {
    const sc = SourceChannels.find(({ UUID }) => UUID === sourceChannelUUID);
    if (!sc) return;
    const newGroups = Groups.map((g) => {
      if (g.UUID !== groupId) return g;
      const already = g.GroupChannels.some(
        (gc) => gc.SourceChannel.UUID === sourceChannelUUID,
      );
      if (already) return g;
      const newChannel = {
        UUID: crypto.randomUUID(),
        LowerRange: 0,
        UpperRange: 65535,
        Color: { R: 255, G: 255, B: 255 },
        SourceChannel: { UUID: sourceChannelUUID },
        Group: { UUID: groupId },
        State: { Expanded: true },
      };
      return { ...g, GroupChannels: [...g.GroupChannels, newChannel] };
    });
    syncGroupState(newGroups);
  };

  const removeChannelFromGroup = (groupId: string, channelUUID: string) => {
    const newGroups = Groups.map((g) => {
      if (g.UUID !== groupId) return g;
      return {
        ...g,
        GroupChannels: g.GroupChannels.filter((gc) => gc.UUID !== channelUUID),
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
      if (g.UUID !== groupId) return g;
      return {
        ...g,
        GroupChannels: g.GroupChannels.map((gc) => {
          if (gc.UUID !== oldChannelUUID) return gc;
          return { ...gc, SourceChannel: { UUID: newSourceChannelUUID } };
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
        gc.UUID === channelUUID ? { ...gc, Color: rgb } : gc,
      ),
    }));
    syncGroupState(newGroups);
  };

  // Color picker helpers
  const pickingColorHex = React.useMemo(() => {
    if (!colorPickerChannelUUID) return null;
    for (const g of Groups) {
      const gc = g.GroupChannels.find((c) => c.UUID === colorPickerChannelUUID);
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

  React.useEffect(() => {
    if (!colorPickerChannelUUID) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeColorPicker();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [colorPickerChannelUUID, closeColorPicker]);

  const activeGroup =
    activeChannelGroupId || (Groups.length > 0 ? Groups[0].UUID : null);

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
    const g = Groups.find(({ UUID }) => UUID === detailGroupId);
    if (!g) return [];
    const usedUUIDs = new Set(
      g.GroupChannels.map((gc) => gc.SourceChannel.UUID),
    );
    return SourceChannels.filter(({ UUID }) => !usedUUIDs.has(UUID));
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
            const isActive = activeGroup === group.UUID;
            const channelNames = channelNamesForGroup(group, SourceChannels);
            const subtitle = channelNames.join(", ");

            return (
              <li
                key={group.UUID}
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
                    openDetailForGroup(group.UUID);
                  }}
                >
                  <ChevronDownIcon
                    className={styles.waypointChevronRight}
                    aria-hidden
                  />
                </button>

                {/* biome-ignore lint/a11y/useSemanticElements: row needs nested interactive */}
                <div
                  className={styles.groupRowMainHit}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select group: ${group.Name}`}
                  onClick={() => setActiveChannelGroup(group.UUID)}
                  onDoubleClick={() => openDetailForGroup(group.UUID)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActiveChannelGroup(group.UUID);
                    }
                  }}
                >
                  <div className={styles.rowTextStack}>
                    <span className={styles.rowTitle} title={group.Name}>
                      {group.Name}
                    </span>
                    <span className={styles.rowContent} title={subtitle}>
                      {subtitle || "No channels"}
                    </span>
                  </div>
                </div>
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
        renameGroup(detailGroup.UUID, "Untitled group");
      } else if (trimmed !== raw) {
        renameGroup(detailGroup.UUID, trimmed);
      }
    };

    const channels = detailGroup.GroupChannels.map((gc) => {
      const sc = SourceChannels.find(
        ({ UUID }) => UUID === gc.SourceChannel.UUID,
      );
      const { R, G, B } = gc.Color;
      const hex = [R, G, B]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      return {
        channelUUID: gc.UUID,
        sourceUUID: gc.SourceChannel.UUID,
        name: sc?.Name ?? "Unknown",
        hex,
        r: R,
        g: G,
        b: B,
      };
    });

    const replaceOptions = (currentSourceUUID: string) =>
      SourceChannels.filter(({ UUID }) => UUID !== currentSourceUUID);

    const channelItemAttrsFor = (
      gc: (typeof detailGroup.GroupChannels)[0],
    ) => ({
      group_uuid: detailGroup.UUID,
      channel_uuid: gc.UUID,
      source_uuid: gc.SourceChannel.UUID,
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
                onChange={(e) => renameGroup(detailGroup.UUID, e.target.value)}
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
                    (c) => c.UUID === ch.channelUUID,
                  );
                  const legacyChannelItem =
                    gc &&
                    !props.retrievingMetadata &&
                    !props.noLoader &&
                    React.createElement(props.channelItemElement, {
                      key: `embed-${ch.channelUUID}-${ch.sourceUUID}`,
                      ...channelItemAttrsFor(gc),
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
                            setColorPickerPos({
                              top: Math.min(
                                rect.bottom + 4,
                                window.innerHeight - 280,
                              ),
                              left: Math.min(
                                rect.left,
                                window.innerWidth - 240,
                              ),
                            });
                          }}
                        />
                        {isReplacing ? (
                          <select
                            className={styles.addChannelSelect}
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                replaceChannelInGroup(
                                  detailGroup.UUID,
                                  ch.channelUUID,
                                  e.target.value,
                                );
                              }
                            }}
                            onBlur={() => setReplacingChannelUUID(null)}
                            // biome-ignore lint/a11y/noAutofocus: replace dropdown
                            autoFocus
                          >
                            <option value="" disabled>
                              Replace with...
                            </option>
                            {replaceOptions(ch.sourceUUID).map((sc) => (
                              <option key={sc.UUID} value={sc.UUID}>
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
                              detailGroup.UUID,
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
                          addChannelToGroup(detailGroup.UUID, e.target.value);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="" disabled>
                        Add channel...
                      </option>
                      {availableChannels.map((sc) => (
                        <option key={sc.UUID} value={sc.UUID}>
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

  // ── Color picker portal ──
  const colorPickerPortal =
    colorPickerChannelUUID &&
    colorPickerPos &&
    pickingColorHex &&
    typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close color picker"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9998,
                margin: 0,
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: "default",
              }}
              onClick={closeColorPicker}
            />
            <div
              style={{
                position: "fixed",
                top: colorPickerPos.top,
                left: colorPickerPos.left,
                zIndex: 9999,
                boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
              }}
            >
              <Chrome
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
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className={[styles.panel, styles.black].join(" ")}>
      {detailGroupId ? renderDetail() : renderList()}
      {colorPickerPortal}
    </div>
  );
};

import { Chrome } from "@uiw/react-color";
import type { ReactNode } from "react";
import * as React from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { WaypointsList } from "@/components/authoring/waypoints/WaypointsList";
import { ItemList, type ListItem } from "@/components/shared/common/ItemList";
// Types
import type { ConfigProps } from "@/lib/config";
import type { ConfigGroup } from "@/lib/document-store";
import { useOverlayStore } from "@/lib/stores";
import { ChannelGroups } from "./ChannelGroups";
import { ChannelLegend } from "./ChannelLegend";

type ChannelItemMetadata = {
  type: "channel-item";
  r: number;
  g: number;
  b: number;
  lower_range: number;
  upper_range: number;
  name: string;
  color: string;
  group_uuid: string;
  source_uuid: string;
  channel_uuid: string;
};
type GroupItemMetadata = {
  g: number;
  UUID: string;
  name: string;
  channels: (Omit<ChannelItemMetadata, "type"> | null)[];
};
type ChannelGroupMetadata = GroupItemMetadata | ChannelItemMetadata;

export type ChannelPanelProps = {
  children: ReactNode;
  config: ConfigProps;
  authorMode: boolean;
  hiddenChannel: boolean;
  startExport: () => void;
  channelItemElement: string;
  controlPanelElement: string;
  retrievingMetadata: boolean;
  /** When true, image/data is not loaded yet — hide channel chrome that needs channels. */
  noLoader: boolean;
  setHiddenChannel: (v: boolean) => void;
  /** Switch layout to playback / presentation (optional). */
  enterPlaybackPreview?: () => void;
  /** Incremented after a successful image import. */
  importRevision?: number;
};

const TextWrap = styled.div`
  position: relative;
  height: 100%;
  min-height: 0;
  > div.core {
    color: #eee;
    position: absolute;
    right: 0;
    top: 0;
    width: 220px;
    margin-bottom: 4px;
    transition: transform 0.5s ease 0s;
  }
  > div.core.hide {
    transform: translateX(100%); 
  }
  .dim {
    color: #aaa;
  }
`;

const TextOther = styled.div`
  background-color: transparent;
`;

const WrapChannel = styled.div`
  display: grid;
  grid-template-columns: 60px 1fr;
  position: relative;
  > :first-child {
    margin-left: -20px;
  }
`;

const WrapChannelName = styled.div`
`;

// Content layout styles (merged from content.tsx)
const WrapContent = styled.div`
  height: 100%;
  display: grid;
  pointer-events: none;
  grid-template-rows: auto auto 1fr;
  grid-template-columns: 100%;
`;

const WrapCore = styled.div`
  padding: 0.5em;
  grid-column: 1;
  grid-row: 1 / 3;
  overflow: auto;
  scrollbar-color: #888 var(--theme-dim-gray-color);
  pointer-events: all;
  word-wrap: break-word;
  border: 2px solid var(--theme-glass-edge);
  background-color: var(--dark-glass);
  border-radius: var(--radius-0001);
`;

const WrapColumns = styled.div`
  grid-template-columns: auto 1fr;
  display: grid;
  gap: 0.25em;
`;

const Header = styled.h2`
`;

type ReplaceChannelSelectProps = {
  onPick: (sourceUuid: string) => void;
  onDismiss: () => void;
  options: { UUID: string; Name: string }[];
};

/** Focus on mount (replaces autoFocus for a11y lint). */
const ReplaceChannelSelect = ({
  onPick,
  onDismiss,
  options,
}: ReplaceChannelSelectProps) => {
  const selectRef = React.useRef<HTMLSelectElement>(null);
  React.useEffect(() => {
    selectRef.current?.focus();
  }, []);
  return (
    <select
      ref={selectRef}
      style={{
        flex: 1,
        padding: "2px 4px",
        background: "#222",
        color: "#eee",
        border: "1px solid #444",
        borderRadius: "2px",
        fontSize: "12px",
      }}
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) {
          onPick(e.target.value);
        }
      }}
      onBlur={onDismiss}
    >
      <option value="" disabled>
        Replace with...
      </option>
      {options.map((sc) => (
        <option key={sc.UUID} value={sc.UUID}>
          {sc.Name}
        </option>
      ))}
    </select>
  );
};

export const ChannelPanel = (props: ChannelPanelProps) => {
  const hide = props.hiddenChannel;
  const hidden = props.retrievingMetadata || props.noLoader;
  const renameFieldId = React.useId();
  // Subscribe only to overlay state used by this panel so viewport/zoom updates don't re-render.
  const { setActiveChannelGroup } = useOverlayStore();
  const activeChannelGroupId = useOverlayStore((s) => s.activeChannelGroupId);
  const channelVisibilities = useOverlayStore((s) => s.channelVisibilities);
  const setChannelVisibilities = useOverlayStore(
    (s) => s.setChannelVisibilities,
  );
  const Groups = useOverlayStore((s) => s.Groups);
  const SourceChannels = useOverlayStore((s) => s.SourceChannels);
  const setGroups = useOverlayStore((s) => s.setGroups);
  const setGroupNames = useOverlayStore((s) => s.setGroupNames);
  const setGroupChannelLists = useOverlayStore((s) => s.setGroupChannelLists);

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
            .map((sc) => sc.Name),
        ]),
      );
      setGroupChannelLists(lists);
    },
    [SourceChannels, setGroups, setGroupNames, setGroupChannelLists],
  );
  const groups = Groups.map((group, g) => {
    return {
      g,
      UUID: group.UUID,
      name: group.Name,
      channels: group.GroupChannels.map((channel) => {
        const { SourceChannel, Color } = channel;
        const { LowerRange, UpperRange } = channel;
        const found = SourceChannels.find(
          ({ UUID }) => SourceChannel.UUID === UUID,
        );
        if (found) {
          const { R, G, B } = Color;
          const hex_color = [R, G, B]
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("");
          return {
            r: R,
            g: G,
            b: B,
            lower_range: LowerRange,
            upper_range: UpperRange,
            name: found.Name,
            color: `${hex_color}`,
            group_uuid: group.UUID,
            source_uuid: found.UUID,
            channel_uuid: channel.UUID,
          };
        }
        return null;
      }).filter((x) => x),
    };
  });
  const activeGroup =
    activeChannelGroupId || (groups.length > 0 ? groups[0].UUID : null);
  const group = groups.find(({ UUID }) => UUID === activeGroup);
  const toggleChannel = ({ name }) => {
    setChannelVisibilities(
      Object.fromEntries(
        Object.entries(channelVisibilities).map(([k, v]) => [
          k,
          k === name ? !v : v,
        ]),
      ),
    );
  };
  // --- Group management ---
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
  };

  const deleteGroup = (groupId: string) => {
    if (Groups.length <= 1) return;
    const newGroups = Groups.filter(({ UUID }) => UUID !== groupId);
    syncGroupState(newGroups);
    if (activeChannelGroupId === groupId) {
      setActiveChannelGroup(newGroups[0].UUID);
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

  const legendProps = {
    ...props,
    ...group,
    channelVisibilities,
    toggleChannel,
  };
  const hideClass = ["show core", "hide core"][+hide];

  // Content logic (merged from content.tsx)
  const total = groups.length;
  const groupProps = { ...props, total };

  const allGroups =
    groups.length || props ? (
      <>
        <Header className="h6">
          <WrapColumns>
            <span>Channel Group</span>
          </WrapColumns>
        </Header>
        <ChannelGroups {...{ ...groupProps, groups }} />
      </>
    ) : null;

  const channelMenu = (
    <div className={hideClass}>
      <WrapContent>
        <WrapCore>
          {allGroups}
          <ChannelLegend {...legendProps} />
        </WrapCore>
      </WrapContent>
    </div>
  );

  const waypointsPanel = props.authorMode ? (
    props.retrievingMetadata ? (
      <div style={{ padding: "1em", color: "#aaa" }}>Loading image data...</div>
    ) : (
      <WaypointsList onEnterPlaybackPreview={props.enterPlaybackPreview} />
    )
  ) : null;

  // --- Editing state ---
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = React.useState("");
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

  type ChannelEditorMetadata = {
    type: "channel-editor";
    groupUUID: string;
  };
  type ChannelGroupChildMetadata = ChannelItemMetadata | ChannelEditorMetadata;
  type ChannelGroupListMetadata = GroupItemMetadata | ChannelGroupChildMetadata;

  const listItems: ListItem<ChannelGroupListMetadata>[] = groups.map(
    (group) => {
      const { channels, UUID, name } = group;
      const isEditing = editingGroupId === UUID;

      const children: ListItem<ChannelGroupListMetadata>[] = [];

      if (isEditing) {
        // Show each channel with a delete/replace action
        for (const channel of channels) {
          children.push({
            id: `channel-${channel.channel_uuid}`,
            title: channel.name,
            isActive: false,
            metadata: {
              type: "channel-item",
              ...channel,
            } as ChannelItemMetadata,
          });
        }
        // "Add channel" row at the end
        children.push({
          id: `${UUID}-add-channel`,
          title: "Add channel...",
          isActive: false,
          metadata: {
            type: "channel-editor",
            groupUUID: UUID,
          } as ChannelEditorMetadata,
        });
      }

      return {
        id: UUID,
        title: name,
        subtitle: channels.map(({ name }) => name).join(", "),
        isActive: activeGroup === UUID,
        isExpanded: isEditing,
        isDragging: false,
        children: children.length > 0 ? children : undefined,
        metadata: group,
      };
    },
  );

  // Available channels not yet in the editing group
  const availableChannels = React.useMemo(() => {
    if (!editingGroupId) return [];
    const g = Groups.find(({ UUID }) => UUID === editingGroupId);
    if (!g) return [];
    const usedUUIDs = new Set(
      g.GroupChannels.map((gc) => gc.SourceChannel.UUID),
    );
    return SourceChannels.filter(({ UUID }) => !usedUUIDs.has(UUID));
  }, [editingGroupId, Groups, SourceChannels]);

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
          return {
            ...gc,
            SourceChannel: { UUID: newSourceChannelUUID },
          };
        }),
      };
    });
    syncGroupState(newGroups);
    setReplacingChannelUUID(null);
  };

  const customChildRenderer = (
    childItem: ListItem<ChannelGroupListMetadata>,
  ) => {
    const meta = childItem.metadata as ChannelGroupChildMetadata;

    // "Add channel" row
    if (meta.type === "channel-editor") {
      const editorMeta = meta as ChannelEditorMetadata;
      return (
        <div style={{ padding: "4px 0" }}>
          {availableChannels.length === 0 ? (
            <span style={{ color: "#888", fontSize: "12px" }}>
              All channels in group
            </span>
          ) : (
            <select
              style={{
                width: "100%",
                padding: "4px",
                background: "#222",
                color: "#eee",
                border: "1px solid #444",
                borderRadius: "2px",
                fontSize: "12px",
              }}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  addChannelToGroup(editorMeta.groupUUID, e.target.value);
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled>
                Select channel to add...
              </option>
              {availableChannels.map((sc) => (
                <option key={sc.UUID} value={sc.UUID}>
                  {sc.Name}
                </option>
              ))}
            </select>
          )}
        </div>
      );
    }

    // Channel row in edit mode (toolbar + legacy histogram / contrast sliders)
    if (meta.type === "channel-item") {
      const channel = meta as ChannelItemMetadata;
      const isReplacing = replacingChannelUUID === channel.channel_uuid;

      // All source channels except the current one
      const replaceOptions = SourceChannels.filter(
        ({ UUID }) => UUID !== channel.source_uuid,
      );

      const channelItemAttrs = {
        group_uuid: channel.group_uuid,
        channel_uuid: channel.channel_uuid,
        source_uuid: channel.source_uuid,
        r: String(channel.r),
        g: String(channel.g),
        b: String(channel.b),
        lower_range: String(channel.lower_range),
        upper_range: String(channel.upper_range),
      };

      const legacyChannelItem =
        !props.retrievingMetadata &&
        !props.noLoader &&
        React.createElement(props.channelItemElement, {
          key: `embed-${channel.channel_uuid}`,
          ...channelItemAttrs,
        });

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            width: "100%",
            padding: "2px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <button
              type="button"
              title="Pick color"
              aria-label={`Pick color for ${channel.name}`}
              onClick={(e) => {
                e.stopPropagation();
                const el = e.currentTarget;
                const rect = el.getBoundingClientRect();
                setColorPickerChannelUUID(channel.channel_uuid);
                setColorPickerPos({
                  top: Math.min(rect.bottom + 4, window.innerHeight - 280),
                  left: Math.min(rect.left, window.innerWidth - 240),
                });
              }}
              style={{
                width: "14px",
                height: "14px",
                padding: 0,
                border: "1px solid var(--theme-glass-edge, #444)",
                borderRadius: "2px",
                backgroundColor: `#${channel.color}`,
                flexShrink: 0,
                cursor: "pointer",
              }}
            />
            {isReplacing ? (
              <ReplaceChannelSelect
                options={replaceOptions}
                onPick={(sourceUuid) => {
                  replaceChannelInGroup(
                    channel.group_uuid,
                    channel.channel_uuid,
                    sourceUuid,
                  );
                }}
                onDismiss={() => setReplacingChannelUUID(null)}
              />
            ) : (
              <span style={{ flex: 1, fontSize: "12px" }}>{channel.name}</span>
            )}
            <button
              type="button"
              title="Replace channel"
              style={{
                background: "none",
                border: "none",
                color: "#ccc",
                cursor: "pointer",
                padding: "2px",
                fontSize: "11px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setReplacingChannelUUID(
                  isReplacing ? null : channel.channel_uuid,
                );
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <title>Replace channel</title>
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              </svg>
            </button>
            <button
              type="button"
              title="Remove channel"
              style={{
                background: "none",
                border: "none",
                color: "#ccc",
                cursor: "pointer",
                padding: "2px",
                fontSize: "11px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                removeChannelFromGroup(
                  channel.group_uuid,
                  channel.channel_uuid,
                );
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <title>Remove channel</title>
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </button>
          </div>
          {legacyChannelItem ? (
            <div style={{ width: "100%", minWidth: 0 }}>
              {legacyChannelItem}
            </div>
          ) : null}
        </div>
      );
    }
    return null;
  };

  const handleItemClick = (
    item: ListItem<ChannelGroupListMetadata>,
    _event: React.MouseEvent,
  ) => {
    if (item.metadata && !("type" in item.metadata)) {
      const groupMeta = item.metadata as GroupItemMetadata;
      setActiveChannelGroup(groupMeta.UUID);
    }
  };

  const handleDelete = (itemId: string) => {
    const isGroup = Groups.some(({ UUID }) => UUID === itemId);
    if (isGroup) {
      deleteGroup(itemId);
      if (editingGroupId === itemId) setEditingGroupId(null);
    }
  };

  // Edit button toggles inline channel editor, with rename input at top
  const groupItemActions = (item: ListItem<ChannelGroupListMetadata>) => {
    if (item.metadata && "type" in item.metadata) return null;
    const groupMeta = item.metadata as GroupItemMetadata;
    const isEditing = editingGroupId === groupMeta.UUID;
    return (
      <button
        type="button"
        title={isEditing ? "Done editing" : "Edit group"}
        style={{
          background: "none",
          border: "none",
          color: isEditing ? "#007acc" : "#ccc",
          cursor: "pointer",
          padding: "4px",
          borderRadius: "3px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isEditing) {
            // Save rename if changed
            if (renameValue.trim() && renameValue.trim() !== groupMeta.name) {
              renameGroup(groupMeta.UUID, renameValue.trim());
            }
            setEditingGroupId(null);
            setReplacingChannelUUID(null);
          } else {
            setEditingGroupId(groupMeta.UUID);
            setRenameValue(groupMeta.name);
            setActiveChannelGroup(groupMeta.UUID);
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <title>
            {isEditing ? "Done editing channel group" : "Edit channel group"}
          </title>
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
      </button>
    );
  };

  const addGroupButton = (
    <button
      type="button"
      style={{
        background: "none",
        border: "1px solid #444",
        color: "#ccc",
        padding: "6px 10px",
        borderRadius: "4px",
        cursor: "pointer",
      }}
      onClick={createGroup}
      title="Add group"
    >
      + Add
    </button>
  );

  const channel_list = (
    <>
      {editingGroupId && (
        <div
          style={{
            marginBottom: "8px",
            padding: "8px 10px",
            borderRadius: "4px",
            border: "1px solid #444",
            backgroundColor: "#151515",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <label
            htmlFor={renameFieldId}
            style={{ fontSize: "12px", color: "#aaa", whiteSpace: "nowrap" }}
          >
            Name:
          </label>
          <input
            id={renameFieldId}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameValue.trim()) {
                renameGroup(editingGroupId, renameValue.trim());
              }
              if (e.key === "Escape") {
                setEditingGroupId(null);
              }
            }}
            style={{
              flex: 1,
              padding: "4px 6px",
              background: "#222",
              color: "#eee",
              border: "1px solid var(--theme-glass-edge)",
              borderRadius: "2px",
              fontSize: "13px",
            }}
          />
        </div>
      )}
      <ItemList
        items={listItems}
        title="Channel Groups"
        onItemClick={handleItemClick}
        showVisibilityToggle={false}
        showDeleteButton={Groups.length > 1}
        onDelete={handleDelete}
        showExpandToggle={false}
        emptyMessage="No groups yet"
        customChildRenderer={customChildRenderer}
        itemActions={groupItemActions}
        headerActions={addGroupButton}
      />
    </>
  );

  const controlPanelRef = React.useRef<HTMLElement>(null);

  // Switch to Stories tab when loading finishes or importRevision changes.
  const prevImportRevision = React.useRef(props.importRevision ?? 0);
  const wantsStoryTab = React.useRef(false);

  React.useEffect(() => {
    const rev = props.importRevision ?? 0;
    if (rev > prevImportRevision.current) {
      wantsStoryTab.current = true;
    }
    prevImportRevision.current = rev;
  }, [props.importRevision]);

  // Try to apply the tab switch after the element stabilizes post-load.
  // React StrictMode + state changes from image loading can destroy and recreate
  // the custom element, resetting its tab to the default. We wait for the element
  // to settle before switching.
  React.useEffect(() => {
    if (!wantsStoryTab.current) return;
    let cancelled = false;
    const clickStoryTab = (root: Element | ShadowRoot): boolean => {
      const buttons = root.querySelectorAll('button[role="tab"]');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === "Story") {
          (btn as HTMLElement).click();
          return true;
        }
      }
      for (const child of root.querySelectorAll("*")) {
        if (child.shadowRoot) {
          if (clickStoryTab(child.shadowRoot)) return true;
        }
      }
      return false;
    };
    // Wait for React to finish re-renders, then try clicking the tab
    const timer = setTimeout(() => {
      if (cancelled) return;
      const el = controlPanelRef.current;
      if (el?.shadowRoot && clickStoryTab(el.shadowRoot)) {
        wantsStoryTab.current = false;
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  const minerva_author_ui = React.createElement(
    props.controlPanelElement,
    { ref: controlPanelRef },
    <>
      {props.children}
      {waypointsPanel}
      <div
        slot="groups"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {channel_list}
      </div>
    </>,
  );

  const content = props.authorMode ? (
    <TextOther>{minerva_author_ui}</TextOther>
  ) : (
    props.children
  );

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
    <TextWrap>
      {content}
      {hidden ? "" : channelMenu}
      {colorPickerPortal}
    </TextWrap>
  );
};

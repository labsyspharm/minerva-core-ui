import * as React from "react";
import { ItemList, type ListItem } from "@/components/shared/common/ItemList";
import {
  PinIcon,
  PolylineIcon,
  TextIcon,
} from "@/components/shared/icons/OverlayIcons";
// Types
import type { ConfigWaypoint } from "@/lib/config";
import { downloadStoryJSON } from "@/lib/exportStory";
import { useOverlayStore } from "@/lib/stores";
import { getWaypointViewState } from "@/lib/waypoint";
import { WaypointAnnotationEditor } from "./WaypointAnnotationEditor";
import { WaypointContentEditor } from "./WaypointContentEditor";
import styles from "./WaypointsList.module.css";
import { WaypointsList as WaypointsListMasterDetail } from "./WaypointsListMasterDetail";

interface WaypointAnnotationEditorMetadata {
  type: "annotations-panel";
  story: ConfigWaypoint;
  storyIndex: number;
}

interface WaypointMarkdownEditorMetadata {
  type: "markdown-editor";
  story: ConfigWaypoint;
  storyIndex: number;
}

type WaypointChildMetadata =
  | WaypointAnnotationEditorMetadata
  | WaypointMarkdownEditorMetadata;

type WaypointItemMetadata = ConfigWaypoint | WaypointChildMetadata;

type WaypointsListProps = {
  viewOnly?: boolean;
};

const WaypointsList = (props: WaypointsListProps) => {
  const { viewOnly } = props;

  // Use Zustand store for stories and waypoints management
  const {
    stories,
    activeStoryIndex,
    setActiveStory,
    addStory,
    reorderStories,
    importWaypointAnnotations,
    clearImportedAnnotations,
    imageWidth,
    imageHeight,
    setTargetWaypointViewState,
    viewerViewportSize,
    editingViewstateWaypointIndex,
    setEditingViewstateWaypointIndex,
    removeStory,
  } = useOverlayStore();

  // Local state for markdown editing
  const [expandedMarkdownStories, setExpandedMarkdownStories] = React.useState<
    Set<string>
  >(new Set());

  // Local state for annotations panel expansion
  const [expandedAnnotationsStories, setExpandedAnnotationsStories] =
    React.useState<Set<string>>(new Set());

  // Drag and drop state
  const [draggedStoryId, setDraggedStoryId] = React.useState<string | null>(
    null,
  );
  const [_dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(
    null,
  );
  const previousActiveStoryIndexRef = React.useRef<number | null>(null);

  const className = [styles.center, styles.black].join(" ");

  // Auto-import annotations for the active story (or first story on initial load)
  // Also re-run when image dimensions become available
  React.useEffect(() => {
    if (stories.length === 0) return;
    // Wait for image dimensions to be set
    if (imageWidth === 0 || imageHeight === 0) return;

    // Determine which story to use - active story or default to first
    const storyIndex = activeStoryIndex ?? 0;
    const story = stories[storyIndex];

    if (story) {
      const prev = previousActiveStoryIndexRef.current;
      const store = useOverlayStore.getState();
      if (prev !== null && prev !== storyIndex) {
        store.persistImportedAnnotationsToStory(prev);
      }
      previousActiveStoryIndexRef.current = storyIndex;

      // Clear any existing imported annotations first
      clearImportedAnnotations();

      // Import annotations from the story
      const arrows = story.Arrows || [];
      const overlays = story.Overlays || [];
      if (arrows.length > 0 || overlays.length > 0) {
        importWaypointAnnotations(arrows, overlays);
      }
    }
  }, [
    stories,
    activeStoryIndex,
    imageWidth,
    imageHeight,
    clearImportedAnnotations,
    importWaypointAnnotations,
  ]);

  React.useEffect(() => {
    return () => {
      const p = previousActiveStoryIndexRef.current;
      if (p !== null) {
        const s = useOverlayStore.getState();
        if (s.imageWidth > 0 && s.imageHeight > 0) {
          s.persistImportedAnnotationsToStory(p);
        }
      }
    };
  }, []);

  // Convert stories to ListItem format with inline editors and annotations panel
  const listItems: ListItem<WaypointItemMetadata>[] = stories.map(
    (story, index) => {
      const storyId = story.UUID || `story-${index}`;
      const isMarkdownExpanded = expandedMarkdownStories.has(storyId);
      const isAnnotationsExpanded = expandedAnnotationsStories.has(storyId);
      const isDragging = draggedStoryId === storyId;

      // Build children array based on what's expanded
      const children: ListItem<WaypointItemMetadata>[] = [];

      if (isMarkdownExpanded) {
        children.push({
          id: `${storyId}-markdown-editor`,
          title: "Waypoint Text",
          subtitle: "Edit waypoint markdown content",
          isActive: false,
          isExpanded: false,
          metadata: {
            type: "markdown-editor",
            story,
            storyIndex: index,
          } as WaypointMarkdownEditorMetadata,
        });
      }

      if (isAnnotationsExpanded) {
        children.push({
          id: `${storyId}-annotations-panel`,
          title: "Annotations Panel",
          subtitle: "Overlays and annotations",
          isActive: false,
          isExpanded: false,
          metadata: {
            type: "annotations-panel",
            story,
            storyIndex: index,
          } as WaypointAnnotationEditorMetadata,
        });
      }

      return {
        id: storyId,
        title: story.Name,
        subtitle: story.Content
          ? story.Content.length > 30
            ? `${story.Content.substring(0, 30)}...`
            : story.Content
          : "Story",
        isActive: activeStoryIndex === index,
        isExpanded: isMarkdownExpanded || isAnnotationsExpanded,
        isDragging: isDragging,
        children: children.length > 0 ? children : undefined,
        metadata: story,
      };
    },
  );

  const handleItemClick = (
    item: ListItem<WaypointItemMetadata>,
    _event: React.MouseEvent,
  ) => {
    // Block changing waypoints while editing a viewstate
    if (editingViewstateWaypointIndex !== null) {
      return;
    }

    // Only handle story clicks, not child panel clicks
    if (item.metadata && !("type" in item.metadata)) {
      const story = item.metadata as ConfigWaypoint;
      const index = stories.findIndex((s) => s.UUID === story.UUID);
      if (index !== -1) {
        setActiveStory(index);

        // Collapse all annotations panels when switching stories to avoid showing
        // annotations from the new story under the old story's panel
        setExpandedAnnotationsStories(new Set());

        // Use the latest story from the store (authoritative) in case item.metadata is stale
        const currentStory = useOverlayStore.getState().stories[index];

        let viewState = null;
        if (
          viewerViewportSize?.width &&
          viewerViewportSize?.height &&
          imageWidth > 0 &&
          imageHeight > 0
        ) {
          viewState = getWaypointViewState(
            currentStory ?? story,
            imageWidth,
            imageHeight,
            viewerViewportSize.width,
            viewerViewportSize.height,
          );
        }
        if (viewState) {
          setTargetWaypointViewState(viewState);
        }

        // Note: annotations are imported automatically by the useEffect
        // that watches activeStoryIndex changes
      }
    }
  };

  // Handle annotations panel toggle
  const handleToggleAnnotationsPanel = (storyId: string) => {
    setExpandedAnnotationsStories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(storyId)) {
        newSet.delete(storyId);
      } else {
        newSet.add(storyId);
      }
      return newSet;
    });
  };

  // Handle markdown editor toggle
  const handleToggleMarkdownEditor = (storyId: string) => {
    setExpandedMarkdownStories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(storyId)) {
        newSet.delete(storyId);
      } else {
        newSet.add(storyId);
      }
      return newSet;
    });
  };

  const handleAddWaypoint = () => {
    const storyIndex = stories.length;
    const newWaypoint: ConfigWaypoint = {
      UUID: crypto.randomUUID(),
      State: { Expanded: true },
      Name: `Waypoint ${storyIndex + 1}`,
      Content: "",
      Arrows: [],
      Overlays: [],
    };

    addStory(newWaypoint);
    setActiveStory(storyIndex);

    // Open the text editor by default for quick editing
    setExpandedMarkdownStories((prev) => new Set(prev).add(newWaypoint.UUID));
    // Close annotations panels to keep UI simple on create
    setExpandedAnnotationsStories(new Set());
  };

  const handleStartEditViewstate = (storyId: string) => {
    const index = stories.findIndex((s) => s.UUID === storyId);
    if (index === -1) return;
    setActiveStory(index);
    setEditingViewstateWaypointIndex(index);
  };

  const handleCancelEditViewstate = () => {
    setEditingViewstateWaypointIndex(null);
  };

  const handleSaveEditViewstate = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    // Don't persist — just exit edit mode. Viewstate save/export deferred.
    setEditingViewstateWaypointIndex(null);
  };

  const handleDeleteWaypoint = (itemId: string) => {
    const index = stories.findIndex((s) => s.UUID === itemId);
    if (index === -1) return;

    const storyId = stories[index]?.UUID;
    removeStory(index);

    if (storyId) {
      setExpandedMarkdownStories((prev) => {
        const next = new Set(prev);
        next.delete(storyId);
        return next;
      });
      setExpandedAnnotationsStories((prev) => {
        const next = new Set(prev);
        next.delete(storyId);
        return next;
      });
    }
  };

  // Drag and drop handlers
  const handleDragStart = (storyId: string, event: React.DragEvent) => {
    setDraggedStoryId(storyId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", storyId);
  };

  const handleDragEnd = () => {
    setDraggedStoryId(null);
    setDropTargetIndex(null);
  };

  const handleDragOver = (storyId: string, event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    // Find the index of the target story
    const targetIndex = stories.findIndex((story) => story.UUID === storyId);
    if (targetIndex !== -1) {
      setDropTargetIndex(targetIndex);
    }
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = (targetStoryId: string, draggedStoryId: string) => {
    if (draggedStoryId && draggedStoryId !== targetStoryId) {
      const fromIndex = stories.findIndex(
        (story) => story.UUID === draggedStoryId,
      );
      const toIndex = stories.findIndex(
        (story) => story.UUID === targetStoryId,
      );

      if (fromIndex !== -1 && toIndex !== -1) {
        reorderStories(fromIndex, toIndex);
      }
    }
    setDraggedStoryId(null);
    setDropTargetIndex(null);
  };

  // Custom item actions for stories
  const storyItemActions = (item: ListItem<WaypointItemMetadata>) => {
    // Only show actions for story items, not child panel items
    if (item.metadata && "type" in item.metadata) {
      return null;
    }

    const story = item.metadata as ConfigWaypoint;
    const storyId = story.UUID || item.id;
    const isAnnotationsExpanded = expandedAnnotationsStories.has(storyId);
    const isMarkdownExpanded = expandedMarkdownStories.has(storyId);
    const index = stories.findIndex((s) => s.UUID === storyId);
    const isEditingViewstate =
      editingViewstateWaypointIndex !== null &&
      index !== -1 &&
      editingViewstateWaypointIndex === index;

    return (
      <div style={{ display: "flex", gap: "4px" }}>
        {/* Text Editor Button */}
        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: isMarkdownExpanded ? "#007acc" : "#ccc",
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
            handleToggleMarkdownEditor(storyId);
          }}
          title={
            isMarkdownExpanded
              ? "Hide text editor"
              : "Show text editor for waypoint content"
          }
        >
          <TextIcon style={{ width: "14px", height: "14px" }} />
        </button>

        {/* Annotations Panel Button */}
        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: isAnnotationsExpanded ? "#007acc" : "#ccc",
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
            handleToggleAnnotationsPanel(storyId);
          }}
          title={
            isAnnotationsExpanded
              ? "Hide annotations panel"
              : "Show annotations panel"
          }
        >
          <PolylineIcon style={{ width: "14px", height: "14px" }} />
        </button>

        {/* Viewstate Edit Button (Save does not persist — deferred) */}
        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: isEditingViewstate ? "#007acc" : "#ccc",
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
            handleStartEditViewstate(storyId);
          }}
          title="Edit waypoint viewstate"
        >
          <PinIcon style={{ width: "14px", height: "14px" }} />
        </button>
      </div>
    );
  };

  // Custom child renderer for inline panels (annotations, markdown editor)
  const customChildRenderer = (
    childItem: ListItem<WaypointItemMetadata>,
    _parentItem: ListItem<WaypointItemMetadata>,
  ) => {
    if (
      !childItem.metadata ||
      !("type" in (childItem.metadata as WaypointChildMetadata))
    ) {
      return null;
    }

    const metadata = childItem.metadata as WaypointChildMetadata;

    if (metadata.type === "annotations-panel") {
      const story = metadata.story;

      return (
        <div className={styles.annotationsPanelInline}>
          <WaypointAnnotationEditor
            story={story}
            storyIndex={metadata.storyIndex}
          />
        </div>
      );
    }

    if (metadata.type === "markdown-editor") {
      const story = metadata.story;

      return (
        <div className={styles.annotationsPanelInline}>
          <WaypointContentEditor
            story={story}
            storyIndex={metadata.storyIndex}
          />
        </div>
      );
    }

    // Fallback to default rendering
    return null;
  };

  return (
    <div slot="waypoints" className={className}>
      {/* Waypoints panel content */}
      {editingViewstateWaypointIndex !== null && (
        <div
          style={{
            marginBottom: "8px",
            padding: "8px 10px",
            borderRadius: "4px",
            border: "1px solid #444",
            backgroundColor: "#151515",
            color: "#ddd",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            fontSize: "12px",
          }}
        >
          <span>
            Editing viewstate for{" "}
            <strong>
              {stories[editingViewstateWaypointIndex]
                ? stories[editingViewstateWaypointIndex].Name
                : "waypoint"}
            </strong>
            . Pan and zoom the image to set the view.
          </span>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              style={{
                background: "#007acc",
                border: "none",
                color: "#fff",
                padding: "4px 8px",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleSaveEditViewstate(e);
              }}
              title="Save waypoint viewstate (not persisted)"
            >
              Save
            </button>
            <button
              type="button"
              style={{
                background: "none",
                border: "1px solid #555",
                color: "#ccc",
                padding: "4px 8px",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
              }}
              onClick={handleCancelEditViewstate}
              title="Cancel editing viewstate"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <ItemList
        items={listItems}
        title="Waypoints"
        headerActions={
          viewOnly ? null : (
            <div style={{ display: "flex", gap: "6px" }}>
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
                onClick={() =>
                  downloadStoryJSON(stories, imageWidth, imageHeight)
                }
                title="Export story as JSON"
              >
                Export JSON
              </button>
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
                onClick={handleAddWaypoint}
                title="Add waypoint"
              >
                + Add
              </button>
            </div>
          )
        }
        onItemClick={handleItemClick}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        showVisibilityToggle={false}
        showDeleteButton={!viewOnly}
        onDelete={viewOnly ? undefined : handleDeleteWaypoint}
        showExpandToggle={false}
        emptyMessage="No waypoints yet"
        customChildRenderer={customChildRenderer}
        itemActions={viewOnly ? null : storyItemActions}
        noHeader={viewOnly}
      />
    </div>
  );
};

export {
  WaypointsListMasterDetail as WaypointsList,
  WaypointsList as LegacyWaypointsList,
};
export type { WaypointsListProps };

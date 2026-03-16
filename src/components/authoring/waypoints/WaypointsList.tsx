import * as React from "react";
import { ItemList, type ListItem } from "@/components/shared/common/ItemList";
import { PolylineIcon, TextIcon } from "@/components/shared/icons/OverlayIcons";
// Types
import type { ConfigWaypoint } from "@/lib/config";
import { useOverlayStore } from "@/lib/stores";
import { WaypointAnnotationEditor } from "./WaypointAnnotationEditor";
import { WaypointContentEditor } from "./WaypointContentEditor";
import styles from "./WaypointsList.module.css";

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
    reorderStories,
    importWaypointAnnotations,
    clearImportedAnnotations,
    imageWidth,
    imageHeight,
    setTargetWaypointViewState,
    updateStory,
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

  const handleItemClick = (item: ListItem<WaypointItemMetadata>) => {
    // Only handle story clicks, not child panel clicks
    if (item.metadata && !("type" in item.metadata)) {
      const story = item.metadata as ConfigWaypoint;
      const index = stories.findIndex((s) => s.UUID === story.UUID);
      if (index !== -1) {
        setActiveStory(index);

        // Collapse all annotations panels when switching stories to avoid showing
        // annotations from the new story under the old story's panel
        setExpandedAnnotationsStories(new Set());

        // Trigger view state change if waypoint has Pan/Zoom properties
        // These are in Minerva 1.5 (OSD) format and will be converted by VivView
        const { Pan, Zoom } = story;
        if (Pan !== undefined || Zoom !== undefined) {
          setTargetWaypointViewState(Pan || null, Zoom ?? null);
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

    return (
      <div style={{ display: "flex", gap: "4px" }}>
        {/* Drag Handle */}
        <button
          type="button"
          style={{
            cursor: "grab",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
            fontSize: "12px",
            background: "none",
            border: "none",
          }}
          draggable
          onDragStart={(e) => handleDragStart(storyId, e)}
          onDragEnd={(_e) => handleDragEnd()}
          title="Drag to reorder"
        >
          ⋮⋮
        </button>

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
      <ItemList
        items={listItems}
        title="Waypoints"
        onItemClick={handleItemClick}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        showVisibilityToggle={false}
        showDeleteButton={false}
        showExpandToggle={false}
        emptyMessage="No waypoints yet"
        customChildRenderer={customChildRenderer}
        itemActions={viewOnly ? null : storyItemActions}
        noHeader={viewOnly}
      />
    </div>
  );
};

export { WaypointsList };
export type { WaypointsListProps };

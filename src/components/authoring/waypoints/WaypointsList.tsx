import * as React from "react";
import { ItemList, type ListItem } from "@/components/shared/common/ItemList";
import {
  PinIcon,
  PolylineIcon,
  TextIcon,
} from "@/components/shared/icons/OverlayIcons";
// Types
import type { ConfigWaypoint } from "@/lib/config";
import { storeStoryWaypointToConfigWaypoint } from "@/lib/exportStory";
import type { StoreStoryWaypoint } from "@/lib/stores";
import { useOverlayStore } from "@/lib/stores";
import {
  getViewerBoundsFromSnapshot,
  getViewerViewportSnapshotFromStore,
  orthographicZoomToNumber,
} from "@/lib/viewerViewport";
import { WaypointAnnotationEditor } from "./WaypointAnnotationEditor";
import { WaypointContentEditor } from "./WaypointContentEditor";
import styles from "./WaypointsList.module.css";
import {
  WaypointsList as WaypointsListMasterDetail,
  type WaypointsListProps,
} from "./WaypointsListMasterDetail";

interface WaypointAnnotationEditorMetadata {
  type: "annotations-panel";
  story: StoreStoryWaypoint;
  storyIndex: number;
}

interface WaypointMarkdownEditorMetadata {
  type: "markdown-editor";
  story: StoreStoryWaypoint;
  storyIndex: number;
}

type WaypointChildMetadata =
  | WaypointAnnotationEditorMetadata
  | WaypointMarkdownEditorMetadata;

type WaypointItemMetadata = StoreStoryWaypoint | WaypointChildMetadata;

const WaypointsList = (_props: WaypointsListProps) => {
  // Zustand narrative rows (`stories` → `storyDocument.waypoints` on export)
  const {
    stories,
    activeStoryIndex,
    setActiveStory,
    setActiveChannelGroup,
    addStory,
    reorderStories,
    importWaypointAnnotations,
    Shapes,
    updateStory,
    imageWidth,
    imageHeight,
    setTargetWaypointCamera,
    editingViewstateWaypointIndex,
    setEditingViewstateWaypointIndex,
    removeStory,
    persistImportedAnnotationsToStory,
    Groups,
    captureSquareViewportThumbnail,
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

      // Replace imported shapes from the story; keep user-drawn annotations (see `mergeAnnotationsAfterWaypointImport`).
      importWaypointAnnotations(story, true, Shapes);
    }
  }, [
    stories,
    activeStoryIndex,
    imageWidth,
    imageHeight,
    Shapes,
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
      const storyId = story.id || `story-${index}`;
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
        title: story.title,
        subtitle: story.content
          ? story.content.length > 30
            ? `${story.content.substring(0, 30)}...`
            : story.content
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
      const story = item.metadata as StoreStoryWaypoint;
      const index = stories.findIndex((s) => s.id === story.id);
      if (index !== -1) {
        setActiveStory(index);
        const foundGroup =
          Groups.find((group) => group.Name === story.group) || Groups[0];
        if (foundGroup) {
          setActiveChannelGroup(foundGroup.UUID);
        }

        // Collapse all annotations panels when switching stories to avoid showing
        // annotations from the new story under the old story's panel
        setExpandedAnnotationsStories(new Set());

        // Use the latest story from the store (authoritative) in case item.metadata is stale
        const currentStory = useOverlayStore.getState().stories[index];
        const navStory = currentStory ?? story;
        if (imageWidth > 0 && imageHeight > 0) {
          setTargetWaypointCamera(storeStoryWaypointToConfigWaypoint(navStory));
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
      Group:
        Groups.find(
          (group) =>
            group.UUID === useOverlayStore.getState().activeChannelGroupId,
        )?.Name ?? Groups[0]?.Name,
      ShapeIds: [],
    };

    addStory(newWaypoint);
    setActiveStory(storyIndex);

    // Open the text editor by default for quick editing
    setExpandedMarkdownStories((prev) => new Set(prev).add(newWaypoint.UUID));
    // Close annotations panels to keep UI simple on create
    setExpandedAnnotationsStories(new Set());
  };

  const handleStartEditViewstate = (storyId: string) => {
    const index = stories.findIndex((s) => s.id === storyId);
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
    const index = editingViewstateWaypointIndex;
    if (index === null || index < 0 || index >= stories.length) {
      setEditingViewstateWaypointIndex(null);
      return;
    }

    const snap = getViewerViewportSnapshotFromStore();
    const bounds = snap ? getViewerBoundsFromSnapshot(snap) : null;
    const zoom = snap ? orthographicZoomToNumber(snap.viewState.zoom) : null;
    const target = snap?.viewState.target;
    const viewStateCanon =
      snap &&
      zoom !== null &&
      Array.isArray(target) &&
      target.length >= 3 &&
      typeof target[0] === "number" &&
      typeof target[1] === "number" &&
      typeof target[2] === "number"
        ? {
            zoom,
            target: [target[0], target[1], target[2]] as [
              number,
              number,
              number,
            ],
          }
        : null;

    if (!bounds || !viewStateCanon) {
      const st = useOverlayStore.getState();
      console.warn(
        "[Minerva] waypoint view not saved: no bounds from viewer (camera/size not ready). " +
          "Try pan/zoom once or reload.",
        {
          index,
          viewerViewState: st.viewerViewState,
          viewerViewportSize: st.viewerViewportSize,
          imageWidth: st.imageWidth,
          imageHeight: st.imageHeight,
        },
      );
      setEditingViewstateWaypointIndex(null);
      return;
    }

    const loaded = useOverlayStore.getState().viewerImageLayersLoaded;
    const thumbnail = loaded ? captureSquareViewportThumbnail() : null;
    updateStory(index, {
      Bounds: bounds,
      ViewState: viewStateCanon,
      Pan: undefined,
      Zoom: undefined,
      ...(thumbnail ? { ThumbnailDataUrl: thumbnail } : {}),
    });

    if (!loaded) {
      const tryThumb = (attempt: number) => {
        if (attempt > 100) return;
        const s = useOverlayStore.getState();
        if (s.activeStoryIndex !== index) return;
        if (!s.viewerImageLayersLoaded) {
          window.setTimeout(() => tryThumb(attempt + 1), 200);
          return;
        }
        const t = s.captureSquareViewportThumbnail();
        if (t) s.updateStory(index, { ThumbnailDataUrl: t });
      };
      tryThumb(0);
    }

    persistImportedAnnotationsToStory(index);

    useOverlayStore.getState().downloadStoryJsonFile();

    setEditingViewstateWaypointIndex(null);
  };

  const handleDeleteWaypoint = (itemId: string) => {
    const index = stories.findIndex((s) => s.id === itemId);
    if (index === -1) return;

    const storyId = stories[index]?.id;
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
    const targetIndex = stories.findIndex((story) => story.id === storyId);
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
        (story) => story.id === draggedStoryId,
      );
      const toIndex = stories.findIndex((story) => story.id === targetStoryId);

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

    const story = item.metadata as StoreStoryWaypoint;
    const storyId = story.id || item.id;
    const isAnnotationsExpanded = expandedAnnotationsStories.has(storyId);
    const isMarkdownExpanded = expandedMarkdownStories.has(storyId);
    const index = stories.findIndex((s) => s.id === storyId);
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

        {/* Viewstate edit: pin to enter mode; banner Save writes view + downloads story JSON */}
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
                ? stories[editingViewstateWaypointIndex].title
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
              title="Save camera to this waypoint, persist annotations, download story.json"
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
              onClick={handleAddWaypoint}
              title="Add waypoint"
            >
              + Add
            </button>
          </div>
        }
        onItemClick={handleItemClick}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        showVisibilityToggle={false}
        showDeleteButton
        onDelete={handleDeleteWaypoint}
        showExpandToggle={false}
        emptyMessage="No waypoints yet"
        customChildRenderer={customChildRenderer}
        itemActions={storyItemActions}
      />
    </div>
  );
};

export {
  WaypointsListMasterDetail as WaypointsList,
  WaypointsList as LegacyWaypointsList,
};
export type { WaypointsListProps };

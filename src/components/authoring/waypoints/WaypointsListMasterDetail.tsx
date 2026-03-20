import * as React from "react";
import AnnotationsIcon from "@/components/shared/icons/annotations.svg?react";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import { PinIcon } from "@/components/shared/icons/OverlayIcons";
import type { ConfigWaypoint } from "@/lib/config";
import { useOverlayStore } from "@/lib/stores";
import { getWaypointViewState } from "@/lib/waypoint";
import { WaypointAnnotationEditor } from "./WaypointAnnotationEditor";
import { WaypointContentEditor } from "./WaypointContentEditor";
import styles from "./WaypointsList.module.css";

export type WaypointsListProps = {
  viewOnly?: boolean;
};

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

const countWaypointAnnotations = (story: ConfigWaypoint) => {
  return (story.Arrows?.length ?? 0) + (story.Overlays?.length ?? 0);
};

const annotationCountLabel = (count: number) =>
  `${count} ${count === 1 ? "annotation" : "annotations"}`;

const WaypointsList = (props: WaypointsListProps) => {
  const { viewOnly } = props;
  const canEdit = !viewOnly;

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
    sam2ViewportSize,
    editingViewstateWaypointIndex,
    setEditingViewstateWaypointIndex,
    removeStory,
  } = useOverlayStore();

  const detailBodyRef = React.useRef<HTMLDivElement | null>(null);

  // Detail view state (master-detail).
  const [detailStoryId, setDetailStoryId] = React.useState<string | null>(null);

  const [detailMarkdownExpanded, setDetailMarkdownExpanded] =
    React.useState(true);
  const [detailAnnotationsExpanded, setDetailAnnotationsExpanded] =
    React.useState(true);

  React.useEffect(() => {
    if (detailStoryId) {
      setDetailMarkdownExpanded(true);
      setDetailAnnotationsExpanded(true);
    }
  }, [detailStoryId]);

  // Drag and drop state.
  const [draggedStoryId, setDraggedStoryId] = React.useState<string | null>(
    null,
  );
  const [dropTargetStoryId, setDropTargetStoryId] = React.useState<
    string | null
  >(null);

  const detailStoryIndex = detailStoryId
    ? stories.findIndex((s) => s.UUID === detailStoryId)
    : -1;
  const detailStory = detailStoryIndex >= 0 ? stories[detailStoryIndex] : null;

  // Auto-import annotations for the active story (or first story on initial load).
  React.useEffect(() => {
    if (stories.length === 0) return;
    if (imageWidth === 0 || imageHeight === 0) return;

    const storyIndex = activeStoryIndex ?? 0;
    const story = stories[storyIndex];
    if (!story) return;

    clearImportedAnnotations();

    const arrows = story.Arrows || [];
    const overlays = story.Overlays || [];
    if (arrows.length > 0 || overlays.length > 0) {
      importWaypointAnnotations(arrows, overlays);
    }
  }, [
    stories,
    activeStoryIndex,
    imageWidth,
    imageHeight,
    clearImportedAnnotations,
    importWaypointAnnotations,
  ]);

  const activateStoryIndex = (index: number) => {
    setActiveStory(index);

    // Trigger view state change: prefer ViewState (Deck.gl format), else
    // convert legacy Pan/Zoom. ViewState does not need viewport dims.
    const currentStory = useOverlayStore.getState().stories[index];
    let viewState = null;
    if (
      currentStory?.ViewState &&
      typeof currentStory.ViewState.zoom === "number" &&
      Array.isArray(currentStory.ViewState.target) &&
      currentStory.ViewState.target.length === 3
    ) {
      viewState = currentStory.ViewState;
    } else if (sam2ViewportSize?.width && imageWidth > 0 && imageHeight > 0) {
      viewState = getWaypointViewState(
        currentStory ?? stories[index],
        imageWidth,
        imageHeight,
        sam2ViewportSize.width,
      );
    }
    if (viewState) {
      setTargetWaypointViewState(viewState);
    }
  };

  const canSwitchWaypoints = editingViewstateWaypointIndex === null;

  const openDetailForStoryId = (storyId: string) => {
    if (!canEdit) return;
    if (!canSwitchWaypoints) return;

    const index = stories.findIndex((s) => s.UUID === storyId);
    if (index === -1) return;

    activateStoryIndex(index);
    setDetailStoryId(storyId);

    // Slide-to-top behavior: ensure detail scroll starts at the top.
    requestAnimationFrame(() => {
      detailBodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
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
    activateStoryIndex(storyIndex);
    setDetailStoryId(newWaypoint.UUID);

    requestAnimationFrame(() => {
      detailBodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const handleStartEditViewstate = (storyId: string) => {
    const index = stories.findIndex((s) => s.UUID === storyId);
    if (index === -1) return;
    activateStoryIndex(index);
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

  const handleDragStart = (storyId: string, event: React.DragEvent) => {
    if (!canEdit) return;
    setDraggedStoryId(storyId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", storyId);
  };

  const handleDragEnd = () => {
    setDraggedStoryId(null);
    setDropTargetStoryId(null);
  };

  const handleDragOverRow = (storyId: string, event: React.DragEvent) => {
    if (!canEdit) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetStoryId(storyId);
  };

  const handleDragLeaveRow = () => {
    if (!canEdit) return;
    setDropTargetStoryId(null);
  };

  const handleDropOnRow = (targetStoryId: string) => {
    if (!canEdit) return;
    if (!draggedStoryId || draggedStoryId === targetStoryId) return;

    const fromIndex = stories.findIndex((s) => s.UUID === draggedStoryId);
    const toIndex = stories.findIndex((s) => s.UUID === targetStoryId);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderStories(fromIndex, toIndex);
    }

    setDraggedStoryId(null);
    setDropTargetStoryId(null);
  };

  const renderViewstateBanner = () => {
    if (editingViewstateWaypointIndex === null) return null;

    return (
      <div className={styles.subtleBanner}>
        <span>
          Editing viewstate for{" "}
          <strong>
            {stories[editingViewstateWaypointIndex]
              ? stories[editingViewstateWaypointIndex].Name
              : "waypoint"}
          </strong>
          . Pan and zoom the image to set the view.
        </span>
        <div className={styles.subtleBannerActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={(e) => handleSaveEditViewstate(e)}
            title="Save waypoint viewstate (not persisted)"
          >
            Save
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleCancelEditViewstate}
            title="Cancel editing viewstate"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  const listHeader = (
    <div className={styles.compactHeader}>
      <div className={styles.headerTitle}>
        <span>Waypoints</span>
        <span className={styles.headerCount}>({stories.length})</span>
      </div>

      <div className={styles.headerActions}>
        {canEdit && (
          <button
            type="button"
            className={styles.iconHeaderButton}
            onClick={() => {
              if (stories.length === 0) return;
              const indexToRemove = activeStoryIndex ?? 0;
              if (indexToRemove < 0 || indexToRemove >= stories.length) return;
              removeStory(indexToRemove);
            }}
            disabled={stories.length === 0}
            title="Delete active waypoint"
          >
            <TrashIcon />
          </button>
        )}

        {canEdit && (
          <button
            type="button"
            className={styles.iconHeaderButton}
            onClick={handleAddWaypoint}
            title="Add waypoint"
          >
            <PlusIcon />
          </button>
        )}
      </div>
    </div>
  );

  const renderList = () => (
    <div className={styles.panel}>
      {listHeader}
      {renderViewstateBanner()}
      {stories.length === 0 ? (
        <div className={styles.emptyMessage}>No waypoints yet</div>
      ) : (
        <ul className={styles.rows}>
          {stories.map((story, index) => {
            const storyId = story.UUID;
            const annotationCount = countWaypointAnnotations(story);
            const annotationTitle = annotationCountLabel(annotationCount);
            const isActive = activeStoryIndex === index;
            const isDragging = draggedStoryId === storyId;
            const isDropTarget = dropTargetStoryId === storyId;

            const rowDragProps = canEdit
              ? ({
                  draggable: true,
                  onDragStart: (e: React.DragEvent) =>
                    handleDragStart(storyId, e),
                  onDragEnd: handleDragEnd,
                } as const)
              : ({} as const);

            return (
              <li
                key={storyId}
                className={[
                  styles.compactRow,
                  canEdit ? styles.compactRowDraggable : "",
                  isActive ? styles.compactRowActive : "",
                  isDragging ? styles.compactRowDragging : "",
                  isDropTarget ? styles.compactRowDropTarget : "",
                ].join(" ")}
                onDragOver={(e) => handleDragOverRow(storyId, e)}
                onDragLeave={handleDragLeaveRow}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnRow(storyId);
                }}
              >
                {canEdit ? (
                  <button
                    type="button"
                    {...rowDragProps}
                    className={styles.rowOpenDetailButton}
                    title="Open waypoint details"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetailForStoryId(storyId);
                    }}
                  >
                    <ChevronDownIcon
                      className={styles.waypointChevronRight}
                      aria-hidden
                    />
                  </button>
                ) : (
                  <div className={styles.rowChevronSpacer} aria-hidden />
                )}

                <div className={styles.rowThumbnail} aria-hidden />

                <button
                  type="button"
                  {...rowDragProps}
                  className={styles.rowMainHit}
                  disabled={!canSwitchWaypoints}
                  onClick={() => activateStoryIndex(index)}
                  onDoubleClick={() => openDetailForStoryId(storyId)}
                >
                  <div className={styles.rowTextStack}>
                    <div className={styles.rowTitleRow}>
                      <span className={styles.rowTitle} title={story.Name}>
                        {story.Name}
                      </span>
                      <span
                        className={styles.annotationBadge}
                        title={annotationTitle}
                      >
                        <span className={styles.visuallyHidden}>
                          {annotationTitle}
                        </span>
                        <AnnotationsIcon
                          className={styles.annotationIcon}
                          aria-hidden
                        />
                        <span className={styles.annotationCount} aria-hidden>
                          {annotationCount}
                        </span>
                      </span>
                    </div>
                    <span
                      className={styles.rowContent}
                      title={story.Content ?? ""}
                    >
                      {story.Content ?? ""}
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

  const renderDetail = () => {
    if (!detailStory) return renderList();

    const detailAnnotationCount = countWaypointAnnotations(detailStory);
    const detailAnnotationText = annotationCountLabel(detailAnnotationCount);

    const isEditingThisWaypoint =
      editingViewstateWaypointIndex !== null &&
      editingViewstateWaypointIndex === detailStoryIndex;

    return (
      <div className={styles.detailView}>
        <div className={styles.detailHeader}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => setDetailStoryId(null)}
            title="Back to waypoint list"
          >
            <ChevronDownIcon
              className={styles.waypointChevronLeft}
              aria-hidden
            />
            <span>Back</span>
          </button>
          <div className={styles.detailTitle} title={detailStory.Name}>
            {detailStory.Name}
          </div>
          {canEdit && !isEditingThisWaypoint && (
            <button
              type="button"
              className={styles.headerButton}
              onClick={() => handleStartEditViewstate(detailStory.UUID)}
              title="Edit waypoint viewstate (pan/zoom)"
              style={{ marginLeft: "auto" }}
            >
              <PinIcon
                style={{ width: "14px", height: "14px", marginRight: "6px" }}
              />{" "}
              Edit Viewstate
            </button>
          )}
        </div>

        <div className={styles.detailBody} ref={detailBodyRef}>
          {renderViewstateBanner()}
          <div className={styles.detailBodyInner}>
            <div
              className={[
                styles.detailCollapsible,
                styles.detailMarkdownSection,
                !detailMarkdownExpanded
                  ? styles.detailCollapsibleCollapsed
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className={styles.detailCollapsibleHeader}
                aria-expanded={detailMarkdownExpanded}
                onClick={() => setDetailMarkdownExpanded((prev) => !prev)}
              >
                <ChevronDownIcon
                  className={styles.detailCollapsibleChevron}
                  aria-hidden
                />
                <span className={styles.detailCollapsibleTitle}>Markdown</span>
              </button>
              {detailMarkdownExpanded ? (
                <div className={styles.detailCollapsibleBody}>
                  <WaypointContentEditor
                    key={detailStory.UUID}
                    variant="detail"
                    story={detailStory}
                    storyIndex={detailStoryIndex}
                  />
                </div>
              ) : null}
            </div>
            <div
              className={[
                styles.detailCollapsible,
                styles.detailAnnotationsSection,
                !detailAnnotationsExpanded
                  ? styles.detailCollapsibleCollapsed
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className={styles.detailCollapsibleHeader}
                aria-expanded={detailAnnotationsExpanded}
                title={detailAnnotationText}
                onClick={() => setDetailAnnotationsExpanded((prev) => !prev)}
              >
                <ChevronDownIcon
                  className={styles.detailCollapsibleChevron}
                  aria-hidden
                />
                <span className={styles.detailCollapsibleTitle}>
                  Annotations{" "}
                  <span className={styles.detailCollapsibleCount}>
                    ({detailAnnotationCount})
                  </span>
                </span>
              </button>
              {detailAnnotationsExpanded ? (
                <div className={styles.detailCollapsibleBody}>
                  <WaypointAnnotationEditor
                    embeddedInScrollParent
                    story={detailStory}
                    storyIndex={detailStoryIndex}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div slot="waypoints" className={[styles.panel, styles.black].join(" ")}>
      {detailStoryId ? renderDetail() : renderList()}
    </div>
  );
};

export { WaypointsList };

import * as React from "react";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import DownloadIcon from "@/components/shared/icons/download.svg?react";
import JumpToViewIcon from "@/components/shared/icons/jump-to-view.svg?react";
import OverwriteViewIcon from "@/components/shared/icons/overwrite-view.svg?react";
import PlayIcon from "@/components/shared/icons/play.svg?react";
import AnnotationsIcon from "@/components/shared/icons/shapes.svg?react";
import type { ConfigWaypoint } from "@/lib/authoring/config";
import { useAppStore } from "@/lib/stores/app-store";
import {
  type ConfigGroup,
  type ConfigSourceChannel,
  useDocumentStore,
} from "@/lib/stores/document-store";
import {
  downloadStoryDocument,
  type StoreStoryWaypoint,
  storeStoryWaypointToConfigWaypoint,
} from "@/lib/story/storyDocument";
import {
  getViewerBoundsFromSnapshot,
  getViewerViewportSnapshotFromStore,
  orthographicZoomToNumber,
} from "@/lib/viewer/viewerViewport";
import { WAYPOINT_THUMBNAIL_PIXEL_SIZE } from "@/lib/waypoints/waypointThumbnail";
import { WaypointAnnotationEditor } from "./WaypointAnnotationEditor";
import { WaypointContentEditor } from "./WaypointContentEditor";
import styles from "./WaypointsList.module.css";

export type WaypointsListProps = {
  viewOnly?: boolean;
  /** Open playback/presentation layout for the current waypoint (author mode). */
  onEnterPlaybackPreview?: () => void;
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

const countWaypointAnnotations = (story: StoreStoryWaypoint) =>
  story.shapeIds?.length ?? 0;

const annotationCountLabel = (count: number) =>
  `${count} ${count === 1 ? "shape" : "shapes"}`;

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

const WaypointsList = (props: WaypointsListProps) => {
  const { viewOnly, onEnterPlaybackPreview } = props;
  const canEdit = !viewOnly;

  const waypoints = useDocumentStore((s) => s.waypoints);
  const shapes = useDocumentStore((s) => s.shapes);
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const sourceChannels = useDocumentStore((s) => s.sourceChannels);
  const imageWidth = useDocumentStore((s) => s.imageWidth);
  const imageHeight = useDocumentStore((s) => s.imageHeight);
  const {
    activeStoryIndex,
    setActiveStory,
    setActiveChannelGroup,
    addStory,
    updateStory,
    reorderStories,
    importWaypointShapes,
    persistImportedShapesToStory,
    setTargetWaypointCamera,
    captureSquareViewportThumbnail,
    removeStory,
    setShowSquareViewportOverlay,
    setAuthoringWaypointEditorOpen,
    setAuthoringWaypointShapesIndex,
    handleToolChange,
  } = useAppStore();

  const previousDetailStoryIdRef = React.useRef<string | null>(null);

  const detailBodyRef = React.useRef<HTMLDivElement | null>(null);
  const detailTitleFieldId = React.useId();
  const detailGroupFieldId = React.useId();
  const channelGroupDropdownRef = React.useRef<HTMLDivElement | null>(null);

  const [channelGroupMenuOpen, setChannelGroupMenuOpen] = React.useState(false);

  // Detail view state (master-detail).
  const [detailStoryId, setDetailStoryId] = React.useState<string | null>(null);

  const [detailMarkdownExpanded, setDetailMarkdownExpanded] =
    React.useState(true);
  const [detailAnnotationsExpanded, setDetailAnnotationsExpanded] =
    React.useState(true);

  React.useEffect(() => {
    setAuthoringWaypointEditorOpen(detailStoryId != null);
    return () => setAuthoringWaypointEditorOpen(false);
  }, [detailStoryId, setAuthoringWaypointEditorOpen]);

  React.useEffect(() => {
    const prev = previousDetailStoryIdRef.current;
    if (prev != null && detailStoryId == null) {
      handleToolChange("move");
    }
    previousDetailStoryIdRef.current = detailStoryId;
  }, [detailStoryId, handleToolChange]);

  React.useEffect(() => {
    if (detailStoryId) {
      setDetailMarkdownExpanded(true);
      setDetailAnnotationsExpanded(true);
    }
    setChannelGroupMenuOpen(false);
  }, [detailStoryId]);

  React.useEffect(() => {
    if (!channelGroupMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = channelGroupDropdownRef.current;
      if (root && !root.contains(event.target as Node)) {
        setChannelGroupMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setChannelGroupMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [channelGroupMenuOpen]);

  // Drag and drop state.
  const [draggedStoryId, setDraggedStoryId] = React.useState<string | null>(
    null,
  );
  const [dropTargetStoryId, setDropTargetStoryId] = React.useState<
    string | null
  >(null);
  const pendingThumbnailCaptureTimeoutRef = React.useRef<number | null>(null);
  const overlayFlashTimeoutRef = React.useRef<number | null>(null);
  /** Last waypoint index we ran import for (persist this before switching). */
  const previousImportStoryIndexRef = React.useRef<number | null>(null);

  const detailStoryIndex = detailStoryId
    ? waypoints.findIndex((s) => s.id === detailStoryId)
    : -1;
  const detailStory =
    detailStoryIndex >= 0 ? waypoints[detailStoryIndex] : null;

  // Scope canvas shape persist to the waypoint open in detail — even if the
  // Annotations accordion is collapsed (drawing tools may still be active).
  React.useEffect(() => {
    if (detailStoryId == null || detailStoryIndex < 0) {
      setAuthoringWaypointShapesIndex(null);
      return;
    }
    setAuthoringWaypointShapesIndex(detailStoryIndex);
    return () => setAuthoringWaypointShapesIndex(null);
  }, [detailStoryId, detailStoryIndex, setAuthoringWaypointShapesIndex]);

  // Auto-import shapes for the waypoint in detail (if open), else the active list row.
  React.useEffect(() => {
    if (waypoints.length === 0) return;
    if (imageWidth === 0 || imageHeight === 0) return;

    const storyIndex =
      detailStoryId != null && detailStoryIndex >= 0
        ? detailStoryIndex
        : (activeStoryIndex ?? 0);
    const story = waypoints[storyIndex];
    if (!story) return;

    const prev = previousImportStoryIndexRef.current;
    const store = useAppStore.getState();
    if (prev !== null && prev !== storyIndex) {
      store.persistImportedShapesToStory(prev);
    }
    previousImportStoryIndexRef.current = storyIndex;

    importWaypointShapes(story, true, shapes);
  }, [
    waypoints,
    activeStoryIndex,
    detailStoryId,
    detailStoryIndex,
    imageWidth,
    imageHeight,
    shapes,
    importWaypointShapes,
  ]);

  React.useEffect(() => {
    return () => {
      if (pendingThumbnailCaptureTimeoutRef.current !== null) {
        window.clearTimeout(pendingThumbnailCaptureTimeoutRef.current);
      }
      if (overlayFlashTimeoutRef.current !== null) {
        window.clearTimeout(overlayFlashTimeoutRef.current);
      }
      const p = previousImportStoryIndexRef.current;
      if (p !== null) {
        const doc = useDocumentStore.getState();
        if (doc.imageWidth > 0 && doc.imageHeight > 0) {
          useAppStore.getState().persistImportedShapesToStory(p);
        }
      }
    };
  }, []);

  const flashSquareOverlay = (durationMs = 3000) => {
    setShowSquareViewportOverlay(true);
    if (overlayFlashTimeoutRef.current !== null) {
      window.clearTimeout(overlayFlashTimeoutRef.current);
    }
    overlayFlashTimeoutRef.current = window.setTimeout(() => {
      setShowSquareViewportOverlay(false);
      overlayFlashTimeoutRef.current = null;
    }, durationMs);
  };

  const saveCurrentViewToStory = (index: number, source: string): boolean => {
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
      const st = useAppStore.getState();
      const doc = useDocumentStore.getState();
      console.warn(
        "[Minerva] waypoint view not saved: no bounds from viewer (camera/size not ready). " +
          "Try pan/zoom once or reload.",
        {
          source,
          index,
          viewerViewState: st.viewerViewState,
          viewerViewportSize: st.viewerViewportSize,
          imageWidth: doc.imageWidth,
          imageHeight: doc.imageHeight,
        },
      );
      return false;
    }
    const loaded = useAppStore.getState().viewerImageLayersLoaded;
    const thumbnail = loaded ? captureSquareViewportThumbnail() : null;

    updateStory(index, {
      Bounds: bounds,
      ViewState: viewStateCanon,
      Pan: undefined,
      Zoom: undefined,
      ...(thumbnail ? { ThumbnailDataUrl: thumbnail } : {}),
    });
    if (!loaded) {
      saveThumbnailOnlyToStory(index, 0);
    }
    return true;
  };

  const saveThumbnailOnlyToStory = (index: number, attempt = 0) => {
    if (attempt > 100) return;
    const store = useAppStore.getState();
    if (store.activeStoryIndex !== index) return;
    if (!store.viewerImageLayersLoaded) {
      window.setTimeout(
        () => saveThumbnailOnlyToStory(index, attempt + 1),
        200,
      );
      return;
    }
    const thumbnail = captureSquareViewportThumbnail();
    if (!thumbnail) return;
    updateStory(index, { ThumbnailDataUrl: thumbnail });
  };

  const applyStoryChannelGroup = React.useCallback(
    (story: StoreStoryWaypoint | undefined) => {
      if (!story || channelGroups.length === 0) return;
      const foundGroup =
        (story.groupId &&
          channelGroups.find((group) => group.id === story.groupId)) ||
        channelGroups[0];
      if (foundGroup) {
        setActiveChannelGroup(foundGroup.id);
      }
    },
    [channelGroups, setActiveChannelGroup],
  );

  const scheduleThumbnailCaptureForStory = (
    index: number,
    overwriteView = false,
    thumbnailOnly = false,
    delayMs = 1100,
  ) => {
    if (pendingThumbnailCaptureTimeoutRef.current !== null) {
      window.clearTimeout(pendingThumbnailCaptureTimeoutRef.current);
      pendingThumbnailCaptureTimeoutRef.current = null;
    }
    pendingThumbnailCaptureTimeoutRef.current = window.setTimeout(() => {
      pendingThumbnailCaptureTimeoutRef.current = null;
      const state = useAppStore.getState();
      if (state.activeStoryIndex !== index) {
        return;
      }
      const story = useDocumentStore.getState().waypoints[index];
      if (!story) return;
      if (!overwriteView && story.thumbnail) return;
      if (thumbnailOnly) {
        saveThumbnailOnlyToStory(index);
        return;
      }
      saveCurrentViewToStory(index, "scheduleThumbnail.full");
    }, delayMs);
  };

  const activateStoryIndex = (
    index: number,
    shouldCaptureThumbnail = false,
  ) => {
    const priorActive = useAppStore.getState().activeStoryIndex;
    if (
      priorActive !== null &&
      priorActive !== index &&
      pendingThumbnailCaptureTimeoutRef.current !== null
    ) {
      window.clearTimeout(pendingThumbnailCaptureTimeoutRef.current);
      pendingThumbnailCaptureTimeoutRef.current = null;
    }

    setActiveStory(index);

    const storyForNav = useDocumentStore.getState().waypoints[index];
    applyStoryChannelGroup(storyForNav);
    if (storyForNav && imageWidth > 0 && imageHeight > 0) {
      setTargetWaypointCamera(storeStoryWaypointToConfigWaypoint(storyForNav));
    }
    // Only grab the preview image after the camera settles — never rewrite
    // Bounds/ViewState on row select (use save-view control on the row to persist camera).
    if (shouldCaptureThumbnail && !storyForNav?.thumbnail) {
      scheduleThumbnailCaptureForStory(index, false, true, 1100);
    }
  };

  const openDetailForStoryId = (storyId: string) => {
    if (!canEdit) return;

    const index = waypoints.findIndex((s) => s.id === storyId);
    if (index === -1) return;

    activateStoryIndex(index);
    setDetailStoryId(storyId);

    // Slide-to-top behavior: ensure detail scroll starts at the top.
    requestAnimationFrame(() => {
      detailBodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const handleOverwriteView = (
    index: number,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    setActiveStory(index);
    const saved = saveCurrentViewToStory(index, "handleOverwriteView");
    flashSquareOverlay();
    scheduleThumbnailCaptureForStory(index, true, true, 150);
    if (saved) {
      persistImportedShapesToStory(index);
      useDocumentStore.getState().syncStoryDocument();
      downloadStoryDocument(useDocumentStore.getState().storyDocument);
    }
  };

  const handleDownloadStory = () => {
    useDocumentStore.getState().syncStoryDocument();
    downloadStoryDocument(useDocumentStore.getState().storyDocument);
  };

  const handleAddWaypoint = () => {
    const storyIndex = waypoints.length;
    const currentGroup =
      channelGroups.find(
        (group) => group.id === useAppStore.getState().activeChannelGroupId,
      ) || channelGroups[0];
    const newWaypoint: ConfigWaypoint = {
      id: crypto.randomUUID(),
      State: { Expanded: true },
      Name: `Waypoint ${storyIndex + 1}`,
      Content: "",
      groupId: currentGroup?.id,
      shapeIds: [],
    };

    addStory(newWaypoint);
    activateStoryIndex(storyIndex);
    setDetailStoryId(newWaypoint.id);

    requestAnimationFrame(() => {
      detailBodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
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

    const fromIndex = waypoints.findIndex((s) => s.id === draggedStoryId);
    const toIndex = waypoints.findIndex((s) => s.id === targetStoryId);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderStories(fromIndex, toIndex);
    }

    setDraggedStoryId(null);
    setDropTargetStoryId(null);
  };

  const listHeader = (
    <div className={styles.compactHeader}>
      <div className={styles.headerTitle}>
        <span>Waypoints</span>
        <span className={styles.headerCount}>({waypoints.length})</span>
      </div>

      <div className={styles.headerActions}>
        {canEdit && (
          <button
            type="button"
            className={styles.iconHeaderButton}
            onClick={() => {
              if (waypoints.length === 0) return;
              const indexToRemove = activeStoryIndex ?? 0;
              if (indexToRemove < 0 || indexToRemove >= waypoints.length)
                return;
              removeStory(indexToRemove);
            }}
            disabled={waypoints.length === 0}
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

        {canEdit && (
          <button
            type="button"
            className={styles.iconHeaderButton}
            onClick={handleDownloadStory}
            disabled={waypoints.length === 0}
            title="Download story.json (waypoints + shapes)"
            aria-label="Download story.json"
          >
            <DownloadIcon width={14} height={14} aria-hidden />
          </button>
        )}

        {canEdit && onEnterPlaybackPreview ? (
          <button
            type="button"
            className={styles.iconHeaderButton}
            onClick={onEnterPlaybackPreview}
            disabled={waypoints.length === 0}
            title="Preview narrative playback"
            aria-label="Preview narrative playback"
          >
            <PlayIcon width={14} height={14} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );

  const renderList = () => (
    <div className={styles.panel}>
      {listHeader}
      {waypoints.length === 0 ? (
        <div className={styles.emptyMessage}>No waypoints yet</div>
      ) : (
        <ul className={styles.rows}>
          {waypoints.map((story, index) => {
            const storyId = story.id;
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

                {story.thumbnail ? (
                  <img
                    className={styles.rowThumbnail}
                    src={story.thumbnail}
                    width={WAYPOINT_THUMBNAIL_PIXEL_SIZE}
                    height={WAYPOINT_THUMBNAIL_PIXEL_SIZE}
                    alt=""
                    aria-hidden
                  />
                ) : (
                  <div className={styles.rowThumbnail} aria-hidden />
                )}

                <button
                  type="button"
                  {...rowDragProps}
                  className={styles.rowMainHit}
                  aria-label={`Select waypoint: ${story.title}`}
                  onClick={() => activateStoryIndex(index, true)}
                  onDoubleClick={() => openDetailForStoryId(storyId)}
                >
                  <div className={styles.rowTextStack}>
                    <div className={styles.rowTitleRow}>
                      <span className={styles.rowTitle} title={story.title}>
                        {story.title}
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
                      title={story.content ?? ""}
                    >
                      {story.content ?? ""}
                    </span>
                  </div>
                </button>
                <div className={styles.rowViewportActions}>
                  <button
                    type="button"
                    className={styles.rowViewportIconButton}
                    title="Jump to waypoint view"
                    onClick={(event) => {
                      event.stopPropagation();
                      activateStoryIndex(index);
                    }}
                  >
                    <JumpToViewIcon width={14} height={14} aria-hidden />
                    <span className={styles.visuallyHidden}>
                      Jump to waypoint view
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.rowViewportIconButton}
                    title="Save waypoint view to story and download story.json"
                    onClick={(event) => handleOverwriteView(index, event)}
                  >
                    <OverwriteViewIcon width={14} height={14} aria-hidden />
                    <span className={styles.visuallyHidden}>
                      Save waypoint view
                    </span>
                  </button>
                </div>
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

    const handleDetailTitleBlur = (
      event: React.FocusEvent<HTMLInputElement>,
    ) => {
      if (!canEdit) return;
      const raw = event.target.value;
      const trimmed = raw.trim();
      if (trimmed === "") {
        updateStory(detailStoryIndex, { Name: "Untitled waypoint" });
      } else if (trimmed !== raw) {
        updateStory(detailStoryIndex, { Name: trimmed });
      }
    };

    const selectedGroupUuid =
      channelGroups.find((group) => group.id === detailStory.groupId)?.id ??
      channelGroups[0].id;
    const selectedGroup =
      channelGroups.find((group) => group.id === selectedGroupUuid) ??
      channelGroups[0];
    const selectedChannelNames = channelNamesForGroup(
      selectedGroup,
      sourceChannels,
    );
    const selectedChannelsSubtitle = selectedChannelNames.join(", ");

    const selectChannelGroupByUuid = (nextGroupUuid: string) => {
      const nextGroup = channelGroups.find(
        (group) => group.id === nextGroupUuid,
      );
      if (!nextGroup) return;
      updateStory(detailStoryIndex, { groupId: nextGroup.id });
      setActiveChannelGroup(nextGroup.id);
      setChannelGroupMenuOpen(false);
      scheduleThumbnailCaptureForStory(detailStoryIndex, true, true, 1100);
    };

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
          <div className={styles.detailTitle} title={detailStory.title}>
            {detailStory.title}
          </div>
        </div>

        <div className={styles.detailBody} ref={detailBodyRef}>
          <div className={styles.detailBodyInner}>
            <div className={styles.detailTitleFieldWrap}>
              <label
                className={styles.detailTitleLabel}
                htmlFor={detailTitleFieldId}
              >
                Title
              </label>
              <input
                id={detailTitleFieldId}
                className={styles.detailTitleInput}
                type="text"
                value={detailStory.title ?? ""}
                onChange={(e) =>
                  updateStory(detailStoryIndex, { Name: e.target.value })
                }
                onBlur={handleDetailTitleBlur}
                maxLength={200}
                disabled={!canEdit}
                autoComplete="off"
                spellCheck={true}
                placeholder="Waypoint title"
              />
            </div>
            {channelGroups.length > 0 ? (
              <div className={styles.detailTitleFieldWrap}>
                <label
                  className={styles.detailTitleLabel}
                  htmlFor={detailGroupFieldId}
                >
                  Channel group
                </label>
                <div
                  className={styles.channelGroupDropdown}
                  ref={channelGroupDropdownRef}
                >
                  <button
                    type="button"
                    id={detailGroupFieldId}
                    className={styles.channelGroupDropdownTrigger}
                    aria-haspopup="listbox"
                    aria-expanded={channelGroupMenuOpen}
                    disabled={!canEdit}
                    onClick={() => setChannelGroupMenuOpen((open) => !open)}
                  >
                    <span className={styles.channelGroupDropdownTriggerMain}>
                      <span className={styles.channelGroupDropdownTitle}>
                        {selectedGroup.Name}
                      </span>
                      <span className={styles.channelGroupDropdownChannels}>
                        {selectedChannelsSubtitle || "—"}
                      </span>
                    </span>
                    <ChevronDownIcon
                      className={[
                        styles.channelGroupDropdownChevron,
                        channelGroupMenuOpen
                          ? styles.channelGroupDropdownChevronOpen
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-hidden
                    />
                  </button>
                  {channelGroupMenuOpen ? (
                    <div
                      className={styles.channelGroupDropdownMenu}
                      role="listbox"
                      aria-label="Channel groups"
                    >
                      {channelGroups.map((group) => {
                        const names = channelNamesForGroup(
                          group,
                          sourceChannels,
                        );
                        const subtitle = names.join(", ");
                        const isSelected = group.id === selectedGroupUuid;
                        return (
                          <div
                            key={group.id}
                            className={styles.channelGroupDropdownItem}
                          >
                            <button
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              className={[
                                styles.channelGroupDropdownOption,
                                isSelected
                                  ? styles.channelGroupDropdownOptionSelected
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() => selectChannelGroupByUuid(group.id)}
                            >
                              <span
                                className={styles.channelGroupDropdownTitle}
                              >
                                {group.Name}
                              </span>
                              <span
                                className={styles.channelGroupDropdownChannels}
                              >
                                {subtitle || "—"}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
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
                    key={detailStory.id}
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

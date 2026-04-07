import * as React from "react";
import AnnotationsIcon from "@/components/shared/icons/annotations.svg?react";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import JumpToViewIcon from "@/components/shared/icons/jump-to-view.svg?react";
import OverwriteViewIcon from "@/components/shared/icons/overwrite-view.svg?react";
import PlayIcon from "@/components/shared/icons/play.svg?react";
import type { ConfigWaypoint } from "@/lib/config";
import type { ConfigGroup, ConfigSourceChannel } from "@/lib/document-store";
import { useOverlayStore } from "@/lib/stores";
import {
  getViewerBoundsFromSnapshot,
  getViewerViewportSnapshotFromStore,
  orthographicZoomToNumber,
} from "@/lib/viewerViewport";
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

const countWaypointAnnotations = (story: ConfigWaypoint) =>
  story.ShapeIds?.length ?? 0;

const annotationCountLabel = (count: number) =>
  `${count} ${count === 1 ? "annotation" : "annotations"}`;

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

const WaypointsList = (props: WaypointsListProps) => {
  const { viewOnly, onEnterPlaybackPreview } = props;
  const canEdit = !viewOnly;

  const {
    stories,
    activeStoryIndex,
    setActiveStory,
    setActiveChannelGroup,
    addStory,
    updateStory,
    reorderStories,
    importWaypointAnnotations,
    imageWidth,
    imageHeight,
    setTargetWaypointCamera,
    captureSquareViewportThumbnail,
    removeStory,
    setShowSquareViewportOverlay,
    setAuthoringWaypointEditorOpen,
    Groups,
    SourceChannels,
    Shapes,
  } = useOverlayStore();

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
  const previousActiveStoryIndexRef = React.useRef<number | null>(null);

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

    const prev = previousActiveStoryIndexRef.current;
    const store = useOverlayStore.getState();
    if (prev !== null && prev !== storyIndex) {
      store.persistImportedAnnotationsToStory(prev);
    }
    previousActiveStoryIndexRef.current = storyIndex;

    const _pendingShapeImports = (story.ShapeIds ?? []).filter(
      (id) => !Shapes.some((shape) => shape.uuid === id),
    ).length;
    void _pendingShapeImports;

    importWaypointAnnotations(story, true);
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
      if (pendingThumbnailCaptureTimeoutRef.current !== null) {
        window.clearTimeout(pendingThumbnailCaptureTimeoutRef.current);
      }
      if (overlayFlashTimeoutRef.current !== null) {
        window.clearTimeout(overlayFlashTimeoutRef.current);
      }
      const p = previousActiveStoryIndexRef.current;
      if (p !== null) {
        const s = useOverlayStore.getState();
        if (s.imageWidth > 0 && s.imageHeight > 0) {
          s.persistImportedAnnotationsToStory(p);
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

  const saveCurrentViewToStory = (index: number, source: string) => {
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
          source,
          index,
          viewerViewState: st.viewerViewState,
          viewerViewportSize: st.viewerViewportSize,
          imageWidth: st.imageWidth,
          imageHeight: st.imageHeight,
        },
      );
      return;
    }
    const thumbnail = captureSquareViewportThumbnail();

    updateStory(index, {
      Bounds: bounds,
      ViewState: viewStateCanon,
      Pan: undefined,
      Zoom: undefined,
      ...(thumbnail ? { ThumbnailDataUrl: thumbnail } : {}),
    });
  };

  const saveThumbnailOnlyToStory = (index: number) => {
    const thumbnail = captureSquareViewportThumbnail();
    if (!thumbnail) return;
    updateStory(index, { ThumbnailDataUrl: thumbnail });
  };

  const applyStoryChannelGroup = React.useCallback(
    (story: ConfigWaypoint | undefined) => {
      if (!story || Groups.length === 0) return;
      const foundGroup =
        Groups.find((group) => group.Name === story.Group) || Groups[0];
      if (foundGroup) {
        setActiveChannelGroup(foundGroup.UUID);
      }
    },
    [Groups, setActiveChannelGroup],
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
      const state = useOverlayStore.getState();
      if (state.activeStoryIndex !== index) {
        return;
      }
      const story = state.stories[index];
      if (!story) return;
      if (!overwriteView && story.ThumbnailDataUrl) return;
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
    const priorActive = useOverlayStore.getState().activeStoryIndex;
    if (
      priorActive !== null &&
      priorActive !== index &&
      pendingThumbnailCaptureTimeoutRef.current !== null
    ) {
      window.clearTimeout(pendingThumbnailCaptureTimeoutRef.current);
      pendingThumbnailCaptureTimeoutRef.current = null;
    }

    setActiveStory(index);

    const storeNow = useOverlayStore.getState();
    const storyForNav = storeNow.stories[index];
    applyStoryChannelGroup(storyForNav);
    if (storyForNav && imageWidth > 0 && imageHeight > 0) {
      setTargetWaypointCamera(storyForNav);
    }
    // Only grab the preview image after the camera settles — never rewrite
    // Bounds/ViewState on row select (use “Overwrite view” to persist camera).
    if (shouldCaptureThumbnail && !storyForNav?.ThumbnailDataUrl) {
      scheduleThumbnailCaptureForStory(index, false, true, 1100);
    }
  };

  const openDetailForStoryId = (storyId: string) => {
    if (!canEdit) return;

    const index = stories.findIndex((s) => s.UUID === storyId);
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
    saveCurrentViewToStory(index, "handleOverwriteView");
    flashSquareOverlay();
    scheduleThumbnailCaptureForStory(index, true, true, 150);
  };

  const handleAddWaypoint = () => {
    const storyIndex = stories.length;
    const currentGroup =
      Groups.find(
        (group) =>
          group.UUID === useOverlayStore.getState().activeChannelGroupId,
      ) || Groups[0];
    const newWaypoint: ConfigWaypoint = {
      UUID: crypto.randomUUID(),
      State: { Expanded: true },
      Name: `Waypoint ${storyIndex + 1}`,
      Content: "",
      Group: currentGroup?.Name,
      ShapeIds: [],
    };

    addStory(newWaypoint);
    activateStoryIndex(storyIndex);
    setDetailStoryId(newWaypoint.UUID);

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

    const fromIndex = stories.findIndex((s) => s.UUID === draggedStoryId);
    const toIndex = stories.findIndex((s) => s.UUID === targetStoryId);
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

        {canEdit && onEnterPlaybackPreview ? (
          <button
            type="button"
            className={styles.iconHeaderButton}
            onClick={onEnterPlaybackPreview}
            disabled={stories.length === 0}
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

                {story.ThumbnailDataUrl ? (
                  <img
                    className={styles.rowThumbnail}
                    src={story.ThumbnailDataUrl}
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
                  aria-label={`Select waypoint: ${story.Name}`}
                  onClick={() => activateStoryIndex(index, true)}
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
                    title="Overwrite waypoint view with current viewport"
                    onClick={(event) => handleOverwriteView(index, event)}
                  >
                    <OverwriteViewIcon width={14} height={14} aria-hidden />
                    <span className={styles.visuallyHidden}>
                      Overwrite waypoint view
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
      Groups.find((group) => group.Name === detailStory.Group)?.UUID ??
      Groups[0].UUID;
    const selectedGroup =
      Groups.find((group) => group.UUID === selectedGroupUuid) ?? Groups[0];
    const selectedChannelNames = channelNamesForGroup(
      selectedGroup,
      SourceChannels,
    );
    const selectedChannelsSubtitle = selectedChannelNames.join(", ");

    const selectChannelGroupByUuid = (nextGroupUuid: string) => {
      const nextGroup = Groups.find((group) => group.UUID === nextGroupUuid);
      if (!nextGroup) return;
      updateStory(detailStoryIndex, { Group: nextGroup.Name });
      setActiveChannelGroup(nextGroup.UUID);
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
          <div className={styles.detailTitle} title={detailStory.Name}>
            {detailStory.Name}
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
                value={detailStory.Name ?? ""}
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
            {Groups.length > 0 ? (
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
                      {Groups.map((group) => {
                        const names = channelNamesForGroup(
                          group,
                          SourceChannels,
                        );
                        const subtitle = names.join(", ");
                        const isSelected = group.UUID === selectedGroupUuid;
                        return (
                          <div
                            key={group.UUID}
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
                              onClick={() =>
                                selectChannelGroupByUuid(group.UUID)
                              }
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

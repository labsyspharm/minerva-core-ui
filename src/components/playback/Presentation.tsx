import type { CSSProperties, MouseEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import {
  StoryBannerBar,
  storyBannerTitleClassName,
} from "@/components/shared/StoryBannerBar";
import {
  effectiveReferenceImagePixelSize,
  useAppStore,
} from "@/lib/stores/appStore";
import type { Waypoint } from "@/lib/stores/documentStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { waypointToConfigWaypoint } from "@/lib/stores/storeUtils";
import styles from "./Presentation.module.css";

/** Shared by authoring preview and the CDN story player bundle. */
export type PresentationProps = {
  children: ReactElement;
  /** When set, shows the authoring “Back / Story preview” ribbon. */
  exitPlaybackPreview?: () => void;
  /**
   * When true (CDN player), show the document title in the top ribbon without
   * authoring “Back” / “Story preview” controls.
   */
  showDocumentTitle?: boolean;
};

/** Square viewBox so the glyph’s visual center matches the SVG box center. */
const NavChevron = (props: { dir: "left" | "right"; px: number }) => {
  const d =
    props.dir === "left"
      ? "M10.5 3.5 L5.5 8 l5 4.5"
      : "M5.5 3.5 L10.5 8 l-5 4.5";
  return (
    <svg
      viewBox="0 0 16 16"
      width={props.px}
      height={props.px}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const Presentation = (props: PresentationProps) => {
  const documentTitle = useDocumentStore((s) => s.metadata.title ?? "");
  const waypoints = useDocumentStore((s) => s.waypoints);
  const shapes = useDocumentStore((s) => s.shapes);
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const images = useDocumentStore((s) => s.images);
  const sourceChannels = useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );
  const docImageWidth = useDocumentStore((s) => s.images[0]?.sizeX ?? 0);
  const docImageHeight = useDocumentStore((s) => s.images[0]?.sizeY ?? 0);
  const viewerRefSize = useAppStore((s) => s.viewerReferenceImagePixelSize);
  const { width: imageWidth, height: imageHeight } =
    effectiveReferenceImagePixelSize(
      viewerRefSize,
      docImageWidth,
      docImageHeight,
    );
  const {
    activeStoryIndex,
    setActiveStory,
    activeChannelGroupId,
    setActiveChannelGroup,
    importWaypointShapes,
    setTargetWaypointCamera,
  } = useAppStore();

  const previousActiveStoryIndexRef = useRef<number | null>(null);

  // Auto-import shapes for the active story when dimensions / selection / channel groups change.
  useEffect(() => {
    if (waypoints.length === 0) return;
    // Wait for image dimensions to be set
    if (imageWidth === 0 || imageHeight === 0) return;
    // Wait for active story to be explicitly set (avoid duplicate imports)
    if (activeStoryIndex === null) return;

    const story = waypoints[activeStoryIndex];

    if (story) {
      const idx = activeStoryIndex;
      const prev = previousActiveStoryIndexRef.current;
      const store = useAppStore.getState();
      if (prev !== null && prev !== idx) {
        store.persistImportedShapesToStory(prev);
      }
      previousActiveStoryIndexRef.current = idx;

      // Import shapes from the story (clearing existing imported ones atomically)
      importWaypointShapes(story, true, shapes);

      const authoringMap = useAppStore.getState().waypointAuthoring;
      const wp = waypointToConfigWaypoint(story, authoringMap.get(story.id));
      if (imageWidth > 0 && imageHeight > 0) {
        setTargetWaypointCamera(wp);
      }

      const gid = wp.groupId;
      if (channelGroups.length > 0 && gid) {
        const foundGroup =
          channelGroups.find((g) => g.id === gid) || channelGroups[0];
        if (foundGroup) {
          setActiveChannelGroup(foundGroup.id);
        }
      }
    }
  }, [
    waypoints,
    activeStoryIndex,
    imageWidth,
    imageHeight,
    shapes,
    importWaypointShapes,
    setTargetWaypointCamera,
    channelGroups,
    setActiveChannelGroup,
  ]);

  useEffect(() => {
    return () => {
      const p = previousActiveStoryIndexRef.current;
      if (p !== null) {
        const doc = useDocumentStore.getState();
        const st = useAppStore.getState();
        const im = doc.images[0];
        const { width: w, height: h } = effectiveReferenceImagePixelSize(
          st.viewerReferenceImagePixelSize,
          im?.sizeX ?? 0,
          im?.sizeY ?? 0,
        );
        if (w > 0 && h > 0) {
          useAppStore.getState().persistImportedShapesToStory(p);
        }
      }
    };
  }, []);

  const updateGroup = (activeStory) => {
    const story = waypoints[activeStory];
    if (!story) return;
    const gid = story.groupId;
    const found_group =
      (gid && channelGroups.find(({ id }) => id === gid)) || channelGroups[0];
    if (found_group) {
      setActiveChannelGroup(found_group.id);
    }
  };

  const updateViewState = (storyIndex: number) => {
    const story = waypoints[storyIndex];
    if (!story) return;
    if (imageWidth > 0 && imageHeight > 0) {
      const auth = useAppStore.getState().waypointAuthoring.get(story.id);
      setTargetWaypointCamera(waypointToConfigWaypoint(story, auth));
    }
  };

  const storyFirst = () => {
    setActiveStory(0);
    updateGroup(0);
    updateViewState(0);
  };
  const storyLeft = () => {
    const active_story = Math.max(0, activeStoryIndex - 1);
    setActiveStory(active_story);
    updateGroup(active_story);
    updateViewState(active_story);
  };
  const storyRight = () => {
    const active_story = Math.min(waypoints.length - 1, activeStoryIndex + 1);
    setActiveStory(active_story);
    updateGroup(active_story);
    updateViewState(active_story);
  };
  const storyAt = (i: number) => {
    const active_story = Math.min(waypoints.length - 1, Math.max(0, i));
    setActiveStory(active_story);
    updateGroup(active_story);
    updateViewState(active_story);
  };
  const iconPx = 16;
  const toc_button = (
    <button
      type="button"
      className={styles.tocButton}
      title="View table of contents"
      onMouseDown={(e) => {
        e.preventDefault();
        storyFirst();
      }}
    >
      <svg
        viewBox="0 0 16 16"
        width={iconPx}
        height={iconPx}
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="2.5" cy="4" r="1.25" fill="currentColor" />
        <circle cx="2.5" cy="8" r="1.25" fill="currentColor" />
        <circle cx="2.5" cy="12" r="1.25" fill="currentColor" />
        <path
          d="M6 4 H14 M6 8 H14 M6 12 H14"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
  const StoryLeft = (props) => {
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault(); // Prevent any default behavior
      storyLeft();
    };
    return (
      <button
        type="button"
        className={[styles.navLeft, props.active ? null : styles.navInactive]
          .filter(Boolean)
          .join(" ")}
        title="View previous waypoint"
        onMouseDown={handleMouseDown}
      >
        <NavChevron dir="left" px={iconPx} />
      </button>
    );
  };
  const count = (
    <div className={styles.count}>
      <div title="Current waypoint">{activeStoryIndex + 1}</div>
      <div>{"⁄"}</div>
      <div title="Number of waypoints">{waypoints.length}</div>
    </div>
  );
  const StoryRight = (props) => {
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault(); // Prevent any default behavior
      storyRight();
    };
    return (
      <button
        type="button"
        className={[styles.navRight, props.active ? null : styles.navInactive]
          .filter(Boolean)
          .join(" ")}
        title="View next waypoint"
        onMouseDown={handleMouseDown}
      >
        <NavChevron dir="right" px={iconPx} />
      </button>
    );
  };
  const story_next = (
    <p
      className={styles.nextLink}
      title="View next waypoint"
      onMouseDown={(e) => {
        e.preventDefault();
        storyRight();
      }}
    >
      Next
    </p>
  );
  const TableOfContents = (props) => {
    const { waypoints: tocWaypoints } = props;
    return (
      <div className={styles.tocWrapper}>
        <h2 className={styles.heading}>Table of Contents</h2>
        <ol>
          {tocWaypoints.map((wp: Waypoint, i: number) => {
            const goToStory = (e: MouseEvent) => {
              e.preventDefault();
              storyAt(i);
            };
            return (
              <li key={wp.id} onMouseDown={goToStory}>
                {wp.title}
              </li>
            );
          })}
        </ol>
      </div>
    );
  };

  const first_story = activeStoryIndex === 0;
  const last_story = activeStoryIndex === waypoints.length - 1;
  const story = waypoints[activeStoryIndex];
  const story_title = story?.title ?? `Waypoint ${activeStoryIndex + 1}`;
  const story_content = story?.content;
  const ribbonDocTitle = documentTitle.trim()
    ? documentTitle.trim()
    : "Untitled story";

  // Scroll waypoint content back to top when changing to a different waypoint.
  const contentPaneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentPaneRef.current && activeStoryIndex != null) {
      contentPaneRef.current.scrollTop = 0;
    }
  }, [activeStoryIndex]);

  // Process story content to highlight channel names
  const { processedContent, channelColors } = useMemo(() => {
    const activeGroup = channelGroups.find(
      (g) => g.id === activeChannelGroupId,
    );
    if (!activeGroup || !story_content)
      return {
        processedContent: story_content || "",
        channelColors: new Map(),
      };

    const channels = activeGroup?.channels || [];

    let content = story_content;
    const colors = new Map();

    channels.forEach((channel) => {
      const { name: chName } = findSourceChannel(
        sourceChannels,
        channel.channelId,
      ) || {
        name: "unknown",
      };
      // Escape special regex characters in channel name
      const escapedName = chName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Use word boundaries to match whole words only
      const regex = new RegExp(`\\b${escapedName}\\b`, "g");
      content = content.replace(regex, `**${chName}**`);
      const { r, g: gg, b } = channel.color;
      const hex_color = [r, gg, b]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      colors.set(chName, `#${hex_color}`);
    });

    return { processedContent: content, channelColors: colors };
  }, [story_content, activeChannelGroupId, channelGroups, sourceChannels]);

  const showRibbon = Boolean(
    props.exitPlaybackPreview || props.showDocumentTitle,
  );
  /** Left-nav title only when there is no top ribbon (ribbon already shows it). */
  const navStoryName =
    !showRibbon && documentTitle.trim() ? documentTitle.trim() : "";
  const flushTitle = !props.exitPlaybackPreview;

  return (
    <div className={styles.presentationShell}>
      {showRibbon ? (
        <StoryBannerBar className={styles.previewRibbon}>
          {props.exitPlaybackPreview ? (
            <button
              type="button"
              className={styles.previewBackButton}
              onClick={props.exitPlaybackPreview}
              title="Back to editing"
              aria-label="Back to editing"
            >
              <ChevronDownIcon
                className={styles.previewRibbonChevron}
                aria-hidden
              />
              <span>Back</span>
            </button>
          ) : null}
          <span
            title={ribbonDocTitle}
            className={[
              storyBannerTitleClassName,
              styles.previewRibbonDocumentTitle,
              flushTitle ? styles.previewRibbonDocumentTitleFlush : null,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {ribbonDocTitle}
          </span>
          {props.exitPlaybackPreview ? (
            <span className={styles.previewRibbonPreviewBadge}>
              Story preview
            </span>
          ) : null}
        </StoryBannerBar>
      ) : null}
      <div className={styles.splitGrid}>
        <div
          className={[
            styles.navPane,
            navStoryName ? styles.navPaneHasStoryName : null,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {navStoryName ? (
            <div className={styles.storyTitle}>{navStoryName}</div>
          ) : null}
          <div className={styles.toolbar}>
            {toc_button}
            <StoryLeft active={!first_story} />
            {count}
            <StoryRight active={!last_story} />
          </div>
          <div ref={contentPaneRef} className={styles.contentWrap}>
            <h2 className={styles.heading}>{story_title}</h2>
            <ReactMarkdown
              components={{
                strong: ({ children }) => {
                  const text = String(children);
                  const color = channelColors.get(text);
                  return color ? (
                    <span
                      className={styles.channelName}
                      style={{ "--channel-color": color } as CSSProperties}
                    >
                      {text}
                    </span>
                  ) : (
                    <strong>{children}</strong>
                  );
                },
              }}
            >
              {processedContent}
            </ReactMarkdown>
            {first_story && <TableOfContents waypoints={waypoints} />}
            <div className={styles.inlineNext}>
              {last_story ? (
                <p>End</p>
              ) : (
                <>
                  {story_next} <StoryRight active={!last_story} />
                </>
              )}
            </div>
          </div>
        </div>
        <div className={styles.presentationViewerRegion}>{props.children}</div>
      </div>
    </div>
  );
};

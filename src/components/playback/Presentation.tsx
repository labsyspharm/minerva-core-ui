import type { MouseEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import styled from "styled-components";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import {
  STORY_BANNER_CONTROL_SIZE_PX,
  storyBannerBarCss,
  storyBannerTitleTextCss,
} from "@/components/shared/storyBannerBar";
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
/** Fonts + theme tokens + prose — shared by authoring preview and CDN export. */
import "./presentationShell.css";

/** Shared by authoring preview and the CDN `StoryPlayerApp` bundle. */
export type PresentationProps = {
  children: ReactElement;
  /** Shown in the left nav (story / exhibit name). */
  name: string;
  /** When set, shows the authoring “Back / Story preview” ribbon. */
  exitPlaybackPreview?: () => void;
  /**
   * When true (CDN player), show the document title in the top ribbon without
   * authoring “Back” / “Story preview” controls.
   */
  showDocumentTitle?: boolean;
};

/**
 * Layout only — fonts/tokens/type live in `presentationShell.css`
 * (`.minerva-presentation`) so preview and export cannot drift.
 */
const PresentationShell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

const PreviewRibbon = styled.div`
  position: relative;
  /* Above SplitGrid (later in DOM); channel overlay is absolutely positioned and was painting over */
  z-index: 2;
  justify-content: flex-start;
  ${storyBannerBarCss}
`;

const PreviewBackButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  box-sizing: border-box;
  height: ${STORY_BANNER_CONTROL_SIZE_PX}px;
  background: rgb(0 0 0 / 0.16);
  border: 1px solid rgb(255 255 255 / 0.22);
  color: rgb(248 250 252 / 0.98);
  padding: 0 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  font-family: inherit;
  font-weight: 500;

  &:hover {
    background: rgb(0 0 0 / 0.26);
    border-color: rgb(255 255 255 / 0.28);
    color: #fff;
  }

  &:focus-visible {
    outline: 2px solid var(--theme-light-focus-color, hwb(45 90% 0%));
    outline-offset: 2px;
  }
`;

/** Left-pointing chevron (down icon rotated); keep as a single SVG for optical centering. */
const PreviewRibbonChevron = styled(ChevronDownIcon)`
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: block;
  transform: rotate(90deg);
  transform-origin: center;
  color: inherit;
  opacity: 0.95;
`;

/** Document title — shares the ribbon with the “Story preview” badge. */
const PreviewRibbonDocumentTitle = styled.span<{ $flush?: boolean }>`
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: ${STORY_BANNER_CONTROL_SIZE_PX}px;
  box-sizing: border-box;
  color: rgb(255 255 255 / 0.94);
  ${storyBannerTitleTextCss}
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* CDN title-only: center like StoryTitleBar. Preview mode: sit after Back. */
  text-align: ${(p) => (p.$flush ? "center" : "start")};
  border-left: ${(p) =>
    p.$flush ? "none" : "1px solid rgb(255 255 255 / 0.14)"};
  padding-left: ${(p) => (p.$flush ? "0" : "10px")};
`;

const PreviewRibbonPreviewBadge = styled.span`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: 28px;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.55);
`;

const SplitGrid = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
  z-index: 0;
  display: grid;
  overflow: hidden;
  grid-template-columns: 350px 1fr;
  grid-template-rows: 1fr;
  > :nth-child(1) {
    grid-column: 1;
    grid-row: 1;
    min-height: 0;
  }
  > :nth-child(2) {
    grid-column: 2;
    grid-row: 1;
    min-height: 0;
    /* Bound to grid cell — not 100vh, so story preview ribbon frees space below */
    max-height: 100%;
  }
`;

/** Positioned containing block so author .root.grid (absolute + inset 0) fills viewer area only */
const PresentationViewerRegion = styled.div`
  position: relative;
  min-height: 0;
  height: 100%;
  overflow: hidden;
`;

/** TOC / chevron SVGs are 16px; row must clear icons with equal vertical padding. */
const STORY_TOOLBAR_ROW_PX = 36;

const NavPane = styled.div<{ $hasStoryName?: boolean }>`
  border-right: 2px solid var(--theme-glass-edge);
  background: var(--theme-dim-gray-color);
  display: grid;
  /* No gap — it sat between toolbar and content’s border-top as empty space. */
  gap: 0;
  z-index: 1;
  overflow: hidden;
  /* Title row only when not already shown in the top ribbon (preview / CDN). */
  grid-template-rows: ${(p) =>
    p.$hasStoryName
      ? `auto ${STORY_TOOLBAR_ROW_PX}px 1fr`
      : `${STORY_TOOLBAR_ROW_PX}px 1fr`};
  grid-template-columns: 1fr;
  > .story-name {
    grid-column: 1;
    grid-row: 1;
    padding: 8px 8px 4px;
    margin: 0;
  }
  > .story-toolbar {
    grid-column: 1;
    grid-row: ${(p) => (p.$hasStoryName ? 2 : 1)};
    /* Symmetric padding — previous \`8px 8px 0\` in a 24px row clipped the icons. */
    padding: 0 8px;
    margin: 0;
  }
  > .story-content {
    overflow-y: auto;
    grid-column: 1;
    grid-row: ${(p) => (p.$hasStoryName ? 3 : 2)};
    border-top: 2px solid var(--theme-glass-edge);
    /* Fixed padding — same whether StoryTitle row is present or not. */
    padding: 8px 8px 0;
    margin: 0;
  }
  /* Same button reset in preview (Bootstrap) and CDN (native). */
  button {
    all: unset;
    box-sizing: border-box;
    color: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }
  /* Inline SVG baseline gap otherwise lifts glyphs toward the top of the row. */
  button svg {
    display: block;
    flex-shrink: 0;
  }
  button:focus-visible {
    outline: 2px solid var(--theme-light-focus-color);
    outline-offset: 2px;
  }
  .inactive {
    color: #444;
  }
`;

const StoryTitle = styled.div`
  line-height: 1.1;
  min-width: 0;
`;

const Toolbar = styled.div.attrs({ className: "story-toolbar" })`
  display: grid;
  height: 100%;
  overflow: hidden;
  align-items: center;
  grid-template-rows: 1fr;
  grid-template-columns: 30px 1fr 30px 50px 30px;

  > .table-of-contents {
    grid-column: 1;
    text-align: left;
  }
  > .left {
    grid-column: 3;
  }
  > .count {
    grid-column: 4;
  }
  > .right {
    grid-column: 5;
  }

  > button {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: inherit;
    cursor: pointer;
  }

  > button:focus-visible {
    outline: 1px solid var(--theme-light-focus-color, hwb(45 90% 0%));
    outline-offset: 1px;
  }

  > button.inactive {
    cursor: default;
    pointer-events: none;
  }
`;

const ContentWrap = styled.div.attrs({ className: "story-content" })`
  scrollbar-color: #888 var(--theme-dim-gray-color);
`;

const InlineNext = styled.div`
  display: grid;
  grid-template-columns: 1fr 30px;
  align-items: center;
  margin-bottom: 1em;
  > :nth-child(1) {
    grid-column: 1;
    text-align: right;
    font-style: italic;
    margin: 0;
  }
  > :nth-child(2) {
    grid-column: 2;
  }
  .right {
    cursor: pointer;
  }
  .right:hover {
    text-decoration: underline;
  }

  > button {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: inherit;
    cursor: pointer;
  }

  > button.inactive {
    cursor: default;
    pointer-events: none;
  }
`;

const Count = styled.div`
  text-align: center;
  display: grid;
  align-items: center;
  line-height: 1;
  font-size: 14px;
  grid-template-columns: 2fr 1fr 2fr;
  > :nth-child(1) {
    grid-column: 1;
  }
  > :nth-child(2) {
    grid-column: 2;
  }
  > :nth-child(3) {
    grid-column: 3;
  }
`;

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

const TocWrapper = styled.div`
  li {
    color: var(--bs-link-color);
    cursor: pointer;
  }
  li:hover {
    text-decoration: underline;
  }
`;

const ChannelName = styled.span<{ color: string }>`
  text-decoration: underline;
  text-decoration-color: ${(props) => props.color};
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
`;

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
      className="table-of-contents"
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
    const activeClass = props.active ? "" : "inactive";
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault(); // Prevent any default behavior
      storyLeft();
    };
    return (
      <button
        type="button"
        className={`left ${activeClass}`}
        title="View previous waypoint"
        onMouseDown={handleMouseDown}
      >
        <NavChevron dir="left" px={iconPx} />
      </button>
    );
  };
  const count = (
    <Count className="count">
      <div title="Current waypoint">{activeStoryIndex + 1}</div>
      <div>{"⁄"}</div>
      <div title="Number of waypoints">{waypoints.length}</div>
    </Count>
  );
  const StoryRight = (props) => {
    const activeClass = props.active ? "" : "inactive";
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault(); // Prevent any default behavior
      storyRight();
    };
    return (
      <button
        type="button"
        className={`right ${activeClass}`}
        title="View next waypoint"
        onMouseDown={handleMouseDown}
      >
        <NavChevron dir="right" px={iconPx} />
      </button>
    );
  };
  const story_next = (
    <p
      className="right"
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
      <TocWrapper>
        <h2 className="h6">Table of Contents</h2>
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
      </TocWrapper>
    );
  };

  const first_story = activeStoryIndex === 0;
  const last_story = activeStoryIndex === waypoints.length - 1;
  const main_title = props.name;
  const story = waypoints[activeStoryIndex];
  const story_title = story?.title ?? `Waypoint ${activeStoryIndex + 1}`;
  const story_content = story?.content;
  const ribbonDocTitle = documentTitle.trim()
    ? documentTitle.trim()
    : "Untitled story";

  // Scroll waypoint content back to top when changing to a different waypoint.
  const contentPaneRef = useRef(null);
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
  /** Left-nav name only when there is no top ribbon (ribbon already shows the title). */
  const navStoryName =
    !showRibbon && main_title.trim() ? main_title.trim() : "";

  return (
    <PresentationShell className="minerva-presentation">
      {showRibbon ? (
        <PreviewRibbon>
          {props.exitPlaybackPreview ? (
            <PreviewBackButton
              type="button"
              onClick={props.exitPlaybackPreview}
              title="Back to editing"
              aria-label="Back to editing"
            >
              <PreviewRibbonChevron aria-hidden />
              <span>Back</span>
            </PreviewBackButton>
          ) : null}
          <PreviewRibbonDocumentTitle
            title={ribbonDocTitle}
            $flush={!props.exitPlaybackPreview}
          >
            {ribbonDocTitle}
          </PreviewRibbonDocumentTitle>
          {props.exitPlaybackPreview ? (
            <PreviewRibbonPreviewBadge>Story preview</PreviewRibbonPreviewBadge>
          ) : null}
        </PreviewRibbon>
      ) : null}
      <SplitGrid>
        <NavPane $hasStoryName={Boolean(navStoryName)}>
          {navStoryName ? (
            <StoryTitle className="h5 story-name">{navStoryName}</StoryTitle>
          ) : null}
          <Toolbar>
            {toc_button}
            <StoryLeft active={!first_story} />
            {count}
            <StoryRight active={!last_story} />
          </Toolbar>
          <ContentWrap ref={contentPaneRef}>
            <h2 className="h6">{story_title}</h2>
            <ReactMarkdown
              components={{
                strong: ({ children }) => {
                  const text = String(children);
                  const color = channelColors.get(text);
                  return color ? (
                    <ChannelName color={color}>{text}</ChannelName>
                  ) : (
                    <strong>{children}</strong>
                  );
                },
              }}
            >
              {processedContent}
            </ReactMarkdown>
            {first_story && <TableOfContents waypoints={waypoints} />}
            <InlineNext>
              {last_story ? (
                <p>End</p>
              ) : (
                <>
                  {story_next} <StoryRight active={!last_story} />
                </>
              )}
            </InlineNext>
          </ContentWrap>
        </NavPane>
        <PresentationViewerRegion>{props.children}</PresentationViewerRegion>
      </SplitGrid>
    </PresentationShell>
  );
};

import { useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
//import { theme } from "@/theme.module.css";
import styled from "styled-components";
import ChevronDownIcon from "@/components/shared/icons/chevron-down.svg?react";
import { useOverlayStore } from "@/lib/stores";

const _theme = {};

// Types
import type { MouseEvent, ReactElement } from "react";
import type { ConfigProps, ConfigWaypoint } from "@/lib/config";

export type PresentationProps = {
  children: ReactElement;
  name: string;
  config: ConfigProps;
  hiddenChannel: boolean;
  startExport: () => void;
  channelItemElement: string;
  controlPanelElement: string;
  setHiddenChannel: (v: boolean) => void;
  exitPlaybackPreview?: () => void;
};

/** Preview mode: full-width ribbon (author tab tint) + two-column body */
const PresentationShell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

const PreviewRibbon = styled.div`
  flex-shrink: 0;
  position: relative;
  /* Above SplitGrid (later in DOM); channel chrome is absolutely positioned and was painting over */
  z-index: 2;
  width: 100%;
  box-sizing: border-box;
  padding: 5px 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  /* Author tabs / panels use --dark-main-glass from index.html */
  background: var(
    --dark-main-glass,
    color-mix(in xyz, var(--theme-dark-main-color, navy), transparent 20%)
  );
  border-bottom: 1px solid rgb(255 255 255 / 0.18);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    inset 0 -1px 0 rgb(0 0 0 / 0.15);
`;

const PreviewBackButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  background: rgb(0 0 0 / 0.16);
  border: 1px solid rgb(255 255 255 / 0.22);
  color: rgb(248 250 252 / 0.98);
  padding: 3px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1.2;
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

const PreviewRibbonChevron = styled(ChevronDownIcon)`
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: block;
  transform: rotate(90deg);
  color: inherit;
  opacity: 0.95;
`;

const PreviewRibbonLabel = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 1.0625rem;
  font-weight: 600;
  font-style: normal;
  line-height: 1.2;
  color: rgb(255 255 255 / 0.94);
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
  border-left: 1px solid rgb(255 255 255 / 0.14);
  padding-left: 10px;
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

const NavPane = styled.div`
  border-right: 2px solid var(--theme-glass-edge);
  background: var(--theme-dim-gray-color);
  display: grid;
  gap: 0.4em;
  z-index: 1;
  overflow: hidden;
  grid-template-rows: auto 24px 1fr;
  grid-template-columns: 1fr;
  > :nth-child(1) {
    grid-column: 1;
    grid-row: 1;
  }
  > :nth-child(2) {
    grid-column: 1;
    grid-row: 2;
    padding-top: 0;
  }
  > :nth-child(3) {
    overflow-y: auto;
    grid-column: 1;
    grid-row: 3;
    border-top: 2px solid var(--theme-glass-edge);
  }
  > * {
    padding: 8px 8px 0;
    margin: 0;
  }
  .inactive {
    color: #444;
  }
`;

const StoryTitle = styled.div`
  line-height: 1.1;
  min-width: 0;
`;

const Toolbar = styled.div`
  display: grid;
  overflow: hidden;
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
  }
`;

const ContentWrap = styled.div`
  scrollbar-color: #888 var(--theme-dim-gray-color);
`;

const InlineNext = styled.div`
  display: grid;
  grid-template-columns: 1fr 30px;
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
`;

const Count = styled.div`
  text-align: center;
  display: grid;
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

const SVG = (props) => {
  return (
    <svg
      viewBox="-3 0 20 40"
      height={`${props.px}px`}
      width={`${props.px * 1.5}px`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={props.d} fill="currentColor" />
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
  text-decoration-color: #${(props) => props.color};
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
`;

export const Presentation = (props: PresentationProps) => {
  const {
    stories,
    activeStoryIndex,
    setActiveStory,
    activeChannelGroupId,
    setActiveChannelGroup,
    importWaypointAnnotations,
    imageWidth,
    imageHeight,
    setTargetWaypointCamera,
    SourceChannels,
    Groups,
  } = useOverlayStore();

  const previousActiveStoryIndexRef = useRef<number | null>(null);

  // Auto-import annotations for the active story when dimensions / selection / groups change.
  useEffect(() => {
    if (stories.length === 0) return;
    // Wait for image dimensions to be set
    if (imageWidth === 0 || imageHeight === 0) return;
    // Wait for active story to be explicitly set (avoid duplicate imports)
    if (activeStoryIndex === null) return;

    const story = stories[activeStoryIndex];

    if (story) {
      const idx = activeStoryIndex;
      const prev = previousActiveStoryIndexRef.current;
      const store = useOverlayStore.getState();
      if (prev !== null && prev !== idx) {
        store.persistImportedAnnotationsToStory(prev);
      }
      previousActiveStoryIndexRef.current = idx;

      // Import annotations from the story (clearing existing imported ones atomically)
      importWaypointAnnotations(story, true);

      const wp = story as ConfigWaypoint;
      if (imageWidth > 0 && imageHeight > 0) {
        setTargetWaypointCamera(wp);
      }

      const groupName = wp.Group;
      if (Groups.length > 0) {
        const foundGroup =
          Groups.find((g) => g.Name === groupName) || Groups[0];
        if (foundGroup) {
          setActiveChannelGroup(foundGroup.UUID);
        }
      }
    }
  }, [
    stories,
    activeStoryIndex,
    imageWidth,
    imageHeight,
    importWaypointAnnotations,
    setTargetWaypointCamera,
    Groups,
    setActiveChannelGroup,
  ]);

  useEffect(() => {
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

  const updateGroup = (activeStory) => {
    const story = stories[activeStory];
    const group_name = story.Group;
    // TODO -- use UUID in story
    const found_group =
      Groups.find(({ Name }) => Name === group_name) || Groups[0];
    if (found_group) {
      setActiveChannelGroup(found_group.UUID);
    }
  };

  const updateViewState = (storyIndex: number) => {
    const story = stories[storyIndex] as ConfigWaypoint | undefined;
    if (!story) return;
    if (imageWidth > 0 && imageHeight > 0) {
      setTargetWaypointCamera(story);
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
    const active_story = Math.min(stories.length - 1, activeStoryIndex + 1);
    setActiveStory(active_story);
    updateGroup(active_story);
    updateViewState(active_story);
  };
  const storyAt = (i: number) => {
    const active_story = Math.min(stories.length - 1, Math.max(0, i));
    setActiveStory(active_story);
    updateGroup(active_story);
    updateViewState(active_story);
  };
  const buttonHeight = 20;
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
        viewBox="0 0 30 20"
        height={`${buttonHeight}px`}
        width={`${buttonHeight * 1.5}px`}
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="4" cy="4" r="2" fill="currentColor" />
        <circle cx="4" cy="10" r="2" fill="currentColor" />
        <circle cx="4" cy="16" r="2" fill="currentColor" />
        <path d="M 9 4 H 24" stroke="currentColor" strokeWidth="3" />
        <path d="M 9 10 H 24" stroke="currentColor" strokeWidth="3" />
        <path d="M 9 16 H 24" stroke="currentColor" strokeWidth="3" />
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
        <SVG
          d="M 14 7 L 12 0 l -12 18 l 12 17 l 2 -7 L 8 18 z"
          px={buttonHeight}
        />
      </button>
    );
  };
  const count = (
    <Count className="count">
      <div title="Current waypoint">{activeStoryIndex + 1}</div>
      <div>{"⁄"}</div>
      <div title="Number of waypoints">{stories.length}</div>
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
        <SVG
          d="M 0 7 L 2 0 l 12 18 l -12 17 l -2 -7 L 6 18 z"
          px={buttonHeight}
        />
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
    const { stories } = props;
    return (
      <TocWrapper>
        <h2 className="h6">Table of Contents</h2>
        <ol>
          {stories.map((wp: ConfigWaypoint, i: number) => {
            const goToStory = (e: MouseEvent) => {
              e.preventDefault();
              storyAt(i);
            };
            return (
              <li key={wp.UUID} onMouseDown={goToStory}>
                {wp.Name}
              </li>
            );
          })}
        </ol>
      </TocWrapper>
    );
  };

  const first_story = activeStoryIndex === 0;
  const last_story = activeStoryIndex === stories.length - 1;
  const main_title = props.name;
  const story = stories[activeStoryIndex];
  const story_title = story?.Name ?? `Waypoint ${activeStoryIndex + 1}`;
  const story_content = story?.Content;

  // Scroll waypoint content back to top when changing to a different waypoint.
  const contentPaneRef = useRef(null);
  useEffect(() => {
    if (contentPaneRef.current && activeStoryIndex != null) {
      contentPaneRef.current.scrollTop = 0;
    }
  }, [activeStoryIndex]);

  // Process story content to highlight channel names
  const { processedContent, channelColors } = useMemo(() => {
    const activeGroup = Groups.find((g) => g.UUID === activeChannelGroupId);
    if (!activeGroup || !story_content)
      return {
        processedContent: story_content || "",
        channelColors: new Map(),
      };

    const channels = activeGroup?.GroupChannels || [];

    let content = story_content;
    const colors = new Map();

    channels.forEach((channel) => {
      const { Name } = SourceChannels.find(({ UUID }) => {
        return UUID === channel.SourceChannel.UUID;
      }) || { Name: "unknown" };
      // Escape special regex characters in channel name
      const escapedName = Name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Use word boundaries to match whole words only
      const regex = new RegExp(`\\b${escapedName}\\b`, "g");
      content = content.replace(regex, `**${Name}**`);
      const { R, G, B } = channel.Color;
      const hex_color = [R, G, B]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      colors.set(Name, `#${hex_color}`);
    });

    return { processedContent: content, channelColors: colors };
  }, [story_content, activeChannelGroupId, Groups, SourceChannels]);

  return (
    <PresentationShell>
      {props.exitPlaybackPreview ? (
        <PreviewRibbon>
          <PreviewBackButton
            type="button"
            onClick={props.exitPlaybackPreview}
            title="Back to editing"
            aria-label="Back to editing"
          >
            <PreviewRibbonChevron aria-hidden />
            <span>Back</span>
          </PreviewBackButton>
          <PreviewRibbonLabel>Story preview</PreviewRibbonLabel>
        </PreviewRibbon>
      ) : null}
      <SplitGrid>
        <NavPane>
          <StoryTitle className="h5">{main_title}</StoryTitle>
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
            {first_story && <TableOfContents {...{ stories }} />}
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

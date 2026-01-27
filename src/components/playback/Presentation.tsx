import * as React from "react";
import { useEffect, useRef, useMemo } from "react";
import ReactMarkdown from 'react-markdown'
import { useOverlayStore } from "src/lib/stores";
import { AnnotationRenderer } from "src/components/viewer/layers/overlays/AnnotationLayers";
//import { theme } from "src/theme.module.css";
import styled from "styled-components";
const theme = {};

// Types
import type { ConfigProps, ConfigWaypoint } from "src/lib/config";
import type { Group, Story } from "src/lib/exhibit";
import type { HashContext } from "src/lib/hashUtil";

export type ImageProps = {
  name: string;
  groups: Group[];
};

export type PresentationProps = HashContext & ImageProps & {
  children: any,
  config: ConfigProps;
  hiddenChannel: boolean;
  startExport: () => void;
  controlPanelElement: string;
  setHiddenChannel: (v: boolean) => void;
};

const Wrap = styled.div`
  display: grid;
  height: 100%;
  overflow: hidden;
  grid-template-rows: 1fr;
  grid-template-columns: 350px 1fr;
  > :nth-child(1) {
    grid-column: 1;
    grid-row: 1;
  }
  > :nth-child(2) {
    max-height: 100vh;
    grid-column: 2;
    grid-row: 1;
  }
  > :nth-child(3) {
    grid-column: 1 / -1;
    grid-row: 2;
  }
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
`

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
`

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
      height={props.px + "px"}
      width={props.px * 1.5 + "px"}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={props.d}
        fill="currentColor"
      />
    </svg>
  )
}

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
  text-decoration-color: #${props => props.color};
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
    clearImportedAnnotations,
    imageWidth,
    imageHeight,
    setTargetWaypointViewState
  } = useOverlayStore();

  // Auto-import annotations for the active story
  // Re-run when image dimensions become available or active story changes
  useEffect(() => {
    if (stories.length === 0) return;
    // Wait for image dimensions to be set
    if (imageWidth === 0 || imageHeight === 0) return;
    // Wait for active story to be explicitly set (avoid duplicate imports)
    if (activeStoryIndex === null) return;

    const story = stories[activeStoryIndex];

    if (story) {
      // Import annotations from the story (clearing existing imported ones atomically)
      const arrows = story.Arrows || [];
      const overlays = story.Overlays || [];
      if (arrows.length > 0 || overlays.length > 0) {
        importWaypointAnnotations(arrows, overlays, true); // true = clear existing imported annotations
      } else {
        // If no annotations to import, just clear existing ones
        clearImportedAnnotations();
      }

      // Also set the initial view state based on waypoint's Pan/Zoom
      const { Pan, Zoom } = story.Properties;
      if (Pan !== undefined || Zoom !== undefined) {
        setTargetWaypointViewState(Pan || null, Zoom ?? null);
      }
    }
  // Zustand store actions are stable and don't need to be in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories, activeStoryIndex, imageWidth, imageHeight]);

  const updateGroup = (activeStory) => {
    const story = stories[activeStory];
    const group_name = story.Properties.Group
    const { Groups } = props.config.ItemRegistry;
    // TODO -- use UUID in story
    const found_group = Groups.find(
      ({ Properties }) => Properties.Name === group_name
    ) || Groups[0];
    if (found_group) {
      setActiveChannelGroup(found_group.UUID);
    }
  }

  const updateViewState = (storyIndex: number) => {
    const story = stories[storyIndex];
    if (story) {
      const { Pan, Zoom } = story.Properties;
      if (Pan !== undefined || Zoom !== undefined) {
        setTargetWaypointViewState(Pan || null, Zoom ?? null);
      }
    }
  }

  const storyFirst = () => {
    const { Groups } = props.config.ItemRegistry;
    setActiveStory(0);
    updateGroup(0);
    updateViewState(0);
  }
  const storyLeft = () => {
    const active_story = Math.max(
      0, activeStoryIndex - 1
    )
    setActiveStory(active_story)
    updateGroup(active_story);
    updateViewState(active_story);
  };
  const storyRight = () => {
    const active_story = Math.min(
      stories.length - 1, activeStoryIndex + 1
    )
    setActiveStory(active_story)
    updateGroup(active_story);
    updateViewState(active_story);
  }
  const storyAt = (i: number) => {
    const active_story = Math.min(stories.length - 1, Math.max(0, i))
    setActiveStory(active_story);
    updateGroup(active_story);
    updateViewState(active_story);
  }
  const buttonHeight = 20;
  const toc_button = (
    <button 
      className="table-of-contents" 
      title="View table of contents" 
      onMouseDown={(e) => { e.preventDefault(); storyFirst(); }}
    >
      <svg
        viewBox="0 0 30 20"
        height={buttonHeight + "px"}
        width={buttonHeight * 1.5 + "px"}
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
    const activeClass = props.active ? '' : 'inactive';
    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent any default behavior
      storyLeft();
    };
    return (
      <button 
        className={`left ${activeClass}`} 
        title="View previous waypoint" 
        onMouseDown={handleMouseDown}
      >
        <SVG d="M 14 7 L 12 0 l -12 18 l 12 17 l 2 -7 L 8 18 z" px={buttonHeight} />
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
    const activeClass = props.active ? '' : 'inactive';
    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent any default behavior
      storyRight();
    };
    return (
      <button 
        className={`right ${activeClass}`} 
        title="View next waypoint" 
        onMouseDown={handleMouseDown}
      >
        <SVG d="M 0 7 L 2 0 l 12 18 l -12 17 l -2 -7 L 6 18 z" px={buttonHeight} />
      </button>
    );
  };
  const story_next = (
    <p 
      className="right" 
      title="View next waypoint" 
      onMouseDown={(e) => { e.preventDefault(); storyRight(); }}
    >
      Next
    </p>
  );
  const TableOfContents = (props) => {
    const { stories } = props;
    return (
      <TocWrapper>
        <h2 className="h6">Table of Contents</h2>
        <ol>{
          stories.map((wp: ConfigWaypoint, i: number) => {
            const goToStory = (e: React.MouseEvent) => { 
              e.preventDefault(); 
              storyAt(i);
            };
            return <li key={i} onMouseDown={goToStory}>{wp.Properties.Name}</li>;
          })
        }</ol>
      </TocWrapper>
    );
  }

  const first_story = activeStoryIndex == 0;
  const last_story = activeStoryIndex == stories.length - 1;
  const main_title = props.name;
  const story = stories[activeStoryIndex];
  const story_title = story?.Properties?.Name ?? `Waypoint ${activeStoryIndex + 1}`;
  const story_content = story?.Properties?.Content;

  // Scroll waypoint content back to top when changing to a different waypoint.
  const contentPaneRef = useRef(null);
  useEffect(() => {
    if (contentPaneRef.current) {
      contentPaneRef.current.scrollTop = 0;
    }
  }, [activeStoryIndex])

  // Process story content to highlight channel names
  const { processedContent, channelColors } = useMemo(() => {
    const { Groups } = props.config.ItemRegistry;
    const activeGroup = Groups.find(g => g.UUID === activeChannelGroupId);
    if (!activeGroup || !story_content) return { processedContent: story_content || '', channelColors: new Map() };

    const propsGroup = props.groups.find(g => g.name === activeGroup.Properties.Name);
    const channels = propsGroup?.channels || [];
    
    let content = story_content;
    const colors = new Map();
    
    channels.forEach(channel => {
      // Escape special regex characters in channel name
      const escapedName = channel.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use word boundaries to match whole words only
      const regex = new RegExp(`\\b${escapedName}\\b`, 'g');
      content = content.replace(regex, `**${channel.name}**`);
      colors.set(channel.name, channel.color);
    });
    
    return { processedContent: content, channelColors: colors };
  }, [story_content, activeChannelGroupId, props.config.ItemRegistry, props.groups]);


  return (
    <Wrap>
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
              strong: ({ children }: any) => {
                const text = String(children);
                const color = channelColors.get(text);
                return color ? <ChannelName color={color}>{text}</ChannelName> : <strong>{children}</strong>;
              }
            }}
          >
            {processedContent}
          </ReactMarkdown>
          {first_story && <TableOfContents {...{ stories }} />}
          <InlineNext>{
            last_story
              ? <p>End</p>
              : <>{story_next} <StoryRight active={!last_story} /></>
          }</InlineNext>
        </ContentWrap>
      </NavPane>
      {props.children}
      {/* Renders annotation layers without UI */}
      <AnnotationRenderer />
    </Wrap>
  );
};

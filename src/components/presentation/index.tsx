import * as React from "react";
import { useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown'
import { useOverlayStore } from "../../lib/stores";
import { AnnotationRenderer } from "../overlays/AnnotationRenderer";
//import { theme } from "../../theme.module.css";
import styled from "styled-components";
const theme = {};

// Types
import type { ConfigProps } from "../../lib/config";
import type { Group, Story } from "../../lib/exhibit";
import type { HashContext } from "../../lib/hashUtil";

export type ImageProps = {
  name: string;
  groups: Group[];
};

export type Props = HashContext & ImageProps & {
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
  border-right: 2px solid #333;
  background: #111;
  display: grid;
  gap: 0.5em;
  z-index: 1;
  overflow: hidden;
  grid-template-rows: auto 30px 1fr;
  grid-template-columns: 1fr;
  > :nth-child(1) {
    grid-column: 1;
    grid-row: 1;
  }
  > :nth-child(2) {
    grid-column: 1;
    grid-row: 2;
  }
  > :nth-child(3) {
    overflow-y: auto;
    grid-column: 1;
    grid-row: 3;
    border-top: 2px solid #333;
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
  padding-top: 0.333em;
  margin-bottom: 0.5em;
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
    text-decoration: underline;
    cursor: pointer;
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
      height={props.px+"px"}
      width={props.px*1.5+"px"}
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

const Presentation = (props: Props) => {

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

      // Also set the initial view state based on waypoint's Pan/Zoom
      const { Pan, Zoom } = story.Properties;
      if (Pan !== undefined || Zoom !== undefined) {
        setTargetWaypointViewState(Pan || null, Zoom ?? null);
      }
    }
  }, [stories, activeStoryIndex, imageWidth, imageHeight, importWaypointAnnotations, clearImportedAnnotations, setTargetWaypointViewState]);

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

  // Update view state based on waypoint's Pan/Zoom properties
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
      0, activeStoryIndex-1
    )
    setActiveStory(active_story)
    updateGroup(active_story);
    updateViewState(active_story);
  };
  const storyRight = () => {
    const active_story = Math.min(
      stories.length-1, activeStoryIndex+1
    )
    setActiveStory(active_story)
    updateGroup(active_story);
    updateViewState(active_story);
  }
  const buttonHeight = 20;
  const table_of_contents = (
    <button className="table-of-contents" title="View table of contents" onClick={storyFirst}>
      <svg
        viewBox="0 0 30 20"
        height={buttonHeight+"px"}
        width={buttonHeight*1.5+"px"}
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
    return (
      <button className={`left ${activeClass}`} title="View previous waypoint" onClick={storyLeft}>
          <SVG d="M 14 7 L 12 0 l -12 18 l 12 17 l 2 -7 L 8 18 z" px={buttonHeight}/>
        </button>
    );
  };
  const count = (
    <Count className="count">
      <div title="Current waypoint">{activeStoryIndex+1}</div>
      <div>{"⁄"}</div>
      <div title="Number of waypoints">{stories.length}</div>
    </Count>
  );
  const StoryRight = (props) => {
    const activeClass = props.active ? '' : 'inactive';
    return (
      <button className={`right ${activeClass}`} title="View next waypoint" onClick={storyRight}>
        <SVG d="M 0 7 L 2 0 l 12 18 l -12 17 l -2 -7 L 6 18 z" px={buttonHeight}/>
      </button>
    );
  };
  const story_next = (
    <p className="right" title="View next waypoint" onClick={storyRight}>
      Next
    </p>
  );
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

  return (
    <Wrap>
      <NavPane>
        <StoryTitle className="h5">{main_title}</StoryTitle>
        <Toolbar>
          { table_of_contents }
          <StoryLeft active={!first_story} />
          { count }
          <StoryRight active={!last_story} />
        </Toolbar>
        <div ref={contentPaneRef}>
          <h2 className="h6">{story_title}</h2>
          <ReactMarkdown>
            {story_content}
          </ReactMarkdown>
          <InlineNext>{
            last_story
              ? <p>End</p>
              : [story_next, <StoryRight active={!last_story} /> ]
          }</InlineNext>
        </div>
      </NavPane>
      {props.children}
      {/* Renders annotation layers without UI */}
      <AnnotationRenderer />
    </Wrap>
  );
};

export { Presentation };

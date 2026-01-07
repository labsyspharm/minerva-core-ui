import * as React from "react";
import { useState } from "react";
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
  grid-template-rows: 1fr;
  grid-template-columns: 350px 1fr;
  > :nth-child(1) {
    grid-column: 1;
    grid-row: 1;
  }
  > :nth-child(2) {
    grid-column: 2;
    grid-row: 1;
  }
  > :nth-child(3) {
    grid-column: 1 / -1;
    grid-row: 2;
  }
`;

const NavPane = styled.div`
  border-right: 2px solid gray;
  display: grid;
  gap: 0.5em;
  z-index: 1;
  overflow: hidden;
  background-color: black;
  grid-template-rows: auto 50px 1fr;
  grid-template-columns: 1fr;
  > :nth-child(1) {
    grid-column: 1;
    grid-row: 1;
    padding: 0.5em;
  }
  > :nth-child(2) {
    grid-column: 1;
    grid-row: 2;
  }
  > :nth-child(3) {
    overflow-y: auto;
    grid-column: 1;
    grid-row: 3;
    padding: 0.5em;
}
`;

const StoryTitle = styled.div`
  margin: 0;
  line-height: 1.1;
`

const Toolbar = styled.div`
  display: grid;
  gap: 1em;
  overflow: hidden;
  padding-top: 0.333em;
  grid-template-rows: 1fr;
  grid-template-columns: 50px minmax(50px,auto) 50px 1fr 50px;
  > .left {
    grid-column: 1;
    grid-row: 1;
  }
  > .count {
    grid-column: 2;
    grid-row: 1;
  }
  > .right {
    grid-column: 3;
    grid-row: 1;
  }
  > .table-of-contents {
    grid-column: 5;
    grid-row: 1;
  }
  }
`;

const TableOfContentsRow = styled.div`
  gap: 8px 6px;
  display: grid;
  grid-template-rows: 8px;
  grid-template-columns: 8px 30px;
  > * {
    background-color: white;
  }
  > :nth-child(1) {
    border-radius: 4px;
  }
  > :nth-child(2) {
    border-radius: 1px;
  }

`
const TableOfContentsIcon = styled.button`
  display: grid;
`

const StoryContent = styled.div`
  display: grid;
  grid-template-rows: auto 50px;
  grid-template-columns: auto 50px;
  > :nth-child(1) {
    grid-column: 1/-1;
    grid-row: 1;
  }
  > :nth-child(2) {
    grid-column: 2;
    grid-row: 2;
  }
`;

const Count = styled.div`
  display: grid;
  grid-template-rows: 10px 10px 10px;
  grid-template-columns: auto 10px auto;
  > :nth-child(1) {
    text-align: right;
    grid-column: 1;
    grid-row: 1;
  }
  > :nth-child(2) {
    text-align: center;
    grid-column: 2;
    grid-row: 2;
  }
  > :nth-child(3) {
    grid-column: 3;
    grid-row: 3;
  }
`;

const SVG = (props) => {
  return (
    <svg
      viewBox="0 0 20 40"
      height={props.px+"px"}
      width={props.px/2+"px"}
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
      imageHeight
  } = useOverlayStore();

  // Auto-import annotations for the active story
  // Re-run when image dimensions become available or active story changes
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
  }, [stories, activeStoryIndex, imageWidth, imageHeight, importWaypointAnnotations, clearImportedAnnotations]);

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
  const storyFirst = () => {
    const { Groups } = props.config.ItemRegistry;
    setActiveStory(0);
    updateGroup(0);
  }
  const storyLeft = () => {
    const active_story = Math.max(
      0, activeStoryIndex-1
    )
    setActiveStory(active_story)
    updateGroup(active_story);
  };
  const storyRight = () => {
    const active_story = Math.min(
      stories.length-1, activeStoryIndex+1
    )
    setActiveStory(active_story)
    updateGroup(active_story);
  }
  const buttonHeight = 50;
  const story_left = (
    <button className="left" onClick={storyLeft}>
      <SVG d="M 14 7 L 12 0 l -12 18 l 12 17 l 2 -7 L 8 18 z" px={buttonHeight}/>
    </button>
  );
  const count = (
    <Count className="count">
      <div>{activeStoryIndex+1}</div>
      <div>{"⁄"}</div>
      <div>{stories.length}</div>
    </Count>
  );
  const story_right = (
    <button className="right" onClick={storyRight}>
      <SVG d="M 0 7 L 2 0 l 12 18 l -12 17 l -2 -7 L 6 18 z" px={buttonHeight}/>
    </button>
  );
  const table_of_contents_row = (
      <TableOfContentsRow>
        <div></div><div></div>
      </TableOfContentsRow>
  )
  const table_of_contents = (
    <TableOfContentsIcon onClick={storyFirst}
      className="table-of-contents">
      {table_of_contents_row}
      {table_of_contents_row}
      {table_of_contents_row}
    </TableOfContentsIcon>
  )
  const first_story = activeStoryIndex == 0;
  const last_story = activeStoryIndex == stories.length - 1;
  const main_title = props.name;
  const story = stories[activeStoryIndex];
  const story_title = story?.Properties?.Name ?? `Waypoint ${activeStoryIndex + 1}`;
  const story_content = story?.Properties?.Content;
  return (
    <Wrap>
      <NavPane>
        <StoryTitle className="h5">{main_title}</StoryTitle>
        <Toolbar>
          { first_story ? "" : story_left }
          { count }
          { last_story ? "" : story_right }
          { first_story ? "" : table_of_contents }
        </Toolbar>
        <StoryContent>
          <div>
            <h2 className="h6">{story_title}</h2>
            <ReactMarkdown> 
              {story_content}
            </ReactMarkdown>
          </div>
          { last_story ? "" : story_right }
        </StoryContent>
      </NavPane>
      {props.children}
      {/* Renders annotation layers without UI */}
      <AnnotationRenderer />
    </Wrap>
  );
};

export { Presentation };

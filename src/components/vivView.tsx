import * as React from "react";
import Deck from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';
import { PolygonLayer } from '@deck.gl/layers';
import { useEffect, useRef, useState, useCallback } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import { MultiscaleImageLayer } from "@hms-dbmi/viv";
import { useActiveTool } from "../lib/store";

import styled from "styled-components";
import { getWaypoint } from "../lib/waypoint";

// Types
import type { Config } from "../lib/viv";
import type { Group, Story } from "../lib/exhibit";
import type { HashContext } from "../lib/hashUtil";
import type { Selection, Color, Limit } from "../lib/viv";
import { VivLensing } from "./vivLensing";
import { LensExtension } from "@hms-dbmi/viv";

export type Props = {
  loader: any;
  groups: Group[];
  stories: Story[];
  viewerConfig: Config;
} & HashContext;

type Shape = {
  width: number;
  height: number;
};

const Main = styled.div`
  height: 100%;
`;

const isElement = (x = {}): x is HTMLElement => {
  return ["Width", "Height"].every((k) => `client${k}` in x);
};

const shapeRef = (setShape: (s: Shape) => void) => {
  return (el: unknown) => {
    if (el && isElement(el)) {
      const height = el.clientHeight;
      const width = el.clientWidth;
      setShape({ width, height });
    }
  };
};

const VivView = (props: Props) => {
  const maxShape = useWindowSize();
  const { loader, groups, stories, hash, setHash } = props;
  const { v, g, s, w } = hash;
  const toMainSettings = props.viewerConfig.toSettings;
  const [mainSettings, setMainSettings] = useState(toMainSettings(hash));
  const waypoint = getWaypoint(stories, s, w);
  const [shape, setShape] = useState(maxShape);
  const [channelSettings, setChannelSettings] = useState({});
  const [canvas, setCanvas] = useState(null);
  
  // Store hook - just for activeTool
  const activeTool = useActiveTool();
  
  const rootRef = React.useMemo(() => {
    return shapeRef(setShape);
  }, [maxShape]);

  useEffect(() => {
    //console.log("VivView: useEffect: groups", groups);
  }, [groups]);

  useEffect(() => {
    // Gets the default settings
    setMainSettings(toMainSettings(hash, loader, groups));

  }, [loader,groups,hash]);

  const mainProps = {
    ...{
      ...shape,
      id: "mainLayer",
      loader: loader.data,
      ...(mainSettings as any),
    }
  };

  // Create image layer
  const imageLayer = new MultiscaleImageLayer(mainProps);
  
  // Create simple green rectangle overlay
  const greenRectangleLayer = React.useMemo(() => {
    console.log('VivView: Creating green rectangle layer');
    
    return new PolygonLayer({
      id: 'green-rectangle',
      data: [{
        polygon: [
          [0, 0],
          [5000, 0],
          [5000, 5000],
          [0, 5000],
          [0, 0], // Close the polygon
        ]
      }],
      getPolygon: d => d.polygon,
      getFillColor: [0, 255, 0, 50], // Green with low opacity
      getLineColor: [0, 255, 0, 255], // Solid green border
      getLineWidth: 3,
      stroked: true,
      filled: true,
      pickable: true,
    });
  }, []);

  // Combine layers
  const allLayers = [imageLayer, greenRectangleLayer];
  
  console.log('VivView: allLayers:', allLayers);
  console.log('VivView: activeTool:', activeTool);
  
  const n_levels = loader.data.length;
  const shape_labels = loader.data[0].labels;
  const shape_values = loader.data[0].shape;
  const imageShape = Object.fromEntries(
    shape_labels.map((k, i) => [k, shape_values[i]])
  );
  const [viewState, setViewState] = useState({
    zoom: 1-1*n_levels,
    target: [imageShape.x / 2, imageShape.y / 2, 0]
  });

  if (!loader || !mainSettings) return null;
  return (
    <Main slot="image" ref={rootRef}>
      <Deck
        layers={allLayers}
        controller={activeTool === 'move'}
        viewState={viewState}
        onViewStateChange={e => setViewState(e.viewState)}
        views={[new OrthographicView({ id: 'ortho', controller: true })]}
      />
    </Main>
  );
};

export { VivView };

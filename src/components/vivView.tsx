import * as React from "react";
import Deck from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';
import { useEffect, useRef, useState, useCallback } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import { MultiscaleImageLayer } from "@hms-dbmi/viv";

import {
  testPyramids,
  createTileLayers, readInstances,
  readMetadata, computeImagePyramid
} from "../lib/dicom";

import styled from "styled-components";
import { getWaypoint } from "../lib/waypoint";
// import { createDragHandlers } from "../lib/dragHandlers";

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

  const rootRef = React.useMemo(() => {
    return shapeRef(setShape);
  }, [maxShape]);

  useEffect(() => {
    //console.log("VivView: useEffect: groups", groups);
  }, [groups]);

  useEffect(() => {
    // Gets the default settings
    setMainSettings(toMainSettings(hash, loader, groups));

  }, [loader, groups, hash]);

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

  // Combine layers
  const allLayers = [imageLayer];



  const n_levels = loader.data.length;
  const shape_labels = loader.data[0].labels;
  const shape_values = loader.data[0].shape;
  const imageShape = Object.fromEntries(
    shape_labels.map((k, i) => [k, shape_values[i]])
  );
  const [viewState, setViewState] = useState({
    zoom: -n_levels,
    target: [imageShape.x / 2, imageShape.y / 2, 0]
  });
  if (!loader || !mainSettings) return null;
  return (
    <Main slot="image" ref={rootRef}>
      <Deck

        layers={allLayers}
        controller={true}
        viewState={viewState}
        onViewStateChange={e => setViewState(e.viewState)}
        views={[new OrthographicView({ id: 'ortho', controller: true })]}
      />
    </Main>
  );
};

export { VivView };
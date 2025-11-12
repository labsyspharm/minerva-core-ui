import * as React from "react";
import Deck from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';
import { useEffect, useRef, useState } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import {
  createTileLayers
} from "../lib/dicom";

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
  series: string; // DICOM
  groups: Group[];
  stories: Story[];
  dicomIndex: any[];
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
  }, [loader,groups,hash]);

  // Memoize image shape computation
  const imageShape = useMemo(() => {
    const shape_labels = loader.data[0].labels;
    const shape_values = loader.data[0].shape;
    return Object.fromEntries(
      shape_labels.map((k, i) => [k, shape_values[i]])
    );
  }, [loader.data]);

  // Memoize initial view state
  const initialViewState = useMemo(() => {
    const n_levels = loader.data.length;
    return {
      zoom: -n_levels,
      target: [imageShape.x / 2, imageShape.y / 2, 0]
    } as OrthographicViewState;
  }, [loader.data, imageShape]);

  const [viewState, setViewState] = useState<OrthographicViewState>(initialViewState);

  // Memoize main props to prevent unnecessary layer recreation
  const mainProps = useMemo(() => ({
    ...shape,
    id: "mainLayer",
    loader: loader.data,
    ...(mainSettings as any),
  }), [shape, loader.data, mainSettings]);

  // Memoize layer combination
  const allLayers = useMemo(
    () => {
      // Memoize image layer creation
      if (props.series) {
        const dicomLayer = createTileLayers({
          pyramids: props.dicomIndex,
          settings: mainSettings,
          series: props.series,
        });
        return [dicomLayer, ...overlayLayers];
      }
      const imageLayer = (
        new MultiscaleImageLayer(mainProps)
      );
      return [imageLayer, ...overlayLayers];
    },
    [mainProps, overlayLayers]
  );

  // Memoize drag handlers
  const dragHandlers = useMemo(() =>
    createDragHandlers(activeTool, onOverlayInteraction),
    [activeTool, onOverlayInteraction]
  )


  // Memoize cursor function
  const getCursor = useCallback(({ isDragging, isHovering }) => {
    if (isDragging && activeTool === 'move') {
      return 'grabbing';
    } else if (activeTool === 'move' && hoveredAnnotationId) {
      return 'grab';
    } else if (activeTool === 'rectangle') {
      return isDragging ? 'grabbing' : 'crosshair';
    } else if (activeTool === 'ellipse') {
      return isDragging ? 'grabbing' : 'crosshair';
    } else if (activeTool === 'lasso') {
      return isDragging ? 'grabbing' : 'crosshair';
    } else if (activeTool === 'line') {
      return isDragging ? 'grabbing' : 'crosshair';
    } else if (activeTool === 'polyline') {
      return 'crosshair';
    } else if (activeTool === 'point') {
      return 'crosshair';
    } else if (activeTool === 'text') {
      return 'text';
    } else if (activeTool === 'move') {
      return 'default';
    }
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

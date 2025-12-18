import * as React from "react";
import Deck from '@deck.gl/react';
import { OrthographicView, OrthographicViewState } from '@deck.gl/core';
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import { MultiscaleImageLayer } from "@hms-dbmi/viv";
import { useOverlayStore } from "../lib/stores";

import {
  createTileLayers, loadDicom
} from "../lib/dicom";

import styled from "styled-components";
import { getWaypoint } from "../lib/waypoint";
import { createDragHandlers } from "../lib/dragHandlers";

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
  overlayLayers?: any[];
  activeTool: string;
  isDragging?: boolean; // New prop to indicate if dragging an annotation
  hoveredAnnotationId?: string | null; // New prop to indicate hovered annotation
  onOverlayInteraction?: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number]) => void;
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
  const { loader, groups, stories, hash, setHash, overlayLayers = [], activeTool, isDragging = false, hoveredAnnotationId = null, onOverlayInteraction } = props;
  const { v, g, s, w } = hash;
  const { 
    activeChannelGroupId
  } = useOverlayStore();
  const [shape, setShape] = useState(maxShape);
  const [channelSettings, setChannelSettings] = useState({});
  const [canvas, setCanvas] = useState(null);

  // Memoize expensive computations
  const waypoint = useMemo(() => getWaypoint(stories, s, w), [stories, s, w]);

  const rootRef = useMemo(() => {
    return shapeRef(setShape);
  }, []);

  const mainSettings = useMemo(() => {
    // Gets the default settings
    if (!loader || !groups) {
      return props.viewerConfig.toSettings(
          activeChannelGroupId  
      );
    }
    return props.viewerConfig.toSettings(
      activeChannelGroupId, loader, groups
    );
  }, [loader, groups, activeChannelGroupId]);

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

  const dicomSource = useMemo(() => {
    return loadDicom({
      pyramids: props.dicomIndex,
      series: props.series,
      little_endian: true
    });
  }, [
    props.dicomIndex, props.series
  ]);
  // Memoize dicom layer
  const dicomLayer = useMemo(
    () => {
      return createTileLayers({
        pyramids: props.dicomIndex,
        settings: mainSettings,
        dicomSource: dicomSource
      });
    },
    [
      dicomSource, mainSettings
    ]
  );
  // Memoize image layer
  const imageLayer = useMemo(
    () => {
      return new MultiscaleImageLayer(mainProps)
    }, 
    [mainProps]
  );
  // Memoize layer combination
  const allLayers = useMemo(
    () => {
      // Memoize image layer creation
      if (props.series) {
        return [dicomLayer, ...overlayLayers];
      }
      return [imageLayer, ...overlayLayers];
    },
    [
      dicomLayer, imageLayer, overlayLayers
    ]
  );
  // Memoize drag handlers
  const dragHandlers = useMemo(() =>
    createDragHandlers(activeTool, null),
    //createDragHandlers(activeTool, onOverlayInteraction),
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
    return 'default';
  }, [activeTool, hoveredAnnotationId]);

  // Memoize controller configuration
  const controllerConfig = useMemo(() => ({
    dragPan: activeTool === 'move' && !isDragging,
    dragRotate: false,
    scrollZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    touchRotate: false,
    keyboard: false
  }), [activeTool, isDragging]);

  // Memoize view configuration
  const views = useMemo(() => [new OrthographicView({ id: 'ortho', controller: true })], []);

  // Memoize view state change handler
  const handleViewStateChange = useCallback(({ interactionState, viewState: nextViewState }) => {
    if (isDragging || (activeTool !== 'move' && interactionState.isDragging)) return;
    // don't allow pan on non-move tool
    setViewState(nextViewState);
  }, [isDragging, activeTool]);

  if (!loader || !mainSettings) return null;

  return (
    <Main slot="image" ref={rootRef}>
      <Deck
        getCursor={getCursor}
        layers={allLayers}
        controller={controllerConfig}
        viewState={{'ortho': viewState}}
        onViewStateChange={handleViewStateChange}
        onClick={dragHandlers.onClick}
        onDragStart={dragHandlers.onDragStart}
        onDrag={dragHandlers.onDrag}
        onDragEnd={dragHandlers.onDragEnd}
        onHover={dragHandlers.onHover}
        views={views}
      />
    </Main>
  )
};

VivView.displayName = 'VivView';

export { VivView };

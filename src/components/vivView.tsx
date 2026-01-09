import * as React from "react";
import Deck from '@deck.gl/react';
import { OrthographicView, OrthographicViewState, LinearInterpolator } from '@deck.gl/core';
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useWindowSize } from "../lib/useWindowSize";
import { MultiscaleImageLayer, ScaleBarLayer } from "@hms-dbmi/viv";
import { useOverlayStore } from "../lib/stores";

import {
  createTileLayers, loadDicom
} from "../lib/dicom";

import styled from "styled-components";
import { getWaypoint, convertWaypointToViewState } from "../lib/waypoint";
import { createDragHandlers } from "../lib/dragHandlers";

// Types
import type { Config } from "../lib/viv";
import type { Group, Story } from "../lib/exhibit";
import type { HashContext } from "../lib/hashUtil";
import type { ConfigProps } from "../lib/config";
import type { Selection, Color, Limit } from "../lib/viv";
import { VivLensing } from "./vivLensing";
import { LensExtension } from "@hms-dbmi/viv";

export type Props = {
  loader: any;
  config: ConfigProps;
  series: string; // DICOM
  groups: Group[];
  stories: Story[];
  dicomIndex: any[];
  viewerConfig: Config;
  overlayLayers?: any[];
  activeTool: string;
  isDragging?: boolean; // New prop to indicate if dragging an annotation
  hoveredAnnotationId?: string | null; // New prop to indicate hovered annotation
  onOverlayInteraction?: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd' | 'hover', coordinate: [number, number, number]) => void;
} & HashContext;

type Shape = {
  width: number;
  height: number;
};

const Main = styled.div`
  position: relative;
  height: 100%;
`;

const isElement = (x = {}): x is HTMLElement => {
  return ["Width", "Height"].every((k) => `client${k}` in x);
};

const VivView = (props: Props) => {
  const windowSize = useWindowSize();
  const { loader, groups, stories, hash, setHash, overlayLayers = [], activeTool, isDragging = false, hoveredAnnotationId = null, onOverlayInteraction } = props;
  const { v, g, s, w } = hash;
  const {
    activeChannelGroupId
  } = useOverlayStore();
  const [viewportSize, setViewportSize] = useState(windowSize);
  const [channelSettings, setChannelSettings] = useState({});
  const [canvas, setCanvas] = useState(null);
  const rootRef = useRef<HTMLElement | null>(null);

  // Memoize expensive computations
  const waypoint = useMemo(() => getWaypoint(stories, s, w), [stories, s, w]);

  // Set up ResizeObserver to track viewport size changes
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setViewportSize({ width, height });
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
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

  // Get setViewportZoom and setImageDimensions from overlay store
  const setViewportZoom = useOverlayStore(state => state.setViewportZoom);
  const setImageDimensions = useOverlayStore(state => state.setImageDimensions);

  // Get target waypoint view state for responding to waypoint selection
  const targetWaypointPan = useOverlayStore(state => state.targetWaypointPan);
  const targetWaypointZoom = useOverlayStore(state => state.targetWaypointZoom);
  const clearTargetWaypointViewState = useOverlayStore(state => state.clearTargetWaypointViewState);

  // Update viewState when initialViewState changes (e.g., when loader changes)
  useEffect(() => {
    if (loader && loader.data && loader.data.length > 0) {
      setViewState(initialViewState);
      // Set initial viewport zoom for line width calculations
      if (typeof initialViewState.zoom === 'number') {
        setViewportZoom(initialViewState.zoom);
      }
    }
  }, [initialViewState, loader, setViewportZoom]);

  // Set image dimensions in the store when imageShape is available
  useEffect(() => {
    if (imageShape.x > 0 && imageShape.y > 0) {
      setImageDimensions(imageShape.x, imageShape.y);
    }
  }, [imageShape, setImageDimensions]);

  // Apply waypoint view state when target is set (from waypoint selection)
  useEffect(() => {
    // Skip if no target is set
    if (targetWaypointPan === null && targetWaypointZoom === null) {
      return;
    }

    // Skip if we don't have the required dimensions
    if (!imageShape.x || imageShape.x <= 0 || !imageShape.y || imageShape.y <= 0 || viewportSize.width <= 0) {
      return;
    }

    // Convert Minerva 1.5 (OSD) coordinates to Minerva 2.0 (deck.gl) view state
    const newViewState = convertWaypointToViewState(
      targetWaypointPan,
      targetWaypointZoom,
      imageShape.x,
      imageShape.y,
      viewportSize.width
    );

    if (newViewState) {
      const viewStateWithTransition = {
        ...newViewState,
        transitionDuration: 1000, // 1 second transition
        transitionInterpolator: new LinearInterpolator(['target', 'zoom']),
        transitionEasing: (x: number) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x) // ease out exponential https://easings.net/#easeOutExpo
      };

      setViewState(viewStateWithTransition as OrthographicViewState);
      setViewportZoom(newViewState.zoom);
    }

    // Clear the target after applying
    clearTargetWaypointViewState();
  }, [targetWaypointPan, targetWaypointZoom, imageShape.x, imageShape.y, viewportSize.width, clearTargetWaypointViewState, setViewportZoom]);

  // Memoize main props to prevent unnecessary layer recreation
  const mainProps = useMemo(() => ({
    ...viewportSize,
    id: "mainLayer",
    loader: loader.data,
    ...(mainSettings as any),
  }), [viewportSize, loader.data, mainSettings]);

  const dicomSource = useMemo(() => {
    if (!props.series) {
      return null;
    }
    return loadDicom({
      pyramids: props.dicomIndex,
      series: props.series,
      little_endian: true
    });
  }, [
    props.dicomIndex, props.series
  ]);
  // Memoize dicom layer
  const { SourceChannels } = props.config.ItemRegistry
  const dicomLayer = useMemo(
    () => {
      if (!props.series || !dicomSource) {
        return null;
      }
      const rgbImage = (
        (SourceChannels.length === 1) &&
        (SourceChannels[0].Properties.Samples === 3) &&
        (SourceChannels[0].Associations.SourceDataType.ID === "Uint8")
      )
      return createTileLayers({
        pyramids: props.dicomIndex,
        settings: mainSettings,
        dicomSource: dicomSource,
        rgbImage
      });
    },
    [
      dicomSource, mainSettings, props.series, props.dicomIndex,
      SourceChannels
    ]
  );
  // Memoize image layer
  const imageLayer = useMemo(
    () => {
      return new MultiscaleImageLayer(mainProps)
    },
    [mainProps]
  );
  // Memoize scale bar layer
  const scaleBarLayer = useMemo(() => {
    // Get physical size from loader metadata if available
    const physicalSize = loader?.metadata?.Pixels?.PhysicalSizeX;
    const unit = loader?.metadata?.Pixels?.PhysicalSizeXUnit || 'µm';

    if (!physicalSize || viewportSize.width <= 0 || viewportSize.height <= 0) return null;

    // ScaleBarLayer needs viewState with viewport dimensions
    const viewStateWithDimensions = {
      ...viewState,
      width: viewportSize.width,
      height: viewportSize.height,
    };

    return new ScaleBarLayer({
      id: 'scale-bar',
      viewState: viewStateWithDimensions,
      unit,
      size: physicalSize,
      snap: true,
    });
  }, [viewState, loader?.metadata, viewportSize.width, viewportSize.height]);
  // Memoize layer combination
  const allLayers = useMemo(
    () => {
      const layers = props.series && dicomLayer
        ? [dicomLayer, ...overlayLayers]
        : [imageLayer, ...overlayLayers];

      if (scaleBarLayer) {
        layers.push(scaleBarLayer);
      }
      return layers;
    },
    [
      dicomLayer, imageLayer, overlayLayers, props.series, scaleBarLayer
    ]
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
    // Update viewport zoom in store for line width scaling
    setViewportZoom(nextViewState.zoom);
  }, [isDragging, activeTool, setViewportZoom]);

  if (!loader || !mainSettings) return null;

  return (
    <Main slot="image" ref={rootRef}>
      <Deck
        getCursor={getCursor}
        layers={allLayers}
        controller={controllerConfig}
        viewState={{ 'ortho': viewState }}
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

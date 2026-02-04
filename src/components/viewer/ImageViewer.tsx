import * as React from "react";
import Deck from "@deck.gl/react";
import {
  OrthographicView,
  OrthographicViewState,
  LinearInterpolator,
} from "@deck.gl/core";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MultiscaleImageLayer, ScaleBarLayer } from "@hms-dbmi/viv";
import { FullscreenWidget } from "@deck.gl/widgets";
import styled from "styled-components";

import "@deck.gl/widgets/stylesheet.css";

import { useWindowSize } from "@/lib/useWindowSize";
import { useOverlayStore } from "@/lib/stores";
import { createTileLayers, loadDicom } from "@/lib/dicom";
import { getWaypoint, convertWaypointToViewState } from "@/lib/waypoint";
import { createDragHandlers } from "@/lib/dragHandlers";
import { LoadingWidget } from "@/components/viewer/layers/LoadingWidget";
import { Lensing } from "@/components/viewer/layers/Lensing";
import { toSettings } from "@/lib/viv";

import type { DicomIndex } from "@/lib/dicom-index";
import type { Config, Loader } from "@/lib/viv";
import type { Group, Story } from "@/lib/exhibit";
import type { HashContext } from "@/lib/hashUtil";
import type { ConfigProps } from "@/lib/config";

export type ImageViewerProps = {
  loaderOmeTiff: Loader;
  config: ConfigProps;
  groups: Group[];
  stories: Story[];
  dicomIndexList: DicomIndex[];
  viewerConfig: Config;
  overlayLayers?: any[];
  activeTool: string;
  isDragging?: boolean;
  hoveredAnnotationId?: string | null;
  onOverlayInteraction?: (
    type: "click" | "dragStart" | "drag" | "dragEnd" | "hover",
    coordinate: [number, number, number],
  ) => void;
  zoomInButton?: HTMLElement | null;
  zoomOutButton?: HTMLElement | null;
  [key: string]: any;
} & HashContext;

export const toImageProps = (opts: { props: any; buttons: any }) => {
  const { props, buttons } = opts;
  const vivProps = {
    ...props,
    viewerConfig: {
      ...buttons,
      toSettings: toSettings(props),
    },
  };
  return vivProps;
};

const Main = styled.div`
  position: relative;
  height: 100%;
`;

const isElement = (x = {}): x is HTMLElement => {
  return ["Width", "Height"].every((k) => `client${k}` in x);
};

export const ImageViewer = (props: ImageViewerProps) => {
  const windowSize = useWindowSize();
  const {
    loaderOmeTiff,
    dicomIndexList,
    groups,
    stories,
    hash,
    setHash,
    overlayLayers = [],
    activeTool,
    isDragging = false,
    hoveredAnnotationId = null,
    onOverlayInteraction,
    viewerConfig,
  } = props;
  const { v, g, s, w } = hash;
  const { activeChannelGroupId, channelVisibilities } = useOverlayStore();
  const [viewportSize, setViewportSize] = useState(windowSize);
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

  const loaderList = useMemo(
    () =>
      // Show only ome-tiff if available
      loaderOmeTiff !== null ? [loaderOmeTiff] : dicomIndexList,
    [loaderOmeTiff, dicomIndexList],
  );

  const toSettingsInternal = (
    loader,
    modality,
    groups,
    activeChannelGroupId,
    channelVisibilities,
  ) => {
    // Gets the default settings
    if (loader === null || !groups) {
      return viewerConfig.toSettings(activeChannelGroupId, modality);
    }
    return viewerConfig.toSettings(
      activeChannelGroupId,
      modality,
      loader,
      channelVisibilities,
    );
  };

  const mainSettingsOmeTiff = useMemo(() => {
    const modality = "Colorimetric";
    return toSettingsInternal(
      loaderOmeTiff,
      modality,
      groups,
      activeChannelGroupId,
      channelVisibilities,
    );
  }, [loaderOmeTiff, groups, activeChannelGroupId, channelVisibilities]);

  const mainSettingsDicomList = useMemo(() => {
    return dicomIndexList.map((dicomIndex) => {
      const { modality } = dicomIndex;
      return toSettingsInternal(
        dicomIndex.loader,
        modality,
        groups,
        activeChannelGroupId,
        channelVisibilities,
      );
    });
  }, [dicomIndexList, groups, activeChannelGroupId, channelVisibilities]);

  // Show only ome-tiff if available
  const mainSettingsList = useMemo(
    () =>
      loaderOmeTiff !== null ? [mainSettingsOmeTiff] : mainSettingsDicomList,
    [mainSettingsOmeTiff, mainSettingsDicomList],
  );

  // TODO, assert all loaders match shape
  const firstLoader = useMemo(
    () =>
      mainSettingsList.length > 0
        ? mainSettingsList[0].loader
        : {
            data: null,
            metadata: null,
          },
    [mainSettingsList],
  );

  // Memoize image shape computation
  const imageShape = useMemo(() => {
    if (firstLoader.data === null) {
      return {
        x: viewportSize.width,
        y: viewportSize.height,
      };
    }
    const shape_labels = firstLoader.data[0].labels;
    const shape_values = firstLoader.data[0].shape;
    return Object.fromEntries(shape_labels.map((k, i) => [k, shape_values[i]]));
  }, [mainSettingsList, firstLoader]);

  // Memoize initial view state
  const initialViewState = useMemo(() => {
    const n_levels = firstLoader.data === null ? 1 : firstLoader.data.length;
    return {
      zoom: -n_levels,
      target: [imageShape.x / 2, imageShape.y / 2, 0],
    } as OrthographicViewState;
  }, [firstLoader.data, imageShape]);

  const [viewState, setViewState] =
    useState<OrthographicViewState>(initialViewState);
  const hasInitialized = useRef(false);

  // Get setViewportZoom and setImageDimensions from overlay store
  const setViewportZoom = useOverlayStore((state) => state.setViewportZoom);
  const setImageDimensions = useOverlayStore(
    (state) => state.setImageDimensions,
  );

  // Get target waypoint view state for responding to waypoint selection
  const targetWaypointPan = useOverlayStore((state) => state.targetWaypointPan);
  const targetWaypointZoom = useOverlayStore(
    (state) => state.targetWaypointZoom,
  );
  const clearTargetWaypointViewState = useOverlayStore(
    (state) => state.clearTargetWaypointViewState,
  );

  // Update viewState only on initial mount (not when loader changes)
  useEffect(() => {
    if (firstLoader.data !== null && !hasInitialized.current) {
      setViewState(initialViewState);
      // Set initial viewport zoom for line width calculations
      if (typeof initialViewState.zoom === "number") {
        setViewportZoom(initialViewState.zoom);
      }
      hasInitialized.current = true;
    }
  }, [initialViewState, firstLoader.data]);

  // Set image dimensions in the store when imageShape is available
  useEffect(() => {
    if (imageShape.x > 0 && imageShape.y > 0) {
      setImageDimensions(imageShape.x, imageShape.y);
    }
  }, [imageShape]);

  // Apply waypoint view state when target is set (from waypoint selection)
  useEffect(() => {
    // Skip if no target is set
    if (targetWaypointPan === null && targetWaypointZoom === null) {
      return;
    }

    // Skip if we don't have the required dimensions
    if (
      !imageShape.x ||
      imageShape.x <= 0 ||
      !imageShape.y ||
      imageShape.y <= 0 ||
      viewportSize.width <= 0
    ) {
      return;
    }

    // Convert Minerva 1.5 (OSD) coordinates to Minerva 2.0 (deck.gl) view state
    const newViewState = convertWaypointToViewState(
      targetWaypointPan,
      targetWaypointZoom,
      imageShape.x,
      imageShape.y,
      viewportSize.width,
    );

    if (newViewState) {
      // Cancel any ongoing transition
      setViewState(
        (currentViewState) =>
          ({
            ...currentViewState,
            transitionDuration: 0,
          }) as OrthographicViewState,
      );

      // Start the new transition
      setTimeout(() => {
        const viewStateWithTransition = {
          ...newViewState,
          transitionDuration: 1000,
          transitionInterpolator: new LinearInterpolator(["target", "zoom"]),
          transitionEasing: (x: number) =>
            x === 1 ? 1 : 1 - Math.pow(2, -10 * x),
        };

        setViewState(viewStateWithTransition as OrthographicViewState);
        setViewportZoom(newViewState.zoom);
      }, 0);

      clearTargetWaypointViewState();
    }
  }, [
    targetWaypointPan,
    targetWaypointZoom,
    imageShape.x,
    imageShape.y,
    viewportSize.width,
  ]);

  // Memoize main props to prevent unnecessary layer recreation
  // Include contrast limits in ID to force layer recreation when they change
  // This prevents flash when switching channel groups
  const omeTiffPropsList = useMemo(() => {
    return mainSettingsList.map((mainSettings, i) => {
      const contrastId = mainSettings.contrastLimits
        ? mainSettings.contrastLimits.map(([l, u]) => `${l}-${u}`).join("-")
        : "default";
      return {
        ...viewportSize,
        id: `mainLayer-${i}-${contrastId}`,
        ...(mainSettings as any),
        loader: mainSettings.loader.data,
      };
    });
  }, [viewportSize, mainSettingsList]);

  const dicomSources = useMemo(() => {
    return dicomIndexList.map((opts) => {
      const { series, pyramids, modality } = opts;
      return {
        series,
        pyramids,
        modality,
        ...loadDicom({
          pyramids,
          series,
          little_endian: true,
        }),
      };
    });
  }, [dicomIndexList]);

  // Memoize dicom layer
  const dicomLayers = useMemo(() => {
    if (loaderOmeTiff !== null) {
      return [];
    }
    return dicomSources.map((dicomSource, i) => {
      const { series, pyramids, modality } = dicomSource;
      const rgbImage = modality === "Brightfield";
      // Use deterministic ID based on series to prevent layer recreation on settings change
      const imageID = `dicom-${series}-${i}`;
      return createTileLayers({
        pyramids,
        dicomSource,
        settings: mainSettingsList[i],
        rgbImage,
        imageID,
      });
    });
  }, [dicomSources, mainSettingsList]);

  // Memoize image layers
  const omeTiffLayers = useMemo(
    () =>
      loaderOmeTiff === null
        ? []
        : omeTiffPropsList.map(
            (layerProps) => new MultiscaleImageLayer(layerProps),
          ),
    [loaderOmeTiff, omeTiffPropsList],
  );

  // Memoize scale bar layer
  const scaleBarLayer = useMemo(() => {
    // Get physical size from loader metadata if available
    const physicalSize = firstLoader.metadata?.Pixels?.PhysicalSizeX;
    const unit = firstLoader.metadata?.Pixels?.PhysicalSizeXUnit || "µm";

    if (!physicalSize || viewportSize.width <= 0 || viewportSize.height <= 0)
      return null;

    // ScaleBarLayer needs viewState with viewport dimensions
    const viewStateWithDimensions = {
      ...viewState,
      width: viewportSize.width,
      height: viewportSize.height,
    };

    return new ScaleBarLayer({
      id: "scale-bar",
      viewState: viewStateWithDimensions,
      unit,
      size: physicalSize,
      snap: true,
    });
  }, [viewState, firstLoader, viewportSize.width, viewportSize.height]);

  // Memoize layer combination
  const allLayers = useMemo(() => {
    const layers =
      0 === omeTiffLayers.length
        ? [...dicomLayers, ...overlayLayers]
        : [...omeTiffLayers, ...overlayLayers];

    if (scaleBarLayer) {
      layers.push(scaleBarLayer);
    }
    return layers;
  }, [dicomLayers, omeTiffLayers, overlayLayers, scaleBarLayer]);

  // Memoize drag handlers
  const dragHandlers = useMemo(
    () => createDragHandlers(activeTool, onOverlayInteraction),
    [activeTool, onOverlayInteraction],
  );

  // Memoize cursor function
  const getCursor = useCallback(
    ({ isDragging, isHovering }) => {
      if (isDragging && activeTool === "move") {
        return "grabbing";
      } else if (activeTool === "move" && hoveredAnnotationId) {
        return "grab";
      } else if (activeTool === "rectangle") {
        return isDragging ? "grabbing" : "crosshair";
      } else if (activeTool === "ellipse") {
        return isDragging ? "grabbing" : "crosshair";
      } else if (activeTool === "lasso") {
        return isDragging ? "grabbing" : "crosshair";
      } else if (activeTool === "line") {
        return isDragging ? "grabbing" : "crosshair";
      } else if (activeTool === "polyline") {
        return "crosshair";
      } else if (activeTool === "point") {
        return "crosshair";
      } else if (activeTool === "text") {
        return "text";
      } else if (activeTool === "move") {
        return "default";
      }
      return "default";
    },
    [activeTool, hoveredAnnotationId],
  );

  // Memoize controller configuration
  const controllerConfig = useMemo(
    () => ({
      dragPan: activeTool === "move" && !isDragging,
      dragRotate: false,
      scrollZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      touchRotate: false,
      keyboard: false,
    }),
    [activeTool, isDragging],
  );

  // Memoize view configuration
  const views = useMemo(
    () => [new OrthographicView({ id: "ortho", controller: true })],
    [],
  );

  // Memoize view state change handler
  const handleViewStateChange = useCallback(
    ({ interactionState, viewState: nextViewState }) => {
      if (isDragging || (activeTool !== "move" && interactionState.isDragging))
        return;
      // don't allow pan on non-move tool
      setViewState(nextViewState);
      // Update viewport zoom in store for line width scaling
      setViewportZoom(nextViewState.zoom);
    },
    [isDragging, activeTool],
  );

  // LoadingWidget ref for onRedraw callback
  const loadingWidgetRef = useRef<{
    onRedraw: (params: { layers: any[] }) => void;
  }>(null);

  // onAfterRender callback to call LoadingWidget's onRedraw
  const handleAfterRender = useCallback(() => {
    if (loadingWidgetRef.current) {
      loadingWidgetRef.current.onRedraw({ layers: allLayers });
    }
  }, [allLayers]);

  if (mainSettingsList.length === 0) {
    return null;
  }

  return (
    <Main slot="image" ref={rootRef}>
      <Deck
        getCursor={getCursor}
        layers={allLayers}
        controller={controllerConfig}
        viewState={{ ortho: viewState }}
        onViewStateChange={handleViewStateChange}
        onClick={dragHandlers.onClick}
        onDragStart={dragHandlers.onDragStart}
        onDrag={dragHandlers.onDrag}
        onDragEnd={dragHandlers.onDragEnd}
        onHover={dragHandlers.onHover}
        onAfterRender={handleAfterRender}
        views={views}
      />
      <LoadingWidget ref={loadingWidgetRef} />
    </Main>
  );
};

ImageViewer.displayName = "ImageViewer";

import {
  LinearInterpolator,
  OrthographicView,
  type OrthographicViewState,
} from "@deck.gl/core";
import Deck from "@deck.gl/react";
import { MultiscaleImageLayer, ScaleBarLayer } from "@hms-dbmi/viv";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import "@deck.gl/widgets/stylesheet.css";

import { LoadingWidget } from "@/components/shared/viewer/layers/LoadingWidget";
import { createTileLayers, loadDicom } from "@/lib/dicom";
import type { DicomIndex } from "@/lib/dicom-index";
import { createDragHandlers } from "@/lib/dragHandlers";
import type { Story } from "@/lib/exhibit";
import type { Layer } from "@deck.gl/core";
import { useOverlayStore } from "@/lib/stores";
import type { ConfigGroup } from "@/lib/stores";
import type { OverlayLayer } from "@/lib/stores";
import { useWindowSize } from "@/lib/useWindowSize";
import type { Config, Loader } from "@/lib/viv";
import { convertWaypointToViewState } from "@/lib/waypoint";
import { createSam2ImageFetcher } from "@/lib/sam2/sam2ImageFetcher";

type ItemRegistryChannel = {
  name: string;
  color: string;
  contrast: [number, number];
};

type ItemRegistryGroup = {
  State: ConfigGroup["State"];
  channels: ItemRegistryChannel[];
  name: string;
  g: number;
};

export type ImageViewerProps = {
  loaderOmeTiff: Loader;
  stories: Story[];
  dicomIndexList: DicomIndex[];
  viewerConfig: Config;
  overlayLayers?: OverlayLayer[];
  activeTool: string;
  isDragging?: boolean;
  hoveredAnnotationId?: string | null;
  onOverlayInteraction?: (
    type: "click" | "dragStart" | "drag" | "dragEnd" | "hover",
    coordinate: [number, number, number],
  ) => void;
  groups: ItemRegistryGroup[];
  zoomInButton?: HTMLElement | null;
  zoomOutButton?: HTMLElement | null;
  [key: string]: unknown;
};

const Main = styled.div`
  position: relative;
  height: 100%;
`;

const _isElement = (x = {}): x is HTMLElement => {
  return ["Width", "Height"].every((k) => `client${k}` in x);
};

const toSettingsInternal = (
  loader,
  modality,
  groups,
  activeChannelGroupId,
  channelVisibilities,
  toSettings 
) => {
  // Gets the default settings
  if (loader === null || !groups) {
    return toSettings(activeChannelGroupId, modality);
  }
  return toSettings(
    activeChannelGroupId,
    modality,
    loader,
    channelVisibilities,
  );
};



export const ImageViewer = (props: ImageViewerProps) => {
  const windowSize = useWindowSize();
  const {
    loaderOmeTiff,
    dicomIndexList,
    groups,
    overlayLayers = [],
    activeTool,
    isDragging = false,
    hoveredAnnotationId = null,
    onOverlayInteraction,
    viewerConfig,
  } = props;
  const { activeChannelGroupId, channelVisibilities, sam2Processing } = useOverlayStore();
  const [viewportSize, setViewportSize] = useState(windowSize);
  const [_canvas, _setCanvas] = useState(null);
  const rootRef = useRef<HTMLElement | null>(null);

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

  const _loaderList = useMemo(
    () =>
      // Show only ome-tiff if available
      loaderOmeTiff !== null ? [loaderOmeTiff] : dicomIndexList,
    [loaderOmeTiff, dicomIndexList],
  );

  const mainSettingsOmeTiff = useMemo(() => {
    const modality = "Colorimetric";
    return toSettingsInternal(
      loaderOmeTiff,
      modality,
      groups,
      activeChannelGroupId,
      channelVisibilities,
      viewerConfig.toSettings
    );
  }, [loaderOmeTiff, groups, activeChannelGroupId, channelVisibilities, viewerConfig.toSettings]);

  const mainSettingsDicomList = useMemo(() => {
    return dicomIndexList.map((dicomIndex) => {
      const { modality } = dicomIndex;
      return toSettingsInternal(
        dicomIndex.loader,
        modality,
        groups,
        activeChannelGroupId,
        channelVisibilities,
        viewerConfig.toSettings
      );
    });
  }, [dicomIndexList, groups, activeChannelGroupId, channelVisibilities, viewerConfig.toSettings]);

  // Show only ome-tiff if available
  const mainSettingsList = useMemo(
    () =>
      loaderOmeTiff !== null ? [mainSettingsOmeTiff] : mainSettingsDicomList,
    [loaderOmeTiff, mainSettingsOmeTiff, mainSettingsDicomList],
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
  }, [viewportSize.width, viewportSize.height, firstLoader]);

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

  const setViewportZoom = useOverlayStore((state) => state.setViewportZoom);
  const setImageDimensions = useOverlayStore(
    (state) => state.setImageDimensions,
  );
  const setBrushViewport = useOverlayStore((state) => state.setBrushViewport);

  const viewRef = useRef({ viewState, viewportSize });
  viewRef.current = { viewState, viewportSize };

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
  }, [initialViewState, firstLoader.data, setViewportZoom]);

  useEffect(() => {
    if (imageShape.x > 0 && imageShape.y > 0) {
      setImageDimensions(imageShape.x, imageShape.y);
    }
  }, [imageShape, setImageDimensions]);

  // Sync viewport size and visible world bounds for brush (canvas-aligned mask)
  useEffect(() => {
    const { width, height } = viewportSize;
    if (width <= 0 || height <= 0) return;
    const zoom = typeof viewState?.zoom === "number" ? viewState.zoom : 0;
    const target = viewState?.target ?? [0, 0, 0];
    const scale = 2 ** zoom;
    const halfW = width / (2 * scale);
    const halfH = height / (2 * scale);
    // BitmapLayer bounds are [left, bottom, right, top] in world coords.
    // Our world space for images uses y increasing downward, so "bottom" is +halfH and "top" is -halfH.
    const bounds: [number, number, number, number] = [
      target[0] - halfW,
      target[1] + halfH,
      target[0] + halfW,
      target[1] - halfH,
    ];
    setBrushViewport(width, height, bounds);
  }, [viewState, viewportSize, setBrushViewport]);

  // Register SAM2 image fetcher for magic wand (OME-TIFF only)
  const setSam2ImageFetcher = useOverlayStore((s) => s.setSam2ImageFetcher);
  useEffect(() => {
    if (
      loaderOmeTiff &&
      firstLoader?.data &&
      mainSettingsList.length > 0 &&
      imageShape.x > 0 &&
      imageShape.y > 0
    ) {
      const settings = mainSettingsList[0];
      const fetcher = createSam2ImageFetcher(
        firstLoader,
        {
          selections: settings.selections,
          colors: settings.colors,
          contrastLimits: settings.contrastLimits,
          channelsVisible: settings.channelsVisible,
        },
        imageShape.x,
        imageShape.y,
      );
      setSam2ImageFetcher(fetcher);
    } else {
      setSam2ImageFetcher(null);
    }
    return () => setSam2ImageFetcher(null);
  }, [
    loaderOmeTiff,
    firstLoader,
    mainSettingsList,
    imageShape.x,
    imageShape.y,
    setSam2ImageFetcher,
  ]);

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
          transitionEasing: (x: number) => (x === 1 ? 1 : 1 - 2 ** (-10 * x)),
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
    clearTargetWaypointViewState,
    setViewportZoom,
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
        ...mainSettings,
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
  }, [loaderOmeTiff, dicomSources, mainSettingsList]);

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
    const units = new Set([
      "Y", "Z", "E", "P", "T", "G", "M", "k", "h", "da", "",
      "d", "c", "m", "µ", "n", "p", "f", "a", "z", "y"
    ].map(
      prefix => `${prefix}m`
    ));
    if (!units.has(unit))
      return null;
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

  const getScreenFromWorld = useCallback((worldX: number, worldY: number): [number, number] => {
    const { viewState: vs, viewportSize: vp } = viewRef.current;
    const zoom = typeof vs?.zoom === "number" ? vs.zoom : 0;
    const target = (vs as { target?: number[] })?.target ?? [0, 0, 0];
    const scale = 2 ** zoom;
    return [
      (worldX - target[0]) * scale + vp.width / 2,
      // World y increases downward for images; screen y also increases downward.
      (worldY - target[1]) * scale + vp.height / 2,
    ];
  }, []);

  const dragHandlers = useMemo(
    () => createDragHandlers(activeTool, onOverlayInteraction, getScreenFromWorld),
    [activeTool, onOverlayInteraction, getScreenFromWorld],
  );

  // Memoize cursor function
  const getCursor = useCallback(
    ({ isDragging, isHovering: _isHovering }) => {
      if (sam2Processing) return "wait";
      if (isDragging && activeTool === "move") {
        return "grabbing";
      } else if (activeTool === "move" && hoveredAnnotationId) {
        return "grab";
      } else if (activeTool === "rectangle") {
        return isDragging ? "grabbing" : "crosshair";
      } else if (activeTool === "ellipse") {
        return isDragging ? "grabbing" : "crosshair";
      } else if (activeTool === "lasso" || activeTool === "magic_wand") {
        return isDragging ? "grabbing" : "crosshair";
      } else if (activeTool === "arrow" || activeTool === "line") {
        return isDragging ? "grabbing" : "crosshair";
      } else if (activeTool === "polyline") {
        return "crosshair";
      } else if (activeTool === "point") {
        return "crosshair";
      } else if (activeTool === "text") {
        return "text";
      } else if (activeTool === "brush") {
        return "none";
      } else if (activeTool === "move") {
        return "default";
      }
      return "default";
    },
    [activeTool, hoveredAnnotationId, sam2Processing],
  );

  // Memoize controller configuration
  // When move tool is active and hovering over an annotation, disable pan so drag moves the annotation
  const controllerConfig = useMemo(
    () => ({
      dragPan:
        activeTool === "move" &&
        !isDragging &&
        !hoveredAnnotationId,
      dragRotate: false,
      scrollZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      touchRotate: false,
      keyboard: false,
    }),
    [activeTool, isDragging, hoveredAnnotationId],
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
      // Update viewport zoom in store (view state is keyed by view id "ortho")
      const zoom =
        nextViewState?.ortho?.zoom ??
        (typeof nextViewState?.zoom === "number" ? nextViewState.zoom : undefined);
      if (typeof zoom === "number") setViewportZoom(zoom);
    },
    [isDragging, activeTool, setViewportZoom],
  );

  // LoadingWidget ref for onRedraw callback
  const loadingWidgetRef = useRef<{
    onRedraw: (params: { layers: Layer[] }) => void;
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

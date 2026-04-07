import {
  LinearInterpolator,
  OrthographicView,
  type OrthographicViewState,
} from "@deck.gl/core";
import Deck, { type DeckGLRef } from "@deck.gl/react";
import { MultiscaleImageLayer, ScaleBarLayer } from "@hms-dbmi/viv";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import "@deck.gl/widgets/stylesheet.css";

import type { Layer } from "@deck.gl/core";
import { PolygonLayer } from "@deck.gl/layers";
import { LoadingWidget } from "@/components/shared/viewer/layers/LoadingWidget";
import { useAnnotationLayers } from "@/lib/annotationLayers";
import { ORTHO_VIEW_ID, SCALEBAR_VIEW_ID } from "@/lib/deckViewIds";
import { createTileLayers, loadDicom } from "@/lib/dicom";
import type { DicomIndex } from "@/lib/dicom-index";
import { createDragHandlers } from "@/lib/dragHandlers";
import type { Story } from "@/lib/exhibit";
import { createSam2ImageFetcher } from "@/lib/sam2/sam2ImageFetcher";
import type { ConfigGroup, OverlayLayer } from "@/lib/stores";
import { useOverlayStore } from "@/lib/stores";
import { useWindowSize } from "@/lib/useWindowSize";
import {
  getViewerViewportSnapshotFromDeck,
  orthographicZoomToNumber,
  registerViewerLiveSnapshotReader,
} from "@/lib/viewerViewport";
import type { Config, Loader } from "@/lib/viv";
import { getWaypointViewState } from "@/lib/waypoint";

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
  showSquareViewportOverlay?: boolean;
  squareViewportScale?: number;
  squareViewportColor?: string;
  squareViewportBorderWidth?: number;
  [key: string]: unknown;
};

const Main = styled.div`
  position: relative;
  height: 100%;
`;

const SquareViewportOverlay = styled.div`
  position: absolute;
  pointer-events: none;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
`;

const _isElement = (x = {}): x is HTMLElement => {
  return ["Width", "Height"].every((k) => `client${k}` in x);
};

/** Normalize view state to flat { zoom, target } — Deck may return ortho-nested. */
const toFlatViewState = (
  v:
    | {
        ortho?: { zoom?: number | [number, number]; target?: number[] };
        zoom?: number | [number, number];
        target?: number[];
      }
    | null
    | undefined,
): { zoom: number; target: [number, number, number] } | null => {
  const inner = v?.ortho ?? v;
  if (!inner || !Array.isArray(inner.target) || inner.target.length < 3)
    return null;
  const zoomVal = inner.zoom;
  const zoom =
    typeof zoomVal === "number"
      ? zoomVal
      : Array.isArray(zoomVal) && typeof zoomVal[0] === "number"
        ? zoomVal[0]
        : null;
  if (zoom === null) return null;
  return {
    zoom,
    target: inner.target.slice(0, 3) as [number, number, number],
  };
};

const toSettingsInternal = (
  loader,
  modality,
  groups,
  activeChannelGroupId,
  channelVisibilities,
  toSettings,
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
    showSquareViewportOverlay = false,
    squareViewportScale = 0.9,
    squareViewportColor = "rgba(255, 255, 255, 0.9)",
    squareViewportBorderWidth = 2,
  } = props;
  const {
    activeChannelGroupId,
    channelVisibilities,
    sam2Processing,
    authoringWaypointEditorOpen,
  } = useOverlayStore();
  useAnnotationLayers(authoringWaypointEditorOpen);
  const [viewportSize, setViewportSize] = useState(windowSize);
  const [_canvas, _setCanvas] = useState(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const deckRef = useRef<DeckGLRef | null>(null);

  // Set up ResizeObserver to track viewport size changes
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setViewportSize({ width, height });
        // Same tick as layout — avoids null viewerViewportSize before React commits.
        if (width > 0 && height > 0) {
          useOverlayStore.getState().setViewerViewportSize({ width, height });
        }
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  const mainSettingsOmeTiff = useMemo(() => {
    const modality = "Colorimetric";
    return toSettingsInternal(
      loaderOmeTiff,
      modality,
      groups,
      activeChannelGroupId,
      channelVisibilities,
      viewerConfig.toSettings,
    );
  }, [
    loaderOmeTiff,
    groups,
    activeChannelGroupId,
    channelVisibilities,
    viewerConfig.toSettings,
  ]);

  const mainSettingsDicomList = useMemo(() => {
    return dicomIndexList.map((dicomIndex) => {
      const { modality } = dicomIndex;
      return toSettingsInternal(
        dicomIndex.loader,
        modality,
        groups,
        activeChannelGroupId,
        channelVisibilities,
        viewerConfig.toSettings,
      );
    });
  }, [
    dicomIndexList,
    groups,
    activeChannelGroupId,
    channelVisibilities,
    viewerConfig.toSettings,
  ]);

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
      // Do not use viewport size as a stand-in for image pixels: the overlay
      // store's imageWidth/imageHeight drive legacy waypoint migration and
      // shape import scaling. Wrong values here freeze incorrect coordinates
      // because migration is skipped once ShapeIds already exist.
      return { x: 0, y: 0 };
    }
    const shape_labels = firstLoader.data[0].labels;
    const shape_values = firstLoader.data[0].shape;
    return Object.fromEntries(shape_labels.map((k, i) => [k, shape_values[i]]));
  }, [firstLoader]);

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

  // When we apply a programmatic waypoint view, ignore the next handleViewStateChange
  // (Deck may emit stale state and overwrite our update)
  const ignoreNextViewStateChangeRef = useRef(false);

  // Get target waypoint view state for responding to waypoint selection
  const targetWaypointCamera = useOverlayStore(
    (state) => state.targetWaypointCamera,
  );
  const clearTargetWaypointCamera = useOverlayStore(
    (state) => state.clearTargetWaypointCamera,
  );
  const storeImageWidth = useOverlayStore((state) => state.imageWidth);
  const storeImageHeight = useOverlayStore((state) => state.imageHeight);

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
  const setViewerViewState = useOverlayStore((s) => s.setViewerViewState);
  const setViewerViewportSize = useOverlayStore((s) => s.setViewerViewportSize);
  const setSquareViewportThumbnailCapture = useOverlayStore(
    (s) => s.setSquareViewportThumbnailCapture,
  );

  // Register SAM2 image fetcher for magic wand (OME-TIFF only)
  // Register SAM2 image fetcher for magic wand (OME-TIFF only)
  const setSam2ImageFetcher = useOverlayStore((s) => s.setSam2ImageFetcher);
  const setSam2ViewState = useOverlayStore((s) => s.setSam2ViewState);
  const setSam2ViewportSize = useOverlayStore((s) => s.setSam2ViewportSize);
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

  // Keep SAM2 store in sync with current view so useSam2 can compute the
  // visible region at click time without needing direct access to ImageViewer state.
  useEffect(() => {
    setSam2ViewState(viewState);
  }, [viewState, setSam2ViewState]);

  useEffect(() => {
    setSam2ViewportSize(viewportSize);
  }, [viewportSize, setSam2ViewportSize]);

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

  // Keep SAM2 store in sync with current view so useSam2 can compute the
  // visible region at click time without needing direct access to ImageViewer state.
  // Deck.gl passes view state keyed by view id ("ortho"); normalize to flat { zoom, target }
  // so consumers get a consistent shape.
  useEffect(() => {
    const raw = viewState as {
      ortho?: { zoom: number; target: [number, number, number] };
      zoom?: number;
      target?: [number, number, number];
    } | null;
    if (!raw) return;
    const flat =
      raw.ortho ??
      (typeof raw.zoom === "number" &&
      Array.isArray(raw.target) &&
      raw.target.length === 3
        ? { zoom: raw.zoom, target: raw.target as [number, number, number] }
        : null);
    if (flat) setViewerViewState(flat);
  }, [viewState, setViewerViewState]);

  useEffect(() => {
    setViewerViewportSize(viewportSize);
  }, [viewportSize, setViewerViewportSize]);

  useEffect(() => {
    registerViewerLiveSnapshotReader(() => {
      const fromDeck = getViewerViewportSnapshotFromDeck(deckRef.current?.deck);
      if (fromDeck) {
        const z = orthographicZoomToNumber(fromDeck.viewState.zoom);
        if (
          z !== null &&
          Array.isArray(fromDeck.viewState.target) &&
          fromDeck.viewState.target.length >= 3 &&
          fromDeck.viewportSize.width > 0 &&
          fromDeck.viewportSize.height > 0
        ) {
          return fromDeck;
        }
      }
      const { viewState: vs, viewportSize: vp } = viewRef.current;
      const flat = toFlatViewState(vs);
      if (!flat) return null;
      if (vp.width <= 0 || vp.height <= 0) return null;
      return { viewState: flat as OrthographicViewState, viewportSize: vp };
    });
    return () => registerViewerLiveSnapshotReader(null);
  }, []);

  // Apply waypoint camera when requested — resolve with this viewer's live size
  // so author vs preview layout changes cannot mix stale width/height with Deck.
  useEffect(() => {
    if (targetWaypointCamera === null) {
      return;
    }

    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    if (storeImageWidth <= 0 || storeImageHeight <= 0) {
      return;
    }

    const vs = getWaypointViewState(
      targetWaypointCamera,
      storeImageWidth,
      storeImageHeight,
      viewportSize.width,
      viewportSize.height,
    );
    if (!vs) {
      clearTargetWaypointCamera();
      return;
    }

    // Cancel any ongoing transition first
    setViewState(
      (currentViewState) =>
        ({
          ...currentViewState,
          transitionDuration: 0,
        }) as OrthographicViewState,
    );

    const clearId = window.setTimeout(() => {
      const viewStateWithTransition = {
        ...vs,
        transitionDuration: 1000,
        transitionInterpolator: new LinearInterpolator(["target", "zoom"]),
        transitionEasing: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
      };

      setViewState(viewStateWithTransition as OrthographicViewState);
      setViewportZoom(vs.zoom);
      clearTargetWaypointCamera();
    }, 0);

    return () => {
      window.clearTimeout(clearId);
    };
  }, [
    targetWaypointCamera,
    viewportSize,
    storeImageWidth,
    storeImageHeight,
    clearTargetWaypointCamera,
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
        dicomLoader: loadDicom({
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
        dicomLoader: dicomSource.dicomLoader,
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
    const units = new Set(
      [
        "Y",
        "Z",
        "E",
        "P",
        "T",
        "G",
        "M",
        "k",
        "h",
        "da",
        "",
        "d",
        "c",
        "m",
        "µ",
        "n",
        "p",
        "f",
        "a",
        "z",
        "y",
      ].map((prefix) => `${prefix}m`),
    );
    if (!units.has(unit)) return null;
    if (!physicalSize || viewportSize.width <= 0 || viewportSize.height <= 0)
      return null;

    // The updated ScaleBarLayer expects imageViewState + height/width as top-level
    // props for screen-space positioning, but the published types don't expose them.
    return new ScaleBarLayer({
      id: "scale-bar",
      imageViewState: {
        ...viewState,
        width: viewportSize.width,
        height: viewportSize.height,
      },
      unit,
      size: physicalSize,
      snap: true,
      height: viewportSize.height,
      width: viewportSize.width,
    } as ConstructorParameters<typeof ScaleBarLayer>[0]);
  }, [viewState, firstLoader, viewportSize.width, viewportSize.height]);

  // Invisible layer under the image so gutter picks have geometry (see dragHandlers toCoord).
  const worldPickSurfaceLayer = useMemo(() => {
    const w = Number(imageShape.x) || 0;
    const h = Number(imageShape.y) || 0;
    const cx = w > 0 ? w / 2 : 0;
    const cy = h > 0 ? h / 2 : 0;
    const R = Math.min(Math.max(Math.max(w, h, 4096) * 8, 512_000), 50_000_000);
    const polygon: [number, number][] = [
      [cx - R, cy - R],
      [cx + R, cy - R],
      [cx + R, cy + R],
      [cx - R, cy + R],
    ];
    return new PolygonLayer({
      id: "world-pick-surface",
      data: [{ polygon }],
      getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
      pickable: true,
      filled: true,
      stroked: false,
      getFillColor: [0, 0, 0, 0],
      getLineWidth: 0,
    });
  }, [imageShape.x, imageShape.y]);

  const allLayers = useMemo(() => {
    const imageStack = omeTiffLayers.length > 0 ? omeTiffLayers : dicomLayers;
    const layers: Layer[] = [
      worldPickSurfaceLayer,
      ...imageStack,
      ...overlayLayers,
    ];
    if (scaleBarLayer) layers.push(scaleBarLayer);
    return layers;
  }, [
    dicomLayers,
    omeTiffLayers,
    overlayLayers,
    scaleBarLayer,
    worldPickSurfaceLayer,
  ]);

  const squareViewportStyle = useMemo(() => {
    const side = Math.max(
      0,
      Math.floor(
        Math.min(viewportSize.width, viewportSize.height) *
          Math.max(0, Math.min(1, squareViewportScale)),
      ),
    );
    return {
      width: `${side}px`,
      height: `${side}px`,
      border: `${Math.max(1, Math.round(squareViewportBorderWidth))}px solid ${squareViewportColor}`,
    };
  }, [
    viewportSize.width,
    viewportSize.height,
    squareViewportScale,
    squareViewportColor,
    squareViewportBorderWidth,
  ]);

  const captureSquareViewportThumbnail = useCallback((): string | null => {
    const canvas = deckRef.current?.deck?.getCanvas() ?? undefined;
    if (!canvas) return null;
    if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return null;

    const sideCss = Math.max(
      0,
      Math.floor(
        Math.min(viewportSize.width, viewportSize.height) *
          Math.max(0, Math.min(1, squareViewportScale)),
      ),
    );
    const borderCss = Math.max(1, Math.round(squareViewportBorderWidth));
    const innerSideCss = Math.max(1, sideCss - borderCss * 2);
    if (innerSideCss <= 0) return null;

    const offsetXCss = (canvas.clientWidth - innerSideCss) / 2;
    const offsetYCss = (canvas.clientHeight - innerSideCss) / 2;
    const scaleX = canvas.width / canvas.clientWidth;
    const scaleY = canvas.height / canvas.clientHeight;

    const sx = Math.max(0, Math.round(offsetXCss * scaleX));
    const sy = Math.max(0, Math.round(offsetYCss * scaleY));
    const sw = Math.max(1, Math.round(innerSideCss * scaleX));
    const sh = Math.max(1, Math.round(innerSideCss * scaleY));

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = sw;
    sourceCanvas.height = sh;
    const sourceCtx = sourceCanvas.getContext("2d");
    if (!sourceCtx) return null;
    sourceCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    const maxThumbSize = 160;
    const outputSide = Math.max(1, Math.min(maxThumbSize, Math.min(sw, sh)));
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = outputSide;
    outputCanvas.height = outputSide;
    const outputCtx = outputCanvas.getContext("2d");
    if (!outputCtx) return null;
    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = "high";
    outputCtx.drawImage(
      sourceCanvas,
      0,
      0,
      sw,
      sh,
      0,
      0,
      outputSide,
      outputSide,
    );
    return outputCanvas.toDataURL("image/png");
  }, [
    viewportSize.width,
    viewportSize.height,
    squareViewportScale,
    squareViewportBorderWidth,
  ]);

  useEffect(() => {
    setSquareViewportThumbnailCapture(captureSquareViewportThumbnail);
    return () => setSquareViewportThumbnailCapture(null);
  }, [captureSquareViewportThumbnail, setSquareViewportThumbnailCapture]);

  const getScreenFromWorld = useCallback(
    (worldX: number, worldY: number): [number, number] => {
      const { viewState: vs, viewportSize: vp } = viewRef.current;
      const zoom = typeof vs?.zoom === "number" ? vs.zoom : 0;
      const target = (vs as { target?: number[] })?.target ?? [0, 0, 0];
      const scale = 2 ** zoom;
      return [
        (worldX - target[0]) * scale + vp.width / 2,
        // World y increases downward for images; screen y also increases downward.
        (worldY - target[1]) * scale + vp.height / 2,
      ];
    },
    [],
  );

  const dragHandlers = useMemo(
    () =>
      createDragHandlers(activeTool, onOverlayInteraction, getScreenFromWorld),
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
      dragPan: activeTool === "move" && !isDragging && !hoveredAnnotationId,
      dragRotate: false,
      scrollZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      touchRotate: false,
      keyboard: false,
    }),
    [activeTool, isDragging, hoveredAnnotationId],
  );

  // Memoize view configuration — main image view + a fixed overlay for the scale bar
  const views = useMemo(
    () => [
      new OrthographicView({ id: ORTHO_VIEW_ID, controller: true }),
      new OrthographicView({ id: SCALEBAR_VIEW_ID, controller: false }),
    ],
    [],
  );

  // Memoize view state change handler.
  const handleViewStateChange = useCallback(
    ({ viewState: nextViewState }) => {
      if (ignoreNextViewStateChangeRef.current) return;
      // Only skip while dragging an annotation (move tool). Do not skip for
      // viewport pan/zoom while using brush or other tools — otherwise the store
      // keeps a stale camera and waypoint overwrite saves the wrong view.
      if (isDragging) return;
      // Store normalized flat format when possible; else accept Deck's format
      const flat = toFlatViewState(nextViewState);
      if (flat) {
        setViewState(flat as OrthographicViewState);
        setViewportZoom(flat.zoom);
        // Keep Zustand in sync in the same tick so waypoint save / overwrite reads
        // the latest camera (the useEffect below only runs after commit).
        setViewerViewState(flat);
      } else {
        setViewState(nextViewState);
        const zoom =
          nextViewState?.ortho?.zoom ??
          (typeof nextViewState?.zoom === "number"
            ? nextViewState.zoom
            : undefined);
        if (typeof zoom === "number") setViewportZoom(zoom);
      }
    },
    [isDragging, setViewportZoom, setViewerViewState],
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

  // Route scale bar to the fixed overlay view; everything else to the main view
  const layerFilter = useCallback(
    ({ layer, viewport }: { layer: Layer; viewport: { id: string } }) => {
      if (layer.id.startsWith("scale-bar")) {
        return viewport.id === SCALEBAR_VIEW_ID;
      }
      return viewport.id === ORTHO_VIEW_ID;
    },
    [],
  );

  if (mainSettingsList.length === 0) {
    return null;
  }

  return (
    <Main slot="image" ref={rootRef}>
      <Deck
        ref={deckRef}
        getCursor={getCursor}
        layers={allLayers}
        controller={controllerConfig}
        deviceProps={{
          webgl: {
            preserveDrawingBuffer: true,
          },
        }}
        viewState={{
          [ORTHO_VIEW_ID]: viewState,
          [SCALEBAR_VIEW_ID]: {
            zoom: 0,
            target: [viewportSize.width / 2, viewportSize.height / 2, 0],
          } as Record<string, unknown>,
        }}
        onViewStateChange={handleViewStateChange}
        onClick={dragHandlers.onClick}
        onDragStart={dragHandlers.onDragStart}
        onDrag={dragHandlers.onDrag}
        onDragEnd={dragHandlers.onDragEnd}
        onHover={dragHandlers.onHover}
        onAfterRender={handleAfterRender}
        layerFilter={layerFilter}
        views={views}
      />
      <LoadingWidget ref={loadingWidgetRef} />
      {showSquareViewportOverlay && (
        <SquareViewportOverlay style={squareViewportStyle} />
      )}
    </Main>
  );
};

ImageViewer.displayName = "ImageViewer";

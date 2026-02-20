import * as React from "react";
import {
  PolygonLayer,
  type TextLayer,
  ScatterplotLayer,
  IconLayer,
} from "@deck.gl/layers";
import {
  useOverlayStore,
  ellipseToPolygon,
  lineToPolygon,
} from "@/lib/stores";
import { useAnnotationLayers, ARROW_ICON_SIZE } from "@/lib/annotationLayers";
import { useSam2 } from "@/lib/sam2/useSam2";
import ArrowDrawingIconUrl from "/icons/arrow-annotation-drawing.svg?url";

// Shared Text Edit Panel Component
interface TextEditPanelProps {
  title: string;
  textValue: string;
  fontSize: number;
  onTextChange: (text: string) => void;
  onFontSizeChange: (fontSize: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitButtonText: string;
}

const TextEditPanel: React.FC<TextEditPanelProps> = ({
  title,
  textValue,
  fontSize,
  onTextChange,
  onFontSizeChange,
  onSubmit,
  onCancel,
  submitButtonText,
}) => {
  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "#2c2c2c",
        border: "2px solid #444",
        borderRadius: "8px",
        padding: "20px",
        zIndex: 1000,
        minWidth: "300px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div
        style={{
          marginBottom: "15px",
          color: "white",
          fontSize: "16px",
          fontWeight: "bold",
        }}
      >
        {title}
      </div>

      {/* Font Size Input */}
      <div style={{ marginBottom: "15px" }}>
        <label
          htmlFor="fontSizeInput"
          style={{
            color: "white",
            fontSize: "14px",
            marginBottom: "5px",
            display: "block",
          }}
        >
          Font Size:
        </label>
        <input
          aria-label="Font Size"
          id="fontSizeInput"
          type="number"
          value={fontSize}
          onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 14)}
          min="8"
          max="72"
          style={{
            width: "80px",
            padding: "5px",
            border: "1px solid #555",
            borderRadius: "4px",
            backgroundColor: "#1a1a1a",
            color: "white",
            fontSize: "14px",
            outline: "none",
          }}
        />
      </div>

      {/* Text Input */}
      <textarea
        value={textValue}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Enter your text here..."
        style={{
          width: "100%",
          minHeight: "80px",
          padding: "10px",
          border: "1px solid #555",
          borderRadius: "4px",
          backgroundColor: "#1a1a1a",
          color: "white",
          fontSize: "14px",
          fontFamily: "Arial, sans-serif",
          resize: "vertical",
          outline: "none",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey) {
            onSubmit();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
      />

      <div
        style={{
          marginTop: "15px",
          display: "flex",
          gap: "10px",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 16px",
            backgroundColor: "#555",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!textValue.trim()}
          style={{
            padding: "8px 16px",
            backgroundColor: textValue.trim() ? "#4CAF50" : "#666",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: textValue.trim() ? "pointer" : "not-allowed",
            fontSize: "14px",
          }}
        >
          {submitButtonText}
        </button>
      </div>
      <div style={{ marginTop: "10px", fontSize: "12px", color: "#999" }}>
        Press Ctrl+Enter to submit, Escape to cancel
      </div>
    </div>
  );
};

interface DrawingOverlayProps {
  onLayerCreate: (layer: PolygonLayer | TextLayer | null) => void;
  activeTool: string;
  currentInteraction?: {
    type: "click" | "dragStart" | "drag" | "dragEnd" | "hover";
    coordinate: [number, number, number];
  } | null;
}

const getLineWidthPx = () => 3; // always 3px

// Unified preview colors for non-finalized shapes
const PREVIEW_FILL_COLOR: [number, number, number, number] = [255, 165, 0, 50]; // Orange with transparency
const PREVIEW_LINE_COLOR: [number, number, number, number] = [255, 165, 0, 255]; // Orange solid

// Pure helper function - moved outside component to avoid re-creation
const removeMiddleTwoElements = (arr: [number, number][]) => {
  const mid = arr.length / 2;
  return [...arr.slice(0, mid - 1), ...arr.slice(mid + 1)];
};

const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  onLayerCreate,
  activeTool,
  currentInteraction,
}) => {
  // Use Zustand store for drawing state
  const {
    drawingState,
    finalizeLasso,
    finalizePolyline,
    createTextAnnotation,
    createPointAnnotation,
    globalColor,
  } = useOverlayStore();
  const sam2DebugImages = useOverlayStore((s) => s.sam2DebugImages);
  const { isDrawing, dragStart, dragEnd } = drawingState;

  // Local state for lasso tool
  const [lassoPoints, setLassoPoints] = React.useState<[number, number][]>([]);
  const [isLassoDrawing, setIsLassoDrawing] = React.useState(false);

  // Local state for polygon click mode (similar to rectangle click mode)
  const [polygonClickPoints, setPolygonClickPoints] = React.useState<
    [number, number][]
  >([]);
  const [isPolygonClickMode, setIsPolygonClickMode] = React.useState(false);
  const [polygonHoverPoint, setPolygonHoverPoint] = React.useState<
    [number, number] | null
  >(null);

  // Local state for polyline tool
  const [polylinePoints, setPolylinePoints] = React.useState<
    [number, number][]
  >([]);
  const [finalizedPolylineSegmentCount, setFinalizedPolylineSegmentCount] =
    React.useState(0);
  const [isPolylineDrawing, setIsPolylineDrawing] = React.useState(false);
  const [isPolylineDragging, setIsPolylineDragging] = React.useState(false);

  // Refs to access current values without causing re-renders
  const polylinePointsRef = React.useRef<[number, number][]>([]);
  const isPolylineDrawingRef = React.useRef(false);
  const finalizeCurrentPolylineRef = React.useRef<() => void>(() => {});

  // Ref to track the last processed interaction to prevent double-processing
  const lastProcessedInteractionRef = React.useRef<{
    type: string;
    coordinate: [number, number, number];
  } | null>(null);

  // Keep refs in sync with state
  React.useEffect(() => {
    polylinePointsRef.current = polylinePoints;
  }, [polylinePoints]);

  React.useEffect(() => {
    isPolylineDrawingRef.current = isPolylineDrawing;
  }, [isPolylineDrawing]);

  // Local state for text tool
  const [showTextInput, setShowTextInput] = React.useState(false);
  const [textInputPosition, setTextInputPosition] = React.useState<
    [number, number] | null
  >(null);
  const [textInputValue, setTextInputValue] = React.useState("");
  const [textFontSize, setTextFontSize] = React.useState(14);

  // Local state for click-to-draw rectangle
  const [rectangleFirstClick, setRectangleFirstClick] = React.useState<
    [number, number] | null
  >(null);
  const [rectangleSecondClick, setRectangleSecondClick] = React.useState<
    [number, number] | null
  >(null);
  const [isRectangleClickMode, setIsRectangleClickMode] = React.useState(false);

  // Local state for click-to-draw line
  const [lineFirstClick, setLineFirstClick] = React.useState<
    [number, number] | null
  >(null);
  const [lineSecondClick, setLineSecondClick] = React.useState<
    [number, number] | null
  >(null);
  const [isLineClickMode, setIsLineClickMode] = React.useState(false);

  // SAM2 magic wand
  const {
    runSegmentation,
    isProcessing: isSam2Processing,
    error: sam2Error,
  } = useSam2();

  // Local state for click-to-draw ellipse
  const [ellipseFirstClick, setEllipseFirstClick] = React.useState<
    [number, number] | null
  >(null);
  const [ellipseSecondClick, setEllipseSecondClick] = React.useState<
    [number, number] | null
  >(null);
  const [isEllipseClickMode, setIsEllipseClickMode] = React.useState(false);

  // Handle polyline finalization
  const finalizeCurrentPolyline = React.useCallback(() => {
    if (polylinePoints.length >= 2) {
      let finalizedPoints = [...polylinePoints];
      if (polylinePoints.length > finalizedPolylineSegmentCount * 2) {
        finalizedPoints = removeMiddleTwoElements(finalizedPoints);
      }
      finalizePolyline(finalizedPoints);
      setIsPolylineDrawing(false);
      setPolylinePoints([]);
      setFinalizedPolylineSegmentCount(0);
    }
  }, [polylinePoints, finalizedPolylineSegmentCount, finalizePolyline]);

  React.useEffect(() => {
    finalizeCurrentPolylineRef.current = finalizeCurrentPolyline;
  }, [finalizeCurrentPolyline]);

  // When polyline drag is active, listen for pointerup on window so we end the drag
  // even if the user releases outside the canvas (Deck.gl may not fire onDragEnd).
  React.useEffect(() => {
    if (activeTool !== "polyline" || !isPolylineDragging) return;

    const handlePointerUp = () => {
      finalizeCurrentPolylineRef.current();
      setIsPolylineDragging(false);
    };

    window.addEventListener("pointerup", handlePointerUp, true);
    return () => window.removeEventListener("pointerup", handlePointerUp, true);
  }, [activeTool, isPolylineDragging]);

  // Handle rectangle finalization from click mode
  const finalizeClickRectangle = React.useCallback(() => {
    if (rectangleFirstClick && rectangleSecondClick) {
      const [startX, startY] = rectangleFirstClick;
      const [endX, endY] = rectangleSecondClick;
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);

      const polygonData: [number, number][] = [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY],
      ];

      // Create rectangle annotation directly using click coordinates
      const annotation = {
        id: `rect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "rectangle" as const,
        polygon: polygonData,
        style: {
          fillColor: [globalColor[0], globalColor[1], globalColor[2], 50] as [
            number,
            number,
            number,
            number,
          ],
          lineColor: globalColor as [number, number, number, number],
          lineWidth: 3,
        },
        metadata: {
          createdAt: new Date(),
        },
      };

      // Add the annotation to the store
      useOverlayStore.getState().addAnnotation(annotation);

      // Reset rectangle click state
      setRectangleFirstClick(null);
      setRectangleSecondClick(null);
      setIsRectangleClickMode(false);
    }
  }, [rectangleFirstClick, rectangleSecondClick, globalColor]);

  // Handle polygon finalization from click mode
  const finalizeClickPolygon = React.useCallback(() => {
    if (polygonClickPoints.length >= 3) {
      // Close the polygon by adding the first point at the end
      const closedPolygon = [...polygonClickPoints, polygonClickPoints[0]];

      // Create polygon annotation directly using click coordinates
      const annotation = {
        id: `polygon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "polygon" as const,
        polygon: closedPolygon,
        style: {
          fillColor: [globalColor[0], globalColor[1], globalColor[2], 50] as [
            number,
            number,
            number,
            number,
          ],
          lineColor: globalColor as [number, number, number, number],
          lineWidth: 3,
        },
        metadata: {
          createdAt: new Date(),
        },
      };

      // Add the annotation to the store
      useOverlayStore.getState().addAnnotation(annotation);

      // Reset polygon click state
      setPolygonClickPoints([]);
      setIsPolygonClickMode(false);
      setPolygonHoverPoint(null);
    }
  }, [polygonClickPoints, globalColor]);

  // Handle line/arrow finalization from click mode
  const finalizeClickLine = React.useCallback(() => {
    if (lineFirstClick && lineSecondClick) {
      const [startX, startY] = lineFirstClick;
      const [endX, endY] = lineSecondClick;
      const lineWidth = 3;
      const hasArrowHead = activeTool === "arrow";

      // Arrow uses degenerate polygon; plain line uses lineToPolygon for proper stroke
      const linePolygon: [number, number][] = hasArrowHead
        ? [
            [startX, startY],
            [endX, endY],
            [endX, endY],
            [startX, startY],
            [startX, startY],
          ]
        : lineToPolygon([startX, startY], [endX, endY], lineWidth);

      const annotation = {
        id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "line" as const,
        polygon: linePolygon,
        hasArrowHead,
        style: {
          fillColor: [0, 0, 0, 0] as [number, number, number, number], // Transparent fill
          lineColor: globalColor as [number, number, number, number],
          lineWidth,
        },
        metadata: {
          createdAt: new Date(),
        },
      };

      useOverlayStore.getState().addAnnotation(annotation);

      // Reset line click state
      setLineFirstClick(null);
      setLineSecondClick(null);
      setIsLineClickMode(false);
    }
  }, [lineFirstClick, lineSecondClick, globalColor, activeTool]);

  // Handle ellipse finalization from click mode
  const finalizeClickEllipse = React.useCallback(() => {
    if (ellipseFirstClick && ellipseSecondClick) {
      // Generate ellipse polygon using helper function
      const ellipsePolygon = ellipseToPolygon(
        ellipseFirstClick,
        ellipseSecondClick,
      );

      // Create ellipse annotation directly using click coordinates
      const annotation = {
        id: `ellipse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "ellipse" as const,
        polygon: ellipsePolygon,
        style: {
          fillColor: [globalColor[0], globalColor[1], globalColor[2], 50] as [
            number,
            number,
            number,
            number,
          ],
          lineColor: globalColor as [number, number, number, number],
          lineWidth: 3,
        },
        metadata: {
          createdAt: new Date(),
        },
      };

      // Add the annotation to the store
      useOverlayStore.getState().addAnnotation(annotation);

      // Reset ellipse click state
      setEllipseFirstClick(null);
      setEllipseSecondClick(null);
      setIsEllipseClickMode(false);
    }
  }, [ellipseFirstClick, ellipseSecondClick, globalColor]);

  // Handle tool changes - clear state when switching tools
  React.useEffect(() => {
    if (activeTool !== "lasso") {
      setIsLassoDrawing(false);
      setPolygonClickPoints([]);
      setIsPolygonClickMode(false);
      setPolygonHoverPoint(null);
    }
    if (activeTool !== "rectangle") {
      setRectangleFirstClick(null);
      setRectangleSecondClick(null);
      setIsRectangleClickMode(false);
    }
    if (activeTool !== "arrow" && activeTool !== "line") {
      setLineFirstClick(null);
      setLineSecondClick(null);
      setIsLineClickMode(false);
    }
    if (activeTool !== "ellipse") {
      setEllipseFirstClick(null);
      setEllipseSecondClick(null);
      setIsEllipseClickMode(false);
    }
    setPolylinePoints([]);
    setFinalizedPolylineSegmentCount(0);
    setIsPolylineDragging(false);
    setLassoPoints([]);

    // Clear the last processed interaction when tool changes
    lastProcessedInteractionRef.current = null;
  }, [activeTool]);

  // Handle keyboard events for polyline finalization
  React.useEffect(() => {
    if (activeTool !== "polyline") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Finalize polyline on Enter, Return, or Escape
      if (
        event.key === "Enter" ||
        event.key === "Return" ||
        event.key === "Escape"
      ) {
        event.preventDefault();
        finalizeCurrentPolyline();
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTool, finalizeCurrentPolyline]);

  // Handle keyboard events for rectangle finalization
  React.useEffect(() => {
    if (activeTool !== "rectangle") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Cancel rectangle drawing on Escape
      if (event.key === "Escape" && isRectangleClickMode) {
        event.preventDefault();
        setRectangleFirstClick(null);
        setRectangleSecondClick(null);
        setIsRectangleClickMode(false);
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTool, isRectangleClickMode]);

  // Handle keyboard events for line/arrow finalization
  React.useEffect(() => {
    if (activeTool !== "arrow" && activeTool !== "line") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Cancel line drawing on Escape
      if (event.key === "Escape" && isLineClickMode) {
        event.preventDefault();
        setLineFirstClick(null);
        setLineSecondClick(null);
        setIsLineClickMode(false);
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTool, isLineClickMode]);

  // Handle keyboard events for ellipse finalization
  React.useEffect(() => {
    if (activeTool !== "ellipse") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Cancel ellipse drawing on Escape
      if (event.key === "Escape" && isEllipseClickMode) {
        event.preventDefault();
        setEllipseFirstClick(null);
        setEllipseSecondClick(null);
        setIsEllipseClickMode(false);
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTool, isEllipseClickMode]);

  // Handle keyboard events for polygon finalization
  React.useEffect(() => {
    if (activeTool !== "lasso") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Finalize polygon on Enter, Return, or Escape
      if (
        (event.key === "Enter" ||
          event.key === "Return" ||
          event.key === "Escape") &&
        isPolygonClickMode
      ) {
        event.preventDefault();
        if (event.key === "Escape") {
          // Cancel polygon drawing
          setPolygonClickPoints([]);
          setIsPolygonClickMode(false);
          setPolygonHoverPoint(null);
        } else {
          // Finalize polygon
          finalizeClickPolygon();
        }
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTool, isPolygonClickMode, finalizeClickPolygon]);

  // Simplified interaction handler for creation tools only
  React.useEffect(() => {
    if (!currentInteraction) return;

    const { type, coordinate } = currentInteraction;

    // Check if we've already processed this interaction
    // Skip deduplication for hover interactions to allow smooth mouse tracking
    const lastProcessed = lastProcessedInteractionRef.current;
    if (
      lastProcessed &&
      lastProcessed.type === type &&
      lastProcessed.coordinate[0] === coordinate[0] &&
      lastProcessed.coordinate[1] === coordinate[1] &&
      lastProcessed.coordinate[2] === coordinate[2] &&
      type !== "hover"
    ) {
      return;
    }

    // Mark this interaction as processed (except for hover to allow continuous tracking)
    if (type !== "hover") {
      lastProcessedInteractionRef.current = { type, coordinate };
    }

    const [x, y] = coordinate;

    // Handle hover interactions for all tools

    if (activeTool === "text" && type === "click") {
      // Show text input when clicking with text tool
      setTextInputPosition([x, y]);
      setShowTextInput(true);
      setTextInputValue("");
    } else if (activeTool === "point") {
      if (type === "click" || type === "dragEnd") {
        createPointAnnotation([x, y], 5); // Default radius of 5 pixels
      }
    } else if (activeTool === "magic_wand") {
      if (type === "click" && !isSam2Processing) {
        void runSegmentation(x, y);
      }
    } else if (activeTool === "lasso") {
      if (type === "click") {
        // Click mode: Add point to polygon
        if (!isPolygonClickMode) {
          // First click - start polygon drawing
          setPolygonClickPoints([[x, y] as [number, number]]);
          setIsPolygonClickMode(true);
        } else {
          // Subsequent clicks - add corner point
          setPolygonClickPoints((prev) => [
            ...prev,
            [x, y] as [number, number],
          ]);
        }
      } else if (type === "hover") {
        if (isPolygonClickMode) {
          // Update hover point for preview
          setPolygonHoverPoint([x, y] as [number, number]);
        }
      } else if (type === "dragStart") {
        // Drag mode: Start lasso drawing (fallback to original behavior)
        if (!isLassoDrawing && !isPolygonClickMode) {
          setIsLassoDrawing(true);
          setLassoPoints([[x, y] as [number, number]]);
        }
      } else if (type === "drag" && isLassoDrawing) {
        // Update lasso with drag points for smooth drawing
        setLassoPoints((prev) => [...prev, [x, y] as [number, number]]);
      } else if (type === "dragEnd" && isLassoDrawing) {
        // Finish lasso drawing
        const finalPoints: [number, number][] = [
          ...lassoPoints,
          [x, y] as [number, number],
        ];

        // Finalize the lasso as an annotation
        if (finalPoints.length >= 3) {
          finalizeLasso(finalPoints);
          setIsLassoDrawing(false);
          setLassoPoints([]); // Clear points
        }
      }
    } else if (activeTool === "rectangle") {
      if (type === "click") {
        if (!isRectangleClickMode) {
          // First click - start rectangle drawing
          setRectangleFirstClick([x, y]);
          setIsRectangleClickMode(true);
        } else {
          // Second click - finalize rectangle
          setRectangleSecondClick([x, y]);
          finalizeClickRectangle();
        }
      } else if (
        type === "hover" &&
        isRectangleClickMode &&
        rectangleFirstClick
      ) {
        // Update the second click position for preview during hover
        setRectangleSecondClick([x, y]);
      }
    } else if (activeTool === "arrow" || activeTool === "line") {
      if (type === "click") {
        if (!isLineClickMode) {
          // First click - start line/arrow drawing
          setLineFirstClick([x, y]);
          setIsLineClickMode(true);
        } else {
          // Second click - finalize line/arrow
          setLineSecondClick([x, y]);
          finalizeClickLine();
        }
      } else if (type === "hover" && isLineClickMode && lineFirstClick) {
        // Update the second click position for preview during hover
        setLineSecondClick([x, y]);
      }
    } else if (activeTool === "ellipse") {
      if (type === "click") {
        if (!isEllipseClickMode) {
          // First click - start ellipse drawing
          setEllipseFirstClick([x, y]);
          setIsEllipseClickMode(true);
        } else {
          // Second click - finalize ellipse
          setEllipseSecondClick([x, y]);
          finalizeClickEllipse();
        }
      } else if (type === "hover" && isEllipseClickMode && ellipseFirstClick) {
        // Update the second click position for preview during hover
        setEllipseSecondClick([x, y]);
      }
    } else if (activeTool === "polyline") {
      let prevPoints = [...polylinePoints];
      if (prevPoints.length > finalizedPolylineSegmentCount * 2) {
        prevPoints = removeMiddleTwoElements(prevPoints);
      }
      if (type === "click") {
        // Add point to polyline on single click
        // Add additional points - add twice in the middle of the array
        const middleIndex = Math.floor(prevPoints.length / 2);
        const newPoint = [x, y] as [number, number];
        const newPoints = [...prevPoints];
        newPoints.splice(middleIndex, 0, newPoint, newPoint);
        setPolylinePoints(newPoints);
        setFinalizedPolylineSegmentCount((prev) => prev + 1);
      } else if (type === "dragStart") {
        // Start dragging - set dragging state
        setIsPolylineDragging(true);
      } else if (type === "drag") {
        // Add point to polyline during drag
        // Add additional points - add twice in the middle of the array
        const middleIndex = Math.floor(prevPoints.length / 2);
        const newPoint = [x, y] as [number, number];
        const newPoints = [...prevPoints];
        newPoints.splice(middleIndex, 0, newPoint, newPoint);
        setPolylinePoints(newPoints);
        setFinalizedPolylineSegmentCount((prev) => prev + 1);
      } else if (type === "dragEnd") {
        // Finalize polyline if user was dragging or if there are any points
        if (isPolylineDragging || polylinePoints.length >= 2) {
          finalizeCurrentPolyline();
        }
        setIsPolylineDragging(false);
      } else if (type === "hover") {
        // based on the number of segments finalized, add temporary point for this hover
        const middleIndex = Math.floor(prevPoints.length / 2);
        const newPoint = [x, y] as [number, number];
        const newPoints = [...prevPoints];
        newPoints.splice(middleIndex, 0, newPoint, newPoint);
        setPolylinePoints(newPoints);
      }
    }
  }, [
    currentInteraction,
    activeTool,
    isLassoDrawing,
    isPolylineDragging,
    isRectangleClickMode,
    rectangleFirstClick,
    isLineClickMode,
    lineFirstClick,
    isEllipseClickMode,
    ellipseFirstClick,
    isPolygonClickMode,
    lassoPoints,
    polylinePoints,
    finalizedPolylineSegmentCount,
    createPointAnnotation,
    finalizeClickRectangle,
    finalizeClickLine,
    finalizeClickEllipse,
    finalizeLasso,
    finalizeCurrentPolyline,
    isSam2Processing,
    runSegmentation,
  ]);

  // Handle text input submission
  const handleTextSubmit = () => {
    if (textInputPosition && textInputValue.trim()) {
      createTextAnnotation(
        textInputPosition,
        textInputValue.trim(),
        textFontSize,
      );
    }
    setShowTextInput(false);
    setTextInputPosition(null);
    setTextInputValue("");
    setTextFontSize(14); // Reset to default
  };

  // Handle text input cancellation
  const handleTextCancel = () => {
    setShowTextInput(false);
    setTextInputPosition(null);
    setTextInputValue("");
    setTextFontSize(14); // Reset to default
  };

  // Unified drawing layer - handles all drawing tools with one layer
  const drawingLayer = React.useMemo(() => {
    // Determine polygon data and styling based on active tool
    let polygonData: [number, number][] | null = null;
    const layerId = "drawing-layer";
    let fillColor: [number, number, number, number] = PREVIEW_FILL_COLOR;
    const lineColor: [number, number, number, number] = PREVIEW_LINE_COLOR;
    let shouldFill = true;
    const lineWidth = getLineWidthPx(); // Default line width

    // Rectangle tool: uses click-to-draw mode or drag mode
    if (activeTool === "rectangle") {
      // Check for click-to-draw mode first
      if (isRectangleClickMode && rectangleFirstClick && rectangleSecondClick) {
        const [startX, startY] = rectangleFirstClick;
        const [endX, endY] = rectangleSecondClick;
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);

        polygonData = [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY],
        ];
      }
      // Fall back to drag mode for backward compatibility
      else if (isDrawing && dragStart && dragEnd) {
        const [startX, startY] = dragStart;
        const [endX, endY] = dragEnd;
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);

        polygonData = [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY],
        ];
      }
    }
    // Lasso tool: uses click mode or drag mode
    else if (activeTool === "lasso") {
      // Check for click-to-draw mode first
      if (isPolygonClickMode && polygonClickPoints.length >= 1) {
        let previewPoints = [...polygonClickPoints];

        // Add hover point for preview if available
        if (polygonHoverPoint) {
          previewPoints = [...polygonClickPoints, polygonHoverPoint];
        }

        // Show preview if we have at least 1 point
        if (previewPoints.length >= 1) {
          polygonData = previewPoints;
          fillColor = [
            PREVIEW_LINE_COLOR[0],
            PREVIEW_LINE_COLOR[1],
            PREVIEW_LINE_COLOR[2],
            0,
          ]; // No fill for preview
          shouldFill = false; // Don't fill the preview
        }
      }
      // Fall back to drag mode for backward compatibility
      else if (isLassoDrawing && lassoPoints.length >= 3) {
        polygonData = [...lassoPoints, lassoPoints[0]]; // Close the polygon
      }
    }
    // Polyline tool: uses polylinePoints array without closing
    else if (activeTool === "polyline" && polylinePoints.length >= 1) {
      polygonData = polylinePoints;
      fillColor = [
        PREVIEW_LINE_COLOR[0],
        PREVIEW_LINE_COLOR[1],
        PREVIEW_LINE_COLOR[2],
        0,
      ]; // No fill for polyline
      shouldFill = false;
    }
    // Arrow tool: preview is drawn as arrow icon only (see arrowPreviewLayer)
    else if (activeTool === "arrow") {
      // No polygon data - arrow preview is a separate IconLayer
    }
    // Plain line tool: show polygon stroke preview (click mode and drag mode)
    else if (activeTool === "line") {
      if (isLineClickMode && lineFirstClick) {
        const end =
          lineSecondClick ??
          (currentInteraction?.type === "hover"
            ? [currentInteraction.coordinate[0], currentInteraction.coordinate[1]]
            : null);
        if (end) {
          polygonData = lineToPolygon(
            lineFirstClick,
            [end[0], end[1]],
            getLineWidthPx(),
          );
          fillColor = [
            PREVIEW_LINE_COLOR[0],
            PREVIEW_LINE_COLOR[1],
            PREVIEW_LINE_COLOR[2],
            0,
          ];
          shouldFill = false;
        }
      } else if (isDrawing && dragStart && dragEnd) {
        polygonData = lineToPolygon(
          [dragStart[0], dragStart[1]],
          [dragEnd[0], dragEnd[1]],
          getLineWidthPx(),
        );
        fillColor = [
          PREVIEW_LINE_COLOR[0],
          PREVIEW_LINE_COLOR[1],
          PREVIEW_LINE_COLOR[2],
          0,
        ];
        shouldFill = false;
      }
    }
    // Ellipse tool: uses click mode or drag mode
    else if (activeTool === "ellipse") {
      // Check for click-to-draw mode first
      if (isEllipseClickMode && ellipseFirstClick && ellipseSecondClick) {
        // Generate ellipse polygon using helper function
        polygonData = ellipseToPolygon(ellipseFirstClick, ellipseSecondClick);
      }
      // Fall back to drag mode for backward compatibility
      else if (isDrawing && dragStart && dragEnd) {
        // Generate ellipse polygon using helper function
        polygonData = ellipseToPolygon(dragStart, dragEnd);
      }
    }
    // Return null if no polygon data
    if (!polygonData) {
      return null;
    }

    // Determine if we should stroke (arrow uses IconLayer, not polygon; plain line needs stroke)
    const shouldStroke = activeTool !== "arrow";

    // Create single unified polygon layer
    return new PolygonLayer({
      id: layerId,
      data: [{ polygon: polygonData }],
      getPolygon: (d) => d.polygon,
      getFillColor: fillColor,
      getLineColor: lineColor,
      getLineWidth: lineWidth,
      lineWidthScale: 1,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: lineWidth,
      lineWidthMaxPixels: lineWidth,
      stroked: shouldStroke,
      filled: shouldFill,
    });
  }, [
    activeTool,
    isDrawing,
    dragStart,
    dragEnd,
    isLassoDrawing,
    lassoPoints,
    polylinePoints,
    isRectangleClickMode,
    rectangleFirstClick,
    rectangleSecondClick,
    isEllipseClickMode,
    ellipseFirstClick,
    ellipseSecondClick,
    isPolygonClickMode,
    polygonClickPoints,
    polygonHoverPoint,
    isLineClickMode,
    lineFirstClick,
    lineSecondClick,
    currentInteraction,
  ]);

  // Arrow preview layer: shows arrow icon from start to current position (updates on mouse move)
  const arrowPreviewLayer = React.useMemo(() => {
    if (activeTool !== "arrow") return null;

    let start: [number, number] | null = null;
    let end: [number, number] | null = null;

    if (isLineClickMode && lineFirstClick) {
      start = lineFirstClick;
      // Use second click if set, otherwise use current hover so arrow follows mouse
      end =
        lineSecondClick ??
        (currentInteraction?.type === "hover"
          ? [currentInteraction.coordinate[0], currentInteraction.coordinate[1]]
          : null);
    } else if (isDrawing && dragStart && dragEnd) {
      start = [dragStart[0], dragStart[1]];
      end = [dragEnd[0], dragEnd[1]];
    }

    if (!start || !end) return null;

    const [startX, startY] = start;
    const [endX, endY] = end;
    const dx = endX - startX;
    const dy = endY - startY;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI + 90;

    const arrowColor: [number, number, number, number] = [
      PREVIEW_LINE_COLOR[0],
      PREVIEW_LINE_COLOR[1],
      PREVIEW_LINE_COLOR[2],
      PREVIEW_LINE_COLOR[3],
    ];

    return new IconLayer({
      id: "drawing-arrow-preview",
      data: [{ position: [endX, endY, 0], angle: angleDeg, color: arrowColor }],
      getPosition: (d) => d.position,
      getIcon: () => ({
        url: ArrowDrawingIconUrl,
        width: ARROW_ICON_SIZE,
        height: ARROW_ICON_SIZE,
        anchorX: ARROW_ICON_SIZE / 2,
        anchorY: ARROW_ICON_SIZE / 2,
      }),
      getSize: ARROW_ICON_SIZE,
      sizeUnits: "pixels",
      sizeMinPixels: ARROW_ICON_SIZE,
      sizeMaxPixels: ARROW_ICON_SIZE,
      getAngle: (d) => d.angle,
      getColor: (d) => d.color,
      pickable: false,
      billboard: false,
    });
  }, [
    activeTool,
    isLineClickMode,
    lineFirstClick,
    lineSecondClick,
    currentInteraction,
    isDrawing,
    dragStart,
    dragEnd,
  ]);

  // Text placement marker - shows where text will be placed
  const textPlacementMarker = React.useMemo(() => {
    if (!textInputPosition || !showTextInput) {
      return null;
    }

    const [x, y] = textInputPosition;

    // Create a point marker using ScatterplotLayer for consistent size
    return new ScatterplotLayer({
      id: "text-placement-marker",
      data: [
        {
          position: [x, y, 0],
          radius: 5,
        },
      ],
      getPosition: (d) => d.position,
      getRadius: (d) => d.radius,
      radiusMinPixels: 5,
      radiusMaxPixels: 5,
      getFillColor: [255, 255, 0, 200], // Yellow with some transparency
      getLineColor: [255, 255, 255, 255], // White outline
      getLineWidth: 2,
      lineWidthMinPixels: 2,
      lineWidthMaxPixels: 2,
      stroked: true,
      filled: true,
      pickable: false,
    });
  }, [textInputPosition, showTextInput]);

  // Use shared hook to create and sync annotation layers to the store
  useAnnotationLayers();

  // Notify parent when drawing layer is created or removed
  React.useEffect(() => {
    if (drawingLayer) {
      onLayerCreate(drawingLayer);
    } else {
      onLayerCreate(null);
    }
  }, [drawingLayer, onLayerCreate]);

  // Add/remove arrow preview layer so it shows and updates as mouse moves
  React.useEffect(() => {
    if (arrowPreviewLayer) {
      useOverlayStore.getState().addOverlayLayer(arrowPreviewLayer);
    }
    return () => {
      useOverlayStore.getState().removeOverlayLayer("drawing-arrow-preview");
    };
  }, [arrowPreviewLayer]);

  // Handle text placement marker layer
  React.useEffect(() => {
    if (textPlacementMarker) {
      useOverlayStore.getState().addOverlayLayer(textPlacementMarker);
    } else {
      useOverlayStore.getState().removeOverlayLayer("text-placement-marker");
    }

    // Cleanup on unmount
    return () => {
      useOverlayStore.getState().removeOverlayLayer("text-placement-marker");
    };
  }, [textPlacementMarker]);

  return (
    <>
      {/* SAM2 error toast */}
      {sam2Error && activeTool === "magic_wand" && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#c62828",
            color: "white",
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 14,
            zIndex: 1000,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          {sam2Error}
        </div>
      )}

      {/* SAM2 debug overlay - images shown when localStorage sam2_debug=1 */}
      {sam2DebugImages && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            display: "flex",
            gap: 12,
            backgroundColor: "rgba(0,0,0,0.85)",
            padding: 12,
            borderRadius: 8,
            zIndex: 1001,
            maxWidth: "90vw",
          }}
        >
          {sam2DebugImages.encoded ? (
            <div>
              <div style={{ color: "#ccc", fontSize: 12, marginBottom: 4 }}>
                Encoded (1024×1024)
              </div>
              <img
                src={sam2DebugImages.encoded}
                alt="SAM2 encoded"
                style={{ maxWidth: 256, maxHeight: 256, display: "block" }}
                title="Right-click → Save image as"
              />
            </div>
          ) : null}
          {sam2DebugImages.mask ? (
            <div>
              <div style={{ color: "#ccc", fontSize: 12, marginBottom: 4 }}>
                Mask (256×256)
              </div>
              <img
                src={sam2DebugImages.mask}
                alt="SAM2 mask"
                style={{ maxWidth: 256, maxHeight: 256, display: "block" }}
                title="Right-click → Save image as"
              />
            </div>
          ) : (
            <div style={{ color: "#888", fontSize: 12 }}>
              Mask: waiting for decode…
            </div>
          )}
        </div>
      )}

      {/* Text Input Modal */}
      {showTextInput && textInputPosition && (
        <TextEditPanel
          title="Add Text Annotation"
          textValue={textInputValue}
          fontSize={textFontSize}
          onTextChange={setTextInputValue}
          onFontSizeChange={setTextFontSize}
          onSubmit={handleTextSubmit}
          onCancel={handleTextCancel}
          submitButtonText="Add Text"
        />
      )}
    </>
  );
};

export { DrawingOverlay };
export type { DrawingOverlayProps };

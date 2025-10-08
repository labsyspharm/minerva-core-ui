import * as React from "react";
import { PolygonLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import { useOverlayStore } from "../../lib/stores";

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
  submitButtonText
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#2c2c2c',
        border: '2px solid #444',
        borderRadius: '8px',
        padding: '20px',
        zIndex: 1000,
        minWidth: '300px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div style={{ marginBottom: '15px', color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
        {title}
      </div>

      {/* Font Size Input */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ color: 'white', fontSize: '14px', marginBottom: '5px', display: 'block' }}>
          Font Size:
        </label>
        <input
          type="number"
          value={fontSize}
          onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 14)}
          min="8"
          max="72"
          style={{
            width: '80px',
            padding: '5px',
            border: '1px solid #555',
            borderRadius: '4px',
            backgroundColor: '#1a1a1a',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
          }}
        />
      </div>

      {/* Text Input */}
      <textarea
        value={textValue}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Enter your text here..."
        style={{
          width: '100%',
          minHeight: '80px',
          padding: '10px',
          border: '1px solid #555',
          borderRadius: '4px',
          backgroundColor: '#1a1a1a',
          color: 'white',
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          resize: 'vertical',
          outline: 'none',
        }}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            onSubmit();
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
      />

      <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            backgroundColor: '#555',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!textValue.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: textValue.trim() ? '#4CAF50' : '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: textValue.trim() ? 'pointer' : 'not-allowed',
            fontSize: '14px',
          }}
        >
          {submitButtonText}
        </button>
      </div>
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
        Press Ctrl+Enter to submit, Escape to cancel
      </div>
    </div>
  );
};

interface DrawingOverlayProps {
  onLayerCreate: (layer: PolygonLayer | TextLayer | null) => void;
  activeTool: string;
  currentInteraction?: { type: 'click' | 'dragStart' | 'drag' | 'dragEnd' | 'hover', coordinate: [number, number, number] } | null;
}

const getLineWidthPx = () => 3; // always 3px

const DrawingOverlay: React.FC<DrawingOverlayProps> = ({ onLayerCreate, activeTool, currentInteraction }) => {
  // Use Zustand store for drawing state
  const { drawingState, finalizeLasso, finalizePolyline, createTextAnnotation, createPointAnnotation, globalColor } = useOverlayStore();
  const { isDrawing, dragStart, dragEnd } = drawingState;

  // Local state for lasso tool
  const [lassoPoints, setLassoPoints] = React.useState<[number, number][]>([]);
  const [isLassoDrawing, setIsLassoDrawing] = React.useState(false);
  
  // Local state for polygon click mode (similar to rectangle click mode)
  const [polygonClickPoints, setPolygonClickPoints] = React.useState<[number, number][]>([]);
  const [isPolygonClickMode, setIsPolygonClickMode] = React.useState(false);
  const [polygonHoverPoint, setPolygonHoverPoint] = React.useState<[number, number] | null>(null);

  // Local state for polyline tool
  const [polylinePoints, setPolylinePoints] = React.useState<[number, number][]>([]);
  const [finalizedPolylineSegmentCount, setFinalizedPolylineSegmentCount] = React.useState(0);
  const [isPolylineDrawing, setIsPolylineDrawing] = React.useState(false);
  const [isPolylineDragging, setIsPolylineDragging] = React.useState(false);

  // Refs to access current values without causing re-renders
  const polylinePointsRef = React.useRef<[number, number][]>([]);
  const isPolylineDrawingRef = React.useRef(false);

  // Ref to track the last processed interaction to prevent double-processing
  const lastProcessedInteractionRef = React.useRef<{ type: string, coordinate: [number, number, number] } | null>(null);

  // Keep refs in sync with state
  React.useEffect(() => {
    polylinePointsRef.current = polylinePoints;
  }, [polylinePoints]);

  React.useEffect(() => {
    isPolylineDrawingRef.current = isPolylineDrawing;
  }, [isPolylineDrawing]);

  // Local state for text tool
  const [showTextInput, setShowTextInput] = React.useState(false);
  const [textInputPosition, setTextInputPosition] = React.useState<[number, number] | null>(null);
  const [textInputValue, setTextInputValue] = React.useState('');
  const [textFontSize, setTextFontSize] = React.useState(14);

  // Local state for click-to-draw rectangle
  const [rectangleFirstClick, setRectangleFirstClick] = React.useState<[number, number] | null>(null);
  const [rectangleSecondClick, setRectangleSecondClick] = React.useState<[number, number] | null>(null);
  const [isRectangleClickMode, setIsRectangleClickMode] = React.useState(false);
  const removeMiddleTwoElements = (arr: [number, number][]) => {
    const mid = arr.length / 2;
    return [...arr.slice(0, mid - 1), ...arr.slice(mid + 1)];
  };

  // Handle polyline finalization
  const finalizeCurrentPolyline = () => {
    if (polylinePoints.length >= 2) {
      let finalizedPoints = [...polylinePoints];
      if (polylinePoints.length > (finalizedPolylineSegmentCount * 2)) {
        finalizedPoints = removeMiddleTwoElements(finalizedPoints);
      }
      finalizePolyline(finalizedPoints);
      setIsPolylineDrawing(false);
      setPolylinePoints([]);
      setFinalizedPolylineSegmentCount(0);
    }
  };

  // Handle rectangle finalization from click mode
  const finalizeClickRectangle = () => {
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
        type: 'rectangle' as const,
        polygon: polygonData,
        style: {
          fillColor: [globalColor[0], globalColor[1], globalColor[2], 50] as [number, number, number, number],
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
  };

  // Handle polygon finalization from click mode
  const finalizeClickPolygon = () => {
    if (polygonClickPoints.length >= 3) {
      // Close the polygon by adding the first point at the end
      const closedPolygon = [...polygonClickPoints, polygonClickPoints[0]];
      
      // Create polygon annotation directly using click coordinates
      const annotation = {
        id: `polygon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'polygon' as const,
        polygon: closedPolygon,
        style: {
          fillColor: [globalColor[0], globalColor[1], globalColor[2], 50] as [number, number, number, number],
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
  };

  // Handle tool changes - clear state when switching tools
  React.useEffect(() => {
    if (activeTool !== 'lasso') {
      setIsLassoDrawing(false);
      setPolygonClickPoints([]);
      setIsPolygonClickMode(false);
      setPolygonHoverPoint(null);
    }
    if (activeTool !== 'rectangle') {
      setRectangleFirstClick(null);
      setRectangleSecondClick(null);
      setIsRectangleClickMode(false);
    }
    setPolylinePoints([]);
    setFinalizedPolylineSegmentCount(0);
    setIsPolylineDragging(false);
    setLassoPoints([]);

    // Clear the last processed interaction when tool changes
    lastProcessedInteractionRef.current = null;
  }, [activeTool, finalizePolyline]);

  // Handle keyboard events for polyline finalization
  React.useEffect(() => {
    if (activeTool !== 'polyline') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Finalize polyline on Enter, Return, or Escape
      if (event.key === 'Enter' || event.key === 'Return' || event.key === 'Escape') {
        event.preventDefault();
        finalizeCurrentPolyline();
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTool, isPolylineDrawing, polylinePoints, finalizeCurrentPolyline]);

  // Handle keyboard events for rectangle finalization
  React.useEffect(() => {
    if (activeTool !== 'rectangle') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Cancel rectangle drawing on Escape
      if (event.key === 'Escape' && isRectangleClickMode) {
        event.preventDefault();
        setRectangleFirstClick(null);
        setRectangleSecondClick(null);
        setIsRectangleClickMode(false);
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTool, isRectangleClickMode]);

  // Handle keyboard events for polygon finalization
  React.useEffect(() => {
    if (activeTool !== 'lasso') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Finalize polygon on Enter, Return, or Escape
      if ((event.key === 'Enter' || event.key === 'Return' || event.key === 'Escape') && isPolygonClickMode) {
        event.preventDefault();
        if (event.key === 'Escape') {
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
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTool, isPolygonClickMode, polygonClickPoints, finalizeClickPolygon]);

  // Simplified interaction handler for creation tools only
  React.useEffect(() => {
    if (!currentInteraction) return;

    const { type, coordinate } = currentInteraction;
    console.log('DrawingOverlay: Received interaction:', type, 'at coordinate:', coordinate, 'activeTool:', activeTool);

    // Check if we've already processed this interaction
    // Skip deduplication for hover interactions to allow smooth mouse tracking
    const lastProcessed = lastProcessedInteractionRef.current;
    if (lastProcessed &&
      lastProcessed.type === type &&
      lastProcessed.coordinate[0] === coordinate[0] &&
      lastProcessed.coordinate[1] === coordinate[1] &&
      lastProcessed.coordinate[2] === coordinate[2] &&
      type !== 'hover') {
      console.log('DrawingOverlay: Skipping already processed interaction:', type);
      return;
    }

    // Mark this interaction as processed (except for hover to allow continuous tracking)
    if (type !== 'hover') {
      lastProcessedInteractionRef.current = { type, coordinate };
    }

    const [x, y] = coordinate;

    // Handle hover interactions for all tools

    if (activeTool === 'text' && type === 'click') {
      // Show text input when clicking with text tool
      setTextInputPosition([x, y]);
      setShowTextInput(true);
      setTextInputValue('');
    } else if (activeTool === 'point') {
      if (type === 'click' || type === 'dragEnd') {
        createPointAnnotation([x, y], 5); // Default radius of 5 pixels
      }
    } else if (activeTool === 'lasso') {
      console.log('DrawingOverlay: Received lasso interaction:', type, 'at coordinate:', [x, y]);
      console.log('DrawingOverlay: Current state - isPolygonClickMode:', isPolygonClickMode, 'isLassoDrawing:', isLassoDrawing);

      if (type === 'click') {
        // Click mode: Add point to polygon
        if (!isPolygonClickMode) {
          // First click - start polygon drawing
          console.log('DrawingOverlay: First polygon click at:', [x, y]);
          setPolygonClickPoints([[x, y] as [number, number]]);
          setIsPolygonClickMode(true);
        } else {
          // Subsequent clicks - add corner point
          console.log('DrawingOverlay: Adding polygon corner at:', [x, y]);
          setPolygonClickPoints(prev => [...prev, [x, y] as [number, number]]);
        }
      } else if (type === 'hover') {
        console.log('DrawingOverlay: Hover interaction received, isPolygonClickMode:', isPolygonClickMode);
        if (isPolygonClickMode) {
          // Update hover point for preview
          console.log('DrawingOverlay: Updating polygon hover point:', [x, y]);
          setPolygonHoverPoint([x, y] as [number, number]);
        }
      } else if (type === 'dragStart') {
        // Drag mode: Start lasso drawing (fallback to original behavior)
        if (!isLassoDrawing && !isPolygonClickMode) {
          setIsLassoDrawing(true);
          setLassoPoints([[x, y] as [number, number]]);
        }
      } else if (type === 'drag' && isLassoDrawing) {
        // Update lasso with drag points for smooth drawing
        setLassoPoints(prev => [...prev, [x, y] as [number, number]]);
      } else if (type === 'dragEnd' && isLassoDrawing) {
        // Finish lasso drawing
        console.log('DrawingOverlay: Processing lasso dragEnd');
        const finalPoints: [number, number][] = [...lassoPoints, [x, y] as [number, number]];

        // Finalize the lasso as an annotation
        if (finalPoints.length >= 3) {
          console.log('DrawingOverlay: Calling finalizeLasso with', finalPoints.length, 'points');
          finalizeLasso(finalPoints);
          setIsLassoDrawing(false);
          setLassoPoints([]); // Clear points
        }
      }
    } else if (activeTool === 'rectangle') {
      console.log('DrawingOverlay: Received rectangle interaction:', type, 'at coordinate:', [x, y]);

      if (type === 'click') {
        if (!isRectangleClickMode) {
          // First click - start rectangle drawing
          console.log('DrawingOverlay: First rectangle click at:', [x, y]);
          setRectangleFirstClick([x, y]);
          setIsRectangleClickMode(true);
        } else {
          // Second click - finalize rectangle
          console.log('DrawingOverlay: Second rectangle click at:', [x, y]);
          setRectangleSecondClick([x, y]);
          finalizeClickRectangle();
        }
      } else if (type === 'hover' && isRectangleClickMode && rectangleFirstClick) {
        // Update the second click position for preview during hover
        setRectangleSecondClick([x, y]);
      }
    } else if (activeTool === 'polyline') {
      console.log('DrawingOverlay: Received polyline interaction:', type, 'at coordinate:', [x, y]);

      let prevPoints = [...polylinePoints];
      if (prevPoints.length > (finalizedPolylineSegmentCount * 2)) {
        prevPoints = removeMiddleTwoElements(prevPoints);
      }
      if (type === 'click') {
        // Add point to polyline on single click
        console.log('DrawingOverlay: Adding polyline segment point via click:', [x, y]);
        // Add additional points - add twice in the middle of the array
        const middleIndex = Math.floor(prevPoints.length / 2);
        const newPoint = [x, y] as [number, number];
        const newPoints = [...prevPoints];
        newPoints.splice(middleIndex, 0, newPoint, newPoint);
        console.log('DrawingOverlay: New points:', newPoints);
        setPolylinePoints(newPoints);
        setFinalizedPolylineSegmentCount(prev => prev + 1);
      } else if (type === 'dragStart') {
        // Start dragging - set dragging state
        console.log('DrawingOverlay: Starting polyline drag');
        setIsPolylineDragging(true);
      } else if (type === 'drag') {
        // Add point to polyline during drag
        console.log('DrawingOverlay: Adding polyline segment point via drag:', [x, y]);
        // Add additional points - add twice in the middle of the array
        const middleIndex = Math.floor(prevPoints.length / 2);
        const newPoint = [x, y] as [number, number];
        const newPoints = [...prevPoints];
        newPoints.splice(middleIndex, 0, newPoint, newPoint);
        console.log('DrawingOverlay: New points:', newPoints);
        setPolylinePoints(newPoints);
        setFinalizedPolylineSegmentCount(prev => prev + 1);
      } else if (type === 'dragEnd') {
        // Finalize polyline only if user was actually dragging
        console.log('DrawingOverlay: dragEnd received, was dragging:', isPolylineDragging);
        if (isPolylineDragging) {
          console.log('DrawingOverlay: Finalizing polyline on dragEnd');
          finalizeCurrentPolyline();
        }
        setIsPolylineDragging(false);
      } else if (type === 'hover') {
        console.log('Hovering over polyline');
        // based on the number of segments finalized, add temporary point for this hover
        const middleIndex = Math.floor(prevPoints.length / 2);
        const newPoint = [x, y] as [number, number];
        const newPoints = [...prevPoints];
        newPoints.splice(middleIndex, 0, newPoint, newPoint);
        console.log('DrawingOverlay: New points:', newPoints);
        setPolylinePoints(newPoints);
        console.log('DrawingOverlay: Hover interaction at coordinate:', [x, y]);
      }
    }
  }, [currentInteraction, activeTool, isLassoDrawing, finalizeLasso, isPolylineDrawing, isPolylineDragging, finalizePolyline, isRectangleClickMode, rectangleFirstClick, finalizeClickRectangle, isPolygonClickMode, polygonClickPoints, finalizeClickPolygon]);

  // Handle text input submission
  const handleTextSubmit = () => {
    if (textInputPosition && textInputValue.trim()) {
      console.log('DrawingOverlay: Creating text annotation at position:', textInputPosition, 'with text:', textInputValue.trim(), 'fontSize:', textFontSize);
      createTextAnnotation(textInputPosition, textInputValue.trim(), textFontSize);
    } else {
      console.log('DrawingOverlay: Cannot create text annotation - missing position or empty text');
    }
    setShowTextInput(false);
    setTextInputPosition(null);
    setTextInputValue('');
    setTextFontSize(14); // Reset to default
  };

  // Handle text input cancellation
  const handleTextCancel = () => {
    setShowTextInput(false);
    setTextInputPosition(null);
    setTextInputValue('');
    setTextFontSize(14); // Reset to default
  };

  // Unified drawing layer - handles all drawing tools with one layer
  const drawingLayer = React.useMemo(() => {
    // Determine polygon data and styling based on active tool
    let polygonData: [number, number][] | null = null;
    let layerId = 'drawing-layer';
    let fillColor: [number, number, number, number] = [0, 255, 0, 50];
    let lineColor: [number, number, number, number] = [0, 255, 0, 255];
    let shouldFill = true;

    // Rectangle tool: uses click-to-draw mode or drag mode
    if (activeTool === 'rectangle') {
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
        console.log('DrawingOverlay: Click rectangle polygon data:', polygonData);
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
        console.log('DrawingOverlay: Drag rectangle polygon data:', polygonData);
      }
    }
    // Lasso tool: uses click mode or drag mode
    else if (activeTool === 'lasso') {
      console.log('DrawingOverlay: Processing lasso tool, isPolygonClickMode:', isPolygonClickMode, 'polygonClickPoints.length:', polygonClickPoints.length, 'polygonHoverPoint:', polygonHoverPoint);
      // Check for click-to-draw mode first
      if (isPolygonClickMode && polygonClickPoints.length >= 1) {
        let previewPoints = [...polygonClickPoints];
        
        // Add hover point for preview if available
        if (polygonHoverPoint) {
          previewPoints = [...polygonClickPoints, polygonHoverPoint];
          console.log('DrawingOverlay: Polygon click points:', polygonClickPoints.length, 'hover point:', polygonHoverPoint);
        } else {
          console.log('DrawingOverlay: Polygon click points:', polygonClickPoints.length, 'no hover point');
        }
        
        // Show preview if we have at least 1 point
        if (previewPoints.length >= 1) {
          polygonData = previewPoints;
          fillColor = [255, 165, 0, 0]; // No fill for preview
          lineColor = [255, 165, 0, 255]; // Orange line
          shouldFill = false; // Don't fill the preview
          console.log('DrawingOverlay: Click polygon preview data:', polygonData);
        }
      }
      // Fall back to drag mode for backward compatibility
      else if (isLassoDrawing && lassoPoints.length >= 3) {
        polygonData = [...lassoPoints, lassoPoints[0]]; // Close the polygon
        fillColor = [255, 165, 0, 50]; // Orange
        lineColor = [255, 165, 0, 255];
        console.log('DrawingOverlay: Lasso drag polygon data:', polygonData);
      }
    }
    // Polyline tool: uses polylinePoints array without closing
    else if (activeTool === 'polyline' && polylinePoints.length >= 1) {
      polygonData = polylinePoints;
      fillColor = [0, 255, 0, 0]; // No fill for polyline
      shouldFill = false;
      console.log('DrawingOverlay: Polyline polygon data:', polygonData);
    }
    // Line tool: uses dragStart/dragEnd to create line coordinates
    else if (activeTool === 'line' && isDrawing && dragStart && dragEnd) {
      const [startX, startY] = dragStart;
      const [endX, endY] = dragEnd;

      polygonData = [
        [startX, startY],
        [endX, endY],
        [endX, endY],
        [startX, startY],
        [startX, startY]
      ];
      fillColor = [0, 255, 255, 50]; // Cyan
      lineColor = [0, 255, 255, 255];
      console.log('DrawingOverlay: Line polygon data:', polygonData);
    }

    // Return null if no polygon data
    if (!polygonData) {
      return null;
    }

    // Create single unified polygon layer
    return new PolygonLayer({
      id: layerId,
      data: [{ polygon: polygonData }],
      getPolygon: d => d.polygon,
      getFillColor: fillColor,
      getLineColor: lineColor,
      getLineWidth: getLineWidthPx(),
      lineWidthScale: 1,
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: getLineWidthPx(),
      lineWidthMaxPixels: getLineWidthPx(),
      stroked: true,
      filled: shouldFill,
    });
  }, [activeTool, isDrawing, dragStart, dragEnd, isLassoDrawing, lassoPoints, isPolylineDrawing, polylinePoints, isRectangleClickMode, rectangleFirstClick, rectangleSecondClick, isPolygonClickMode, polygonClickPoints, polygonHoverPoint]);

  // Get annotations from store with proper reactivity
  const annotations = useOverlayStore(state => state.annotations);

  // Get hidden layers from store
  const hiddenLayers = useOverlayStore(state => state.hiddenLayers);

  // Debug: Log annotations when they change
  React.useEffect(() => {
    console.log('DrawingOverlay: Annotations changed:', annotations);
  }, [annotations]);

  // Create persistent annotation layers from stored annotations (excluding hidden ones)
  // All annotations are now rendered as polygon layers
  const annotationLayers = React.useMemo(() => {
    const layers: (PolygonLayer | TextLayer | ScatterplotLayer)[] = [];

    annotations
      .filter(annotation => !hiddenLayers.has(annotation.id)) // Filter out hidden annotations
      .forEach(annotation => {
        if (annotation.type === 'text') {
          // Create text layer for text annotations
          layers.push(new TextLayer({
            id: `annotation-${annotation.id}`,
            data: [{
              text: annotation.text,
              position: [annotation.position[0], annotation.position[1], 0], // Add z coordinate
            }],
            getText: d => d.text,
            getPosition: d => d.position,
            getColor: annotation.style.fontColor,
            getBackgroundColor: annotation.style.backgroundColor || [0, 0, 0, 100],
            getSize: annotation.style.fontSize,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            padding: 4,
            pickable: true,
          }));
        } else if (annotation.type === 'point') {
          // Create scatterplot layer for point annotations
          console.log('DrawingOverlay: Creating point annotation:', annotation);
          layers.push(new ScatterplotLayer({
            id: `annotation-${annotation.id}`,
            data: [{
              position: [annotation.position[0], annotation.position[1], 0], // Add z coordinate
              radius: annotation.style.radius,
            }],
            getPosition: d => { console.log('DrawingOverlay: Point position:', d.position); return d.position; },
            getRadius: d => { console.log('DrawingOverlay: Point radius:', d.radius); return d.radius; },
            radiusMinPixels: annotation.style.radius,
            radiusMaxPixels: annotation.style.radius,
            getFillColor: [255, 140, 0],
            getLineColor: [0, 0, 0],
            getLineWidth: 10,
            pickable: true
          }));
        } else {
          // Create polygon layer for other annotations
          let fillColor: [number, number, number, number] = [255, 255, 255, 1]; // Default: very low opacity white fill

          // @ts-ignore - polyline type exists at runtime but not in type definition
          if (annotation.type === 'line' || annotation.type === 'polyline') {
            fillColor = [0, 0, 0, 0]; // Lines and polylines don't have fill
          }

          layers.push(new PolygonLayer({
            id: `annotation-${annotation.id}`,
            data: [{
              polygon: annotation.polygon
            }],
            getPolygon: d => d.polygon,
            getFillColor: fillColor,
            getLineColor: annotation.style.lineColor,
            getLineWidth: annotation.style.lineWidth * 10,
            lineWidthScale: 1,
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: annotation.style.lineWidth,
            lineWidthMaxPixels: annotation.style.lineWidth,
            stroked: true,
            filled: true,
          }));
        }
      });

    return layers;
  }, [annotations, hiddenLayers]);

  // Notify parent when drawing layer is created or removed
  React.useEffect(() => {
    if (drawingLayer) {
      console.log('DrawingOverlay: Notifying parent of drawing layer for tool:', activeTool);
      onLayerCreate(drawingLayer);
    } else {
      console.log('DrawingOverlay: Notifying parent to remove drawing layer');
      onLayerCreate(null);
    }
  }, [drawingLayer, activeTool, onLayerCreate]);

  // Handle annotation layers - they are now managed through the overlay layers system
  React.useEffect(() => {
    console.log('DrawingOverlay: Updating annotation layers:', annotationLayers.length, 'layers');

    // Clear existing annotation layers from overlay store
    const currentLayers = useOverlayStore.getState().overlayLayers;
    const annotationLayerIds = currentLayers
      .filter(layer => layer && layer.id.startsWith('annotation-'))
      .map(layer => layer.id);

    console.log('DrawingOverlay: Removing old annotation layers:', annotationLayerIds);

    // Remove old annotation layers
    annotationLayerIds.forEach(layerId => {
      useOverlayStore.getState().removeOverlayLayer(layerId);
    });

    // Add new annotation layers
    annotationLayers.forEach(layer => {
      if (layer) {
        console.log('DrawingOverlay: Adding annotation layer:', layer.id);
        useOverlayStore.getState().addOverlayLayer(layer);
      }
    });
  }, [annotationLayers]);

  return (
    <>
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

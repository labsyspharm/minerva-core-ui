import * as React from "react";
import { PolygonLayer, TextLayer } from '@deck.gl/layers';
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
  currentInteraction?: { type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number] } | null;
}

const getLineWidthPx = () => 3; // always 3px

const DrawingOverlay: React.FC<DrawingOverlayProps> = ({ onLayerCreate, activeTool, currentInteraction }) => {
  // Use Zustand store for drawing state
  const { drawingState, finalizeLasso, finalizePolyline, createTextAnnotation, globalColor } = useOverlayStore();
  const { isDrawing, dragStart, dragEnd } = drawingState;

  // Local state for lasso tool
  const [lassoPoints, setLassoPoints] = React.useState<[number, number][]>([]);
  const [isLassoDrawing, setIsLassoDrawing] = React.useState(false);

  // Local state for polyline tool
  const [polylinePoints, setPolylinePoints] = React.useState<[number, number][]>([]);
  const [isPolylineDrawing, setIsPolylineDrawing] = React.useState(false);
  
  // Refs to access current values without causing re-renders
  const polylinePointsRef = React.useRef<[number, number][]>([]);
  const isPolylineDrawingRef = React.useRef(false);

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

  // Handle polyline finalization
  const finalizeCurrentPolyline = () => {
    if (isPolylineDrawing && polylinePoints.length >= 2) {
      console.log('DrawingOverlay: Finalizing polyline with points:', polylinePoints);
      finalizePolyline(polylinePoints);
      setIsPolylineDrawing(false);
      setPolylinePoints([]);
    }
  };

  // Handle tool changes - clear state when switching tools
  React.useEffect(() => {
    if (activeTool !== 'lasso') {
      setLassoPoints([]);
      setIsLassoDrawing(false);
    }
    if (activeTool !== 'polyline') {
      // Finalize polyline if we were drawing one
      if (isPolylineDrawingRef.current && polylinePointsRef.current.length >= 2) {
        finalizePolyline(polylinePointsRef.current);
      }
      setPolylinePoints([]);
      setIsPolylineDrawing(false);
    }
  }, [activeTool, finalizePolyline]);

  // Handle keyboard events for polyline finalization
  React.useEffect(() => {
    if (activeTool !== 'polyline' || !isPolylineDrawing) return;

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

  // Simplified interaction handler for creation tools only
  React.useEffect(() => {
    if (!currentInteraction) return;

    const { type, coordinate } = currentInteraction;
    const [x, y] = coordinate;

    if (activeTool === 'text' && type === 'click') {
      // Show text input when clicking with text tool
      console.log('DrawingOverlay: Clicked with text tool, showing text input');
      setTextInputPosition([x, y]);
      setShowTextInput(true);
      setTextInputValue('');
    } else if (activeTool === 'lasso') {
      console.log('DrawingOverlay: Received lasso interaction:', type, 'at coordinate:', [x, y]);

      switch (type) {
        case 'click':
          // Add point to lasso
          if (!isLassoDrawing) {
            setIsLassoDrawing(true);
          }
          setLassoPoints(prev => [...prev, [x, y] as [number, number]]);
          break;
        case 'dragStart':
          // Start lasso drawing
          if (!isLassoDrawing) {
            setIsLassoDrawing(true);
            setLassoPoints([[x, y] as [number, number]]);
          }
          break;
        case 'drag':
          // Update lasso with drag points for smooth drawing
          if (isLassoDrawing) {
            setLassoPoints(prev => [...prev, [x, y] as [number, number]]);
          }
          break;
        case 'dragEnd':
          // Finish lasso drawing
          if (isLassoDrawing) {
            setLassoPoints(currentPoints => {
              const finalPoints: [number, number][] = [...currentPoints, [x, y] as [number, number]];

              // Finalize the lasso as an annotation
              if (finalPoints.length >= 3) {
                finalizeLasso(finalPoints);
                setIsLassoDrawing(false);
                return []; // Clear points
              }
              return finalPoints; // Keep current points if not enough
            });
          }
          break;
      }
    } else if (activeTool === 'polyline') {
      console.log('DrawingOverlay: Received polyline interaction:', type, 'at coordinate:', [x, y]);

      if (type === 'click') {
        // Add point to polyline
        if (!isPolylineDrawing) {
          setIsPolylineDrawing(true);
          // Add first point twice on start
          setPolylinePoints([[x, y] as [number, number], [x, y] as [number, number]]);
          console.log('DrawingOverlay: Started polyline with point (duplicated):', [x, y]);
        } else {
          // Add additional points - add twice in the middle of the array
          setPolylinePoints(prev => {
            const middleIndex = Math.floor(prev.length / 2);
            const newPoint = [x, y] as [number, number];
            const newPoints = [...prev];
            newPoints.splice(middleIndex, 0, newPoint, newPoint);
            return newPoints;
          });
          console.log('DrawingOverlay: Added polyline segment point (duplicated in middle):', [x, y]);
        }
      } else if (type === 'dragStart') {
        // Start polyline drawing
        if (!isPolylineDrawing) {
          setIsPolylineDrawing(true);
          // Add first point twice on start (same as click)
          setPolylinePoints([[x, y] as [number, number], [x, y] as [number, number]]);
        }
      }
    }
  }, [currentInteraction, activeTool, isLassoDrawing, finalizeLasso, isPolylineDrawing, finalizePolyline]);

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

    // Rectangle tool: uses dragStart/dragEnd to create rectangle coordinates
    if (activeTool === 'rectangle' && isDrawing && dragStart && dragEnd) {
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
      console.log('DrawingOverlay: Rectangle polygon data:', polygonData);
    }
    // Lasso tool: uses lassoPoints array with auto-closing
    else if (activeTool === 'lasso' && isLassoDrawing && lassoPoints.length >= 3) {
      polygonData = [...lassoPoints, lassoPoints[0]]; // Close the polygon
      fillColor = [255, 165, 0, 50]; // Orange
      lineColor = [255, 165, 0, 255];
      console.log('DrawingOverlay: Lasso polygon data:', polygonData);
    }
    // Polyline tool: uses polylinePoints array without closing
    else if (activeTool === 'polyline' && isPolylineDrawing && polylinePoints.length >= 1) {
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
  }, [activeTool, isDrawing, dragStart, dragEnd, isLassoDrawing, lassoPoints, isPolylineDrawing, polylinePoints]);

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
    const layers: (PolygonLayer | TextLayer)[] = [];
    
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

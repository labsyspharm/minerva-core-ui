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
  const { drawingState, finalizeLasso, createTextAnnotation, globalColor } = useOverlayStore();
  const { isDrawing, dragStart, dragEnd } = drawingState;

  // Local state for lasso tool
  const [lassoPoints, setLassoPoints] = React.useState<[number, number][]>([]);
  const [isLassoDrawing, setIsLassoDrawing] = React.useState(false);

  // Local state for text tool
  const [showTextInput, setShowTextInput] = React.useState(false);
  const [textInputPosition, setTextInputPosition] = React.useState<[number, number] | null>(null);
  const [textInputValue, setTextInputValue] = React.useState('');
  const [textFontSize, setTextFontSize] = React.useState(14);


  // Handle tool changes - clear lasso state when switching tools
  React.useEffect(() => {
    if (activeTool !== 'lasso') {
      setLassoPoints([]);
      setIsLassoDrawing(false);
    }
  }, [activeTool]);

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
    }
  }, [currentInteraction, activeTool, isLassoDrawing, finalizeLasso]);

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

  // Create green rectangle overlay layer based on drawing state
  const greenRectangleLayer = React.useMemo(() => {
    if (activeTool !== 'rectangle') {
      return null;
    }

    console.log('DrawingOverlay: Creating green rectangle layer with state:', {
      isDrawing,
      dragStart,
      dragEnd
    });

    // Only show rectangle when actively drawing or when drawing is complete
    if (isDrawing && dragStart && dragEnd) {
      const [startX, startY] = dragStart;
      const [endX, endY] = dragEnd;

      // Ensure proper rectangle coordinates (start can be anywhere relative to end)
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);

      console.log('DrawingOverlay: Creating dynamic rectangle from', [minX, minY], 'to', [maxX, maxY]);

      return new PolygonLayer({
        id: 'green-rectangle',
        data: [{
          polygon: [
            [minX, minY],
            [maxX, minY],
            [maxX, maxY],
            [minX, maxY],
            [minX, minY], // Close the polygon
          ]
        }],
        getPolygon: d => d.polygon,
        getFillColor: [0, 255, 0, 50], // Green with low opacity
        getLineColor: [0, 255, 0, 255], // Solid green border
        getLineWidth: 3,
        stroked: true,
        filled: true,
      });
    }

    // No default rectangle - only show when drawing
    console.log('DrawingOverlay: No rectangle to show - waiting for user interaction');
    return null;
  }, [activeTool, isDrawing, dragStart, dragEnd]);

  // Create lasso polygon overlay layer
  const lassoLayer = React.useMemo(() => {
    if (activeTool !== 'lasso') {
      return null;
    }

    console.log('DrawingOverlay: Creating lasso layer with points:', lassoPoints);

    // Only show lasso when actively drawing or when drawing is complete
    if (isLassoDrawing && lassoPoints.length >= 3) {
      // Close the polygon by adding the first point at the end
      const closedPoints = [...lassoPoints, lassoPoints[0]];

      return new PolygonLayer({
        id: 'green-lasso',
        data: [{
          polygon: closedPoints
        }],
        getPolygon: d => d.polygon,
        getFillColor: [255, 165, 0, 50], // Orange with low opacity
        getLineColor: [255, 165, 0, 255], // Solid orange border
        getLineWidth: getLineWidthPx(),
        lineWidthScale: 1,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: getLineWidthPx(),
        lineWidthMaxPixels: getLineWidthPx(),
        stroked: true,
        filled: true,
      });
    }

    // No lasso to show - waiting for user interaction
    console.log('DrawingOverlay: No lasso to show - waiting for user interaction');
    return null;
  }, [activeTool, isLassoDrawing, lassoPoints]);

  // Create green line overlay layer based on drawing state
  const greenLineLayer = React.useMemo(() => {
    if (activeTool !== 'line') {
      return null;
    }

    console.log('DrawingOverlay: Creating green line layer with state:', {
      isDrawing,
      dragStart,
      dragEnd
    });

    // Only show line when actively drawing or when drawing is complete
    if (isDrawing && dragStart && dragEnd) {
      const [startX, startY] = dragStart;
      const [endX, endY] = dragEnd;

      console.log('DrawingOverlay: Creating dynamic line from', [startX, startY], 'to', [endX, endY]);

      // Convert line to polygon for consistent rendering
      const linePolygon = [
        [startX, startY],
        [endX, endY],
        [endX, endY],
        [startX, startY],
        [startX, startY] // Close the polygon
      ];

      return new PolygonLayer({
        id: 'green-line',
        data: [{
          polygon: linePolygon
        }],
        getPolygon: d => d.polygon,
        getFillColor: [0, 255, 255, 50], // Cyan with low opacity
        getLineColor: [0, 255, 255, 255], // Solid cyan border
        getLineWidth: getLineWidthPx(),
        lineWidthScale: 1,
        lineWidthUnits: 'pixels',
        lineWidthMinPixels: getLineWidthPx(),
        lineWidthMaxPixels: getLineWidthPx(),
        stroked: true,
        filled: true,
      });
    }

    // No default line - only show when drawing
    console.log('DrawingOverlay: No line to show - waiting for user interaction');
    return null;
  }, [activeTool, isDrawing, dragStart, dragEnd]);

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
          let fillColor: [number, number, number, number];
          
          if (annotation.type === 'rectangle' || annotation.type === 'polygon') {
            fillColor = [255, 255, 255, 1]; // Very low opacity white fill
          } else if (annotation.type === 'line') {
            fillColor = [0, 0, 0, 0]; // Lines don't have fill
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
    let layerToCreate = null;

    if (activeTool === 'rectangle' && greenRectangleLayer) {
      layerToCreate = greenRectangleLayer;
      console.log('DrawingOverlay: Notifying parent of green rectangle layer');
    } else if (activeTool === 'lasso' && lassoLayer) {
      layerToCreate = lassoLayer;
      console.log('DrawingOverlay: Notifying parent of lasso layer');
    } else if (activeTool === 'line' && greenLineLayer) {
      layerToCreate = greenLineLayer;
      console.log('DrawingOverlay: Notifying parent of green line layer');
    }

    if (layerToCreate) {
      onLayerCreate(layerToCreate);
    } else {
      // When no tool is active or no layer to show, notify parent to remove layers
      console.log('DrawingOverlay: Notifying parent to remove drawing layers');
      onLayerCreate(null);
    }
  }, [greenRectangleLayer, lassoLayer, greenLineLayer, activeTool, onLayerCreate]);

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

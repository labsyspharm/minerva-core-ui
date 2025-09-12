import * as React from "react";
import { PolygonLayer, TextLayer } from '@deck.gl/layers';
import { useOverlayStore, isPointInPolygon, textToPolygon } from "../../lib/stores";

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
  onInteraction?: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd' | 'hover', coordinate: [number, number, number]) => void;
  currentInteraction?: { type: 'click' | 'dragStart' | 'drag' | 'dragEnd' | 'hover', coordinate: [number, number, number] } | null;
}

const getLineWidthPx = () => 3; // always 3px

const DrawingOverlay: React.FC<DrawingOverlayProps> = ({ onLayerCreate, activeTool, currentInteraction }) => {
  // Use Zustand store for drawing state and drag state
  const { drawingState, dragState, hoverState, finalizeLasso, startDrag, updateDrag, endDrag, setHoveredAnnotation, createTextAnnotation, globalColor } = useOverlayStore();
  const { isDrawing, dragStart, dragEnd } = drawingState;

  // Local state for lasso tool
  const [lassoPoints, setLassoPoints] = React.useState<[number, number][]>([]);
  const [isLassoDrawing, setIsLassoDrawing] = React.useState(false);

  // Local state for text tool
  const [showTextInput, setShowTextInput] = React.useState(false);
  const [textInputPosition, setTextInputPosition] = React.useState<[number, number] | null>(null);
  const [textInputValue, setTextInputValue] = React.useState('');
  const [textFontSize, setTextFontSize] = React.useState(14);

  // Clear lasso state when tool changes
  React.useEffect(() => {
    setLassoPoints([]);
    setIsLassoDrawing(false);
  }, [activeTool]);

  // Note: Interaction handling is now managed by the Zustand store
  // The store automatically updates drawingState based on currentInteraction

  // Hit detection function for move tool
  const findAnnotationAtPoint = (point: [number, number]) => {
    const annotations = useOverlayStore.getState().annotations;
    const hiddenLayers = useOverlayStore.getState().hiddenLayers;
    
    console.log('DrawingOverlay: Checking hit detection at point:', point, 'with', annotations.length, 'annotations');
    
    // Check annotations in reverse order (top to bottom)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const annotation = annotations[i];
      
      // Skip hidden annotations
      if (hiddenLayers.has(annotation.id)) {
        continue;
      }
      
      let hit = false;
      
      if (annotation.type === 'text') {
        // For text annotations, use a larger hit detection area
        // Since TextLayer is pickable, we still need some hit detection logic
        const textPolygon = textToPolygon(annotation.position, annotation.text, annotation.style.fontSize, annotation.style.padding || 4);
        hit = isPointInPolygon(point, textPolygon);
        console.log('DrawingOverlay: Checking text annotation:', annotation.id, 'at position:', annotation.position, 'hit:', hit);
      } else {
        // All other annotations use polygon coordinates
        hit = isPointInPolygon(point, annotation.polygon);
        console.log('DrawingOverlay: Checking non-text annotation:', annotation.id, 'hit:', hit);
      }
      
      if (hit) {
        console.log('DrawingOverlay: Found hit annotation:', annotation.id);
        return annotation;
      }
    }
    
    console.log('DrawingOverlay: No annotation found at point:', point);
    return null;
  };

  // Handle move tool and text tool interactions (for moving existing annotations)
  React.useEffect(() => {
    if (currentInteraction && (activeTool === 'move' || activeTool === 'text')) {
      const { type, coordinate } = currentInteraction;
      const [x, y] = coordinate;

      console.log('DrawingOverlay: Received interaction:', type, 'at coordinate:', [x, y], 'with tool:', activeTool);

      switch (type) {
        case 'click':
        case 'dragStart':
          // Find annotation at click point
          const annotation = findAnnotationAtPoint([x, y]);
          if (annotation) {
            console.log('DrawingOverlay: Found annotation to drag:', annotation.id);
            
            // Calculate offset from annotation's reference point
            let offsetX = 0, offsetY = 0;
            
            if (annotation.type === 'text') {
              const [refX, refY] = annotation.position;
              offsetX = x - refX;
              offsetY = y - refY;
            } else {
              const [refX, refY] = annotation.polygon[0];
              offsetX = x - refX;
              offsetY = y - refY;
            }
            
            startDrag(annotation.id, [offsetX, offsetY]);
          }
          break;
        case 'drag':
          // Update drag position
          if (dragState.isDragging) {
            updateDrag(coordinate);
          }
          break;
        case 'dragEnd':
          // End drag
          if (dragState.isDragging) {
            endDrag();
          }
          break;
      }
    }
  }, [currentInteraction, activeTool, dragState.isDragging, startDrag, updateDrag, endDrag]);

  // Handle hover detection for move tool and text tool
  React.useEffect(() => {
    if ((activeTool === 'move' || activeTool === 'text') && currentInteraction) {
      const { type, coordinate } = currentInteraction;
      const [x, y] = coordinate;

      if (type === 'hover' || type === 'click' || type === 'dragStart') {
        // Find annotation at hover point
        const annotation = findAnnotationAtPoint([x, y]);
        if (annotation) {
          setHoveredAnnotation(annotation.id);
        } else {
          setHoveredAnnotation(null);
        }
      }
    }
  }, [currentInteraction, activeTool, setHoveredAnnotation]);

  // Handle lasso tool interactions
  React.useEffect(() => {
    if (currentInteraction && activeTool === 'lasso') {
      const { type, coordinate } = currentInteraction;
      const [x, y] = coordinate;

      console.log('DrawingOverlay: Received lasso interaction:', type, 'at coordinate:', [x, y]);

      switch (type) {
        case 'click':
          // Add point to lasso
          if (!isLassoDrawing) {
            setIsLassoDrawing(true);
          }
          setLassoPoints(prev => [...prev, [x, y] as [number, number]]);
          console.log('DrawingOverlay: Added lasso point:', [x, y]);
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
            // Keep the final point
            const finalPoints: [number, number][] = [...lassoPoints, [x, y] as [number, number]];
            setLassoPoints(finalPoints);
            console.log('DrawingOverlay: Finished lasso with points:', finalPoints);

            // Finalize the lasso as an annotation
            if (finalPoints.length >= 3) {
              finalizeLasso(finalPoints);
              setIsLassoDrawing(false);
              setLassoPoints([]);
            }
          }
          break;
      }
    }
  }, [currentInteraction, activeTool, isLassoDrawing, lassoPoints, finalizeLasso]);

  // Handle text tool interactions
  React.useEffect(() => {
    if (currentInteraction && activeTool === 'text') {
      const { type, coordinate } = currentInteraction;
      const [x, y] = coordinate;

      console.log('DrawingOverlay: Received text tool interaction:', type, 'at coordinate:', [x, y]);

      if (type === 'click') {
        // Check if clicking on an existing annotation
        const annotation = findAnnotationAtPoint([x, y]);
        
        if (annotation) {
          // If clicking on existing annotation, don't show text input
          // The drag logic above will handle moving the annotation
          console.log('DrawingOverlay: Clicked on existing annotation with text tool, not showing text input');
        } else {
          // Only show text input when clicking on empty space
          console.log('DrawingOverlay: Clicked on empty space with text tool, showing text input');
          setTextInputPosition([x, y]);
          setShowTextInput(true);
          setTextInputValue('');
        }
      }
    }
  }, [currentInteraction, activeTool]);

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
  // All annotations are now rendered as polygon layers with hover effects
  const annotationLayers = React.useMemo(() => {
    const layers: (PolygonLayer | TextLayer)[] = [];
    
    annotations
      .filter(annotation => !hiddenLayers.has(annotation.id)) // Filter out hidden annotations
      .forEach(annotation => {
        const isHovered = hoverState.hoveredAnnotationId === annotation.id;
        const isDragged = dragState.draggedAnnotationId === annotation.id;
        
        if (annotation.type === 'text') {
          // Create text layer for text annotations
          let fontColor: [number, number, number, number];
          let backgroundColor: [number, number, number, number];
          let fontSize = annotation.style.fontSize;
          
          if (isDragged) {
            // Dragged text - bright yellow
            fontColor = [255, 255, 0, 255];
            backgroundColor = [255, 255, 0, 50];
            fontSize = annotation.style.fontSize + 2;
          } else if (isHovered) {
            // Hovered text - bright cyan
            fontColor = [0, 255, 255, 255];
            backgroundColor = [0, 255, 255, 30];
            fontSize = annotation.style.fontSize + 1;
          } else {
            // Normal text - use annotation's style
            fontColor = annotation.style.fontColor;
            backgroundColor = annotation.style.backgroundColor || [0, 0, 0, 100];
          }
          
          layers.push(new TextLayer({
            id: `annotation-${annotation.id}`,
            data: [{
              text: annotation.text,
              position: [annotation.position[0], annotation.position[1], 0], // Add z coordinate
            }],
            getText: d => d.text,
            getPosition: d => d.position,
            getColor: fontColor,
            getBackgroundColor: backgroundColor,
            getSize: fontSize,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            padding:  4,
            // background: true,
            // backgroundPadding: [80, 80, 80, 80], // Increased padding for easier clicking
            pickable: true, // Make the text layer itself pickable
          }));
        } else {
          // Create polygon layer for other annotations
          let lineColor: [number, number, number, number];
          let fillColor: [number, number, number, number];
          let lineWidth = annotation.style.lineWidth;
          
          if (isDragged) {
            // Dragged annotation - bright yellow
            lineColor = [255, 255, 0, 255];
            fillColor = [255, 255, 0, 30];
            lineWidth = annotation.style.lineWidth + 2;
          } else if (isHovered) {
            // Hovered annotation - bright cyan
            lineColor = [0, 255, 255, 255];
            fillColor = [255, 255, 255, 1];
            lineWidth = annotation.style.lineWidth + 1;
          } else {
            // Normal annotation - use annotation's line color but very low opacity white fill
            if (annotation.type === 'rectangle' || annotation.type === 'polygon') {
              lineColor = annotation.style.lineColor;
              fillColor = [255, 255, 255, 1]; // Very low opacity white fill
            } else if (annotation.type === 'line') {
              lineColor = annotation.style.lineColor;
              fillColor = [0, 0, 0, 0]; // Lines don't have fill
            }
          }
          
          layers.push(new PolygonLayer({
            id: `annotation-${annotation.id}`,
            data: [{
              polygon: annotation.polygon
            }],
            getPolygon: d => d.polygon,
            getFillColor: fillColor,
            getLineColor: lineColor,
            getLineWidth: lineWidth,
            lineWidthScale: 1,
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: lineWidth,
            lineWidthMaxPixels: lineWidth,
            stroked: true,
            filled: true,
          }));
        }
      });
    
    return layers;
  }, [annotations, hiddenLayers, hoverState.hoveredAnnotationId, dragState.draggedAnnotationId]);

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

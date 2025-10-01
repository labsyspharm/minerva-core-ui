import * as React from "react";
import { ChromePicker } from 'react-color';
import { DrawingOverlay } from "./DrawingOverlay";
import { LayersPanel } from "./LayersPanel";
import styles from "./index.module.css";
import { MoveIcon, RectangleIcon, LassoIcon, LineIcon, PolylineIcon, TextIcon, ColorIcon } from "./icons";
import { useOverlayStore } from "../../lib/stores";

// Types
import type { Group } from "../../lib/exhibit";
import type { HashContext } from "../../lib/hashUtil";

export type Props = HashContext & {
  groups: Group[];
  onLayerCreate?: (layer: any) => void;
  currentInteraction?: { type: 'click' | 'dragStart' | 'drag' | 'dragEnd' | 'hover', coordinate: [number, number, number] } | null;
};

// Define available tools
const TOOLS = {
  MOVE: 'move',
  RECTANGLE: 'rectangle',
  LASSO: 'lasso',
  LINE: 'line',
  POLYLINE: 'polyline',
  TEXT: 'text'
} as const;

type ToolType = typeof TOOLS[keyof typeof TOOLS];

const Overlays = (props: Props) => {
  const { hash, onLayerCreate, currentInteraction } = props;
  const group = props.groups[hash.g];
  
  // Use Zustand store for tool management
  const { activeTool, handleToolChange, globalColor, setGlobalColor, updateAnnotation, updateTextAnnotationColor } = useOverlayStore();

  // Local state for color picker
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [currentColor, setCurrentColor] = React.useState({ r: 255, g: 255, b: 255, a: 1 });
  const [editingAnnotationId, setEditingAnnotationId] = React.useState<string | null>(null);

  const handleToolChangeLocal = (tool: ToolType) => {
    handleToolChange(tool);
  };

  const handleColorPickerOpen = () => {
    // Convert global color to ChromePicker format
    const color = {
      r: globalColor[0],
      g: globalColor[1],
      b: globalColor[2],
      a: globalColor[3] / 255
    };
    setCurrentColor(color);
    setShowColorPicker(true);
  };

  const handleColorChange = (color: any) => {
    setCurrentColor(color.rgb);
  };

  const handleColorChangeComplete = () => {
    const newColor: [number, number, number, number] = [
      Math.round(currentColor.r),
      Math.round(currentColor.g),
      Math.round(currentColor.b),
      Math.round(currentColor.a * 255)
    ];
    
    // Always update global color to the selected color
    setGlobalColor(newColor);
    
    if (editingAnnotationId) {
      // Also update specific annotation color
      const annotations = useOverlayStore.getState().annotations;
      const annotation = annotations.find(a => a.id === editingAnnotationId);
      
      if (annotation) {
        if (annotation.type === 'text') {
          updateTextAnnotationColor(editingAnnotationId, newColor);
        } else if (annotation.type === 'rectangle' || annotation.type === 'polygon' || annotation.type === 'line' || annotation.type === 'polyline') {
          updateAnnotation(editingAnnotationId, {
            style: {
              ...annotation.style,
              lineColor: newColor
            }
          });
        }
      }
      setEditingAnnotationId(null);
    }
    
    setShowColorPicker(false);
  };

  const handleColorPickerCancel = () => {
    setShowColorPicker(false);
    setEditingAnnotationId(null);
  };

  const handleOpenAnnotationColorPicker = (annotationId: string, currentColor: [number, number, number, number]) => {
    setEditingAnnotationId(annotationId);
    setCurrentColor({
      r: currentColor[0],
      g: currentColor[1],
      b: currentColor[2],
      a: currentColor[3] / 255
    });
    setShowColorPicker(true);
  };

  // Calculate icon color based on background color brightness
  const getIconColor = (bgColor: [number, number, number, number]) => {
    // Calculate luminance using relative luminance formula
    const [r, g, b] = bgColor;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // If luminance is high (light color), use black icon, otherwise use white icon
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  const className = [
    styles.center, styles.black
  ].join(" ");
  
  return (
    <div slot="overlays" className={className}>
      {/* Toolbar with drawing tools - positioned above layers */}
      <div className={styles.toolbar}>
        <button 
          className={`${styles.toolButton} ${activeTool === TOOLS.MOVE ? styles.active : ''}`}
          title="Move Tool"
          onClick={() => handleToolChangeLocal(TOOLS.MOVE)}
        >
          <MoveIcon />
        </button>
        
        <button 
          className={`${styles.toolButton} ${activeTool === TOOLS.RECTANGLE ? styles.active : ''}`}
          title="Rectangle Tool (R)"
          onClick={() => handleToolChangeLocal(TOOLS.RECTANGLE)}
        >
          <RectangleIcon />
        </button>
        
        <button 
          className={`${styles.toolButton} ${activeTool === TOOLS.LASSO ? styles.active : ''}`}
          title="Lasso Tool (L)"
          onClick={() => handleToolChangeLocal(TOOLS.LASSO)}
        >
          <LassoIcon />
        </button>
        
        <button 
          className={`${styles.toolButton} ${activeTool === TOOLS.LINE ? styles.active : ''}`}
          title="Line Tool"
          onClick={() => handleToolChangeLocal(TOOLS.LINE)}
        >
          <LineIcon />
        </button>
        
        <button 
          className={`${styles.toolButton} ${activeTool === TOOLS.POLYLINE ? styles.active : ''}`}
          title="Poly-line Tool"
          onClick={() => handleToolChangeLocal(TOOLS.POLYLINE)}
        >
          <PolylineIcon />
        </button>
        
        <button 
          className={`${styles.toolButton} ${activeTool === TOOLS.TEXT ? styles.active : ''}`}
          title="Text Tool"
          onClick={() => handleToolChangeLocal(TOOLS.TEXT)}
        >
          <TextIcon />
        </button>
        
        <button 
          className={styles.toolButton}
          title="Color Picker"
          onClick={handleColorPickerOpen}
          style={{
            backgroundColor: `rgba(${globalColor[0]}, ${globalColor[1]}, ${globalColor[2]}, ${globalColor[3] / 255})`,
            border: '2px solid #333',
            borderRadius: '4px',
            color: getIconColor(globalColor),
          }}
        >
          <ColorIcon />
        </button>
      </div>
      
      {/* Layers Panel - Photoshop style - positioned below toolbar */}
      <LayersPanel onOpenAnnotationColorPicker={handleOpenAnnotationColorPicker} />
      
      {/* Drawing overlay component */}
      {onLayerCreate && (
        <DrawingOverlay onLayerCreate={onLayerCreate} activeTool={activeTool} currentInteraction={currentInteraction} />
      )}
      
      {/* Color Picker Modal */}
      {showColorPicker && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            position: 'relative',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '15px',
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                {editingAnnotationId ? 'Change Annotation Color' : 'Choose Drawing Color'}
              </h3>
              <button
                onClick={handleColorPickerCancel}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#666',
                }}
                title="Close"
              >
                ×
              </button>
            </div>
            
            <ChromePicker
              color={currentColor}
              onChange={handleColorChange}
            />
            
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              marginTop: '15px',
            }}>
              <button
                onClick={handleColorChangeComplete}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Apply Color
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { Overlays };
export type { ToolType };
export { TOOLS };

import * as React from "react";
import { ChromePicker } from "react-color";
import { LayersPanel } from "@/components/authoring/LayersPanel";
import { useOverlayStore } from "@/lib/stores";
import type { ConfigWaypoint } from "@/lib/config";
import {
  MoveIcon,
  RectangleIcon,
  EllipseIcon,
  LassoIcon,
  PolygonIcon,
  LineIcon,
  PolylineIcon,
  TextIcon,
  PointIcon,
  ColorIcon,
} from "@/components/shared/icons/OverlayIcons";
import styles from "./WaypointAnnotationEditor.module.css";

// Define available tools (same as overlays)
const TOOLS = {
  MOVE: "move",
  RECTANGLE: "rectangle",
  ELLIPSE: "ellipse",
  LASSO: "lasso",
  LINE: "line",
  POLYLINE: "polyline",
  TEXT: "text",
  POINT: "point",
} as const;

type ToolType = (typeof TOOLS)[keyof typeof TOOLS];

export interface WaypointAnnotationEditorProps {
  story: ConfigWaypoint;
  storyIndex: number;
}

const WaypointAnnotationEditor: React.FC<WaypointAnnotationEditorProps> = ({
  story,
  storyIndex,
}) => {
  const {
    overlayLayers,
    activeTool,
    currentInteraction,
    dragState,
    hoverState,
    handleLayerCreate,
    handleToolChange,
    handleOverlayInteraction,
    globalColor,
    setGlobalColor,
    updateAnnotation,
    updateTextAnnotationColor,
  } = useOverlayStore();

  // Local state for color picker
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [currentColor, setCurrentColor] = React.useState({
    r: 255,
    g: 255,
    b: 255,
    a: 1,
  });
  const [editingAnnotationId, setEditingAnnotationId] = React.useState<
    string | null
  >(null);

  const handleToolChangeLocal = (tool: ToolType) => {
    handleToolChange(tool);
  };

  const handleColorPickerOpen = () => {
    // Convert global color to ChromePicker format
    setCurrentColor({
      r: globalColor[0],
      g: globalColor[1],
      b: globalColor[2],
      a: globalColor[3] / 255,
    });
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
      Math.round(currentColor.a * 255),
    ];

    setGlobalColor(newColor);

    // If we're editing a specific annotation, update it
    if (editingAnnotationId) {
      updateAnnotation(editingAnnotationId, { color: newColor } as any);
      updateTextAnnotationColor(editingAnnotationId, newColor);
      setEditingAnnotationId(null);
    }

    setShowColorPicker(false);
  };

  const handleColorPickerCancel = () => {
    setShowColorPicker(false);
    setEditingAnnotationId(null);
  };

  const handleOpenAnnotationColorPicker = (
    annotationId: string,
    currentColor: [number, number, number, number],
  ) => {
    setEditingAnnotationId(annotationId);
    setCurrentColor({
      r: currentColor[0],
      g: currentColor[1],
      b: currentColor[2],
      a: currentColor[3] / 255,
    });
    setShowColorPicker(true);
  };

  // Calculate icon color based on background color brightness
  const getIconColor = (bgColor: [number, number, number, number]) => {
    // Calculate luminance using relative luminance formula
    const [r, g, b] = bgColor;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // If luminance is high (light color), use black icon, otherwise use white icon
    return luminance > 0.5 ? "#000000" : "#ffffff";
  };

  return (
    <div className={styles.annotationsPanel}>
      <div className={styles.annotationsPanelContent}>
        {/* Toolbar with drawing tools - same as main overlays */}
        <div className={styles.toolbar}>
          <button
            type="button"
            className={`${styles.toolButton} ${activeTool === TOOLS.MOVE ? styles.active : ""}`}
            title="Move Tool"
            onClick={() => handleToolChangeLocal(TOOLS.MOVE)}
          >
            <MoveIcon />
          </button>

          <button
            type="button"
            className={`${styles.toolButton} ${activeTool === TOOLS.RECTANGLE ? styles.active : ""}`}
            title="Rectangle Tool (R)"
            onClick={() => handleToolChangeLocal(TOOLS.RECTANGLE)}
          >
            <RectangleIcon />
          </button>

          <button
            type="button"
            className={`${styles.toolButton} ${activeTool === TOOLS.ELLIPSE ? styles.active : ""}`}
            title="Ellipse Tool (E)"
            onClick={() => handleToolChangeLocal(TOOLS.ELLIPSE)}
          >
            <EllipseIcon />
          </button>

          <button
            type="button"
            className={`${styles.toolButton} ${activeTool === TOOLS.LASSO ? styles.active : ""}`}
            title="Lasso Tool (L)"
            onClick={() => handleToolChangeLocal(TOOLS.LASSO)}
          >
            <PolygonIcon />
          </button>

          <button
            type="button"
            className={`${styles.toolButton} ${activeTool === TOOLS.LINE ? styles.active : ""}`}
            title="Line Tool"
            onClick={() => handleToolChangeLocal(TOOLS.LINE)}
          >
            <LineIcon />
          </button>

          <button
            type="button"
            className={`${styles.toolButton} ${activeTool === TOOLS.POLYLINE ? styles.active : ""}`}
            title="Poly-line Tool"
            onClick={() => handleToolChangeLocal(TOOLS.POLYLINE)}
          >
            <PolylineIcon />
          </button>

          <button
            type="button"
            className={`${styles.toolButton} ${activeTool === TOOLS.TEXT ? styles.active : ""}`}
            title="Text Tool"
            onClick={() => handleToolChangeLocal(TOOLS.TEXT)}
          >
            <TextIcon />
          </button>

          <button
            type="button"
            className={`${styles.toolButton} ${activeTool === TOOLS.POINT ? styles.active : ""}`}
            title="Point Tool"
            onClick={() => handleToolChangeLocal(TOOLS.POINT)}
          >
            <PointIcon />
          </button>

          <button
            type="button"
            className={styles.toolButton}
            title="Color Picker"
            onClick={handleColorPickerOpen}
            style={{
              backgroundColor: `rgba(${globalColor[0]}, ${globalColor[1]}, ${globalColor[2]}, ${globalColor[3] / 255})`,
              border: "2px solid #333",
              borderRadius: "4px",
              color: getIconColor(globalColor),
            }}
          >
            <ColorIcon />
          </button>
        </div>

        {/* Layers Panel */}
        <div className={styles.layersContainer}>
          <LayersPanel
            onOpenAnnotationColorPicker={handleOpenAnnotationColorPicker}
          />
        </div>
      </div>

      {/* Color Picker Modal */}
      {showColorPicker && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "10px 20px",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>
                {editingAnnotationId
                  ? "Change Annotation Color"
                  : "Choose Drawing Color"}
              </h3>
              <button
                type="button"
                onClick={handleColorPickerCancel}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "18px",
                  cursor: "pointer",
                  color: "#666",
                }}
                title="Close"
              >
                ×
              </button>
            </div>

            <ChromePicker color={currentColor} onChange={handleColorChange} />

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "10px",
                marginTop: "15px",
              }}
            >
              <button
                type="button"
                onClick={handleColorChangeComplete}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  borderRadius: "4px",
                  cursor: "pointer",
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

export { WaypointAnnotationEditor };

import * as React from "react";
import { ChromePicker } from "react-color";
import { DrawingOverlay } from "@/components/shared/viewer/layers/DrawingOverlay";
import { LayersPanel } from "@/components/authoring/LayersPanel";
import styles from "./DrawingPanel.module.css";
import {
  MoveIcon,
  RectangleIcon,
  EllipseIcon,
  PolygonIcon,
  LineIcon,
  PolylineIcon,
  ArrowIcon,
  ShapesIcon,
  LinesIcon,
  TextIcon,
  PointIcon,
  ColorIcon,
  MagicWandIcon,
} from "@/components/shared/icons/OverlayIcons";
import { ToolSubmenu } from "@/components/authoring/ToolSubmenu";
import { useOverlayStore } from "@/lib/stores";

// Types
import type { Group } from "@/lib/exhibit";

type DrawingPanelProps = {
  groups: Group[];
  onLayerCreate?: (layer: any) => void;
  currentInteraction?: {
    type: "click" | "dragStart" | "drag" | "dragEnd" | "hover";
    coordinate: [number, number, number];
  } | null;
};

// Define available tools
const TOOLS = {
  MOVE: "move",
  RECTANGLE: "rectangle",
  ELLIPSE: "ellipse",
  LASSO: "lasso",
  ARROW: "arrow",
  LINE: "line",
  POLYLINE: "polyline",
  TEXT: "text",
  POINT: "point",
  MAGIC_WAND: "magic_wand",
} as const;

type ToolType = (typeof TOOLS)[keyof typeof TOOLS];

const DrawingPanel = (props: DrawingPanelProps) => {
  const { onLayerCreate, currentInteraction } = props;

  // Use Zustand store for tool management
  const {
    activeTool,
    handleToolChange,
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
    const color = {
      r: globalColor[0],
      g: globalColor[1],
      b: globalColor[2],
      a: globalColor[3] / 255,
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
      Math.round(currentColor.a * 255),
    ];

    // Always update global color to the selected color
    setGlobalColor(newColor);

    if (editingAnnotationId) {
      // Also update specific annotation color
      const annotations = useOverlayStore.getState().annotations;
      const annotation = annotations.find((a) => a.id === editingAnnotationId);

      if (annotation) {
        if (annotation.type === "text") {
          updateTextAnnotationColor(editingAnnotationId, newColor);
        } else if (
          annotation.type === "rectangle" ||
          annotation.type === "ellipse" ||
          annotation.type === "polygon" ||
          annotation.type === "line" ||
          annotation.type === "polyline"
        ) {
          updateAnnotation(editingAnnotationId, {
            style: {
              ...annotation.style,
              lineColor: newColor,
            },
          });
        } else if (annotation.type === "point") {
          updateAnnotation(editingAnnotationId, {
            style: {
              ...annotation.style,
              fillColor: newColor,
            },
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

  const className = [styles.center, styles.black].join(" ");

  return (
    <div slot="overlays" className={className}>
      {/* Toolbar with drawing tools - positioned above layers */}
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${styles.toolButton} ${activeTool === TOOLS.MOVE ? styles.active : ""}`}
          title="Move Tool"
          onClick={() => handleToolChangeLocal(TOOLS.MOVE)}
        >
          <MoveIcon />
        </button>

        <ToolSubmenu
          items={[
            { id: TOOLS.RECTANGLE, icon: <RectangleIcon />, title: "Rectangle" },
            { id: TOOLS.ELLIPSE, icon: <EllipseIcon />, title: "Ellipse" },
            { id: TOOLS.LASSO, icon: <PolygonIcon />, title: "Lasso Polygon" },
          ]}
          activeTool={activeTool}
          onToolChange={handleToolChangeLocal}
          parentIcon={<ShapesIcon />}
          parentTitle="Shapes"
          buttonClassName={styles.toolButton}
          activeClassName={styles.active}
        />

        <ToolSubmenu
          items={[
            { id: TOOLS.ARROW, icon: <ArrowIcon />, title: "Arrow" },
            { id: TOOLS.LINE, icon: <LineIcon />, title: "Line" },
            { id: TOOLS.POLYLINE, icon: <PolylineIcon />, title: "Polyline" },
          ]}
          activeTool={activeTool}
          onToolChange={handleToolChangeLocal}
          parentIcon={<LinesIcon />}
          parentTitle="Lines"
          buttonClassName={styles.toolButton}
          activeClassName={styles.active}
        />

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
          className={`${styles.toolButton} ${activeTool === TOOLS.MAGIC_WAND ? styles.active : ""}`}
          title="Magic Wand (SAM2)"
          onClick={() => handleToolChangeLocal(TOOLS.MAGIC_WAND)}
        >
          <MagicWandIcon />
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

      {/* Layers Panel - Photoshop style - positioned below toolbar */}
      <LayersPanel
        onOpenAnnotationColorPicker={handleOpenAnnotationColorPicker}
      />

      {/* Drawing overlay component */}
      {onLayerCreate && (
        <DrawingOverlay
          onLayerCreate={onLayerCreate}
          activeTool={activeTool}
          currentInteraction={currentInteraction}
        />
      )}

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
                onClick={handleColorPickerCancel}
                type="button"
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
                onClick={handleColorChangeComplete}
                type="button"
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

export { DrawingPanel };
export type { DrawingPanelProps, ToolType };
export { TOOLS };

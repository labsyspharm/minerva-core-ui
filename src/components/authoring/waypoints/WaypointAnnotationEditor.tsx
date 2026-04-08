import { rgbaToHsva } from "@uiw/react-color";
import * as React from "react";
import { LayersPanel } from "@/components/authoring/LayersPanel";
import { ToolSubmenu } from "@/components/authoring/ToolSubmenu";
import {
  ChromeColorPickerPopover,
  chromeColorPickerAnchorPosition,
} from "@/components/shared/ChromeColorPickerPopover";
import ArrowIcon from "@/components/shared/icons/arrow-tool.svg?react";
import BrushIcon from "@/components/shared/icons/brush.svg?react";
import CopyAnnotationsIcon from "@/components/shared/icons/copy-annotations.svg?react";
import EllipseIcon from "@/components/shared/icons/ellipse.svg?react";
import LineIcon from "@/components/shared/icons/line.svg?react";
import LinesIcon from "@/components/shared/icons/lines.svg?react";
import MagicWandIcon from "@/components/shared/icons/magic-wand.svg?react";
import MoveIcon from "@/components/shared/icons/move.svg?react";
import PasteAnnotationsIcon from "@/components/shared/icons/paste-annotations.svg?react";
import PointIcon from "@/components/shared/icons/point.svg?react";
import PolygonIcon from "@/components/shared/icons/polygon.svg?react";
import PolylineIcon from "@/components/shared/icons/polyline.svg?react";
import RectangleIcon from "@/components/shared/icons/rectangle.svg?react";
import ShapesIcon from "@/components/shared/icons/shapes.svg?react";
import TextIcon from "@/components/shared/icons/text.svg?react";
import { DrawingOverlay } from "@/components/shared/viewer/layers/DrawingOverlay";
import type { Shape } from "@/lib/shapes/shapeModel";
import {
  copySelectedWaypointShapes,
  pasteWaypointShapesFromClipboard,
} from "@/lib/shapes/waypointShapeClipboard";
import { useAppStore } from "@/lib/stores/app-store";
import type { StoreStoryWaypoint } from "@/lib/story/storyDocument";
import styles from "./WaypointAnnotationEditor.module.css";

/** Writes rgba into the fields the renderer reads (`style.*`). */
function applyWaypointPickerColor(
  annotationId: string,
  newColor: [number, number, number, number],
) {
  const { shapes, updateShape } = useAppStore.getState();
  const ann = shapes.find((a) => a.id === annotationId);
  if (!ann) return;

  if (ann.type === "polygon" || ann.type === "line") {
    const fillA = ann.style.fillColor[3];
    updateShape(annotationId, {
      style: {
        ...ann.style,
        lineColor: newColor,
        fillColor: [newColor[0], newColor[1], newColor[2], fillA],
      },
    } as Partial<Shape>);
    return;
  }
  if (ann.type === "polyline") {
    updateShape(annotationId, {
      style: {
        ...ann.style,
        lineColor: newColor,
      },
    } as Partial<Shape>);
    return;
  }
  if (ann.type === "point") {
    updateShape(annotationId, {
      style: {
        ...ann.style,
        fillColor: newColor,
        strokeColor: newColor,
      },
    } as Partial<Shape>);
  }
}

// Define available tools (same as overlays)
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
  BRUSH: "brush",
} as const;

export interface WaypointAnnotationEditorProps {
  story: StoreStoryWaypoint;
  storyIndex: number;
  /** When true, do not cap height or add inner scroll — parent scrolls */
  embeddedInScrollParent?: boolean;
}

const WaypointAnnotationEditor: React.FC<WaypointAnnotationEditorProps> = ({
  embeddedInScrollParent,
  storyIndex,
}) => {
  const {
    activeTool,
    handleToolChange,
    globalColor,
    setGlobalColor,
    layersPanelSelectedShapeIds,
    handleLayerCreate,
    currentInteraction,
    setAuthoringWaypointShapesIndex,
  } = useAppStore();

  // Master-detail sets authoring from WaypointsListMasterDetail so collapsed
  // Annotations panel does not clear the persist target while drawing.
  React.useEffect(() => {
    if (embeddedInScrollParent) return;
    if (storyIndex < 0) return;
    setAuthoringWaypointShapesIndex(storyIndex);
    return () => setAuthoringWaypointShapesIndex(null);
  }, [embeddedInScrollParent, storyIndex, setAuthoringWaypointShapesIndex]);

  const [colorPickerPos, setColorPickerPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [pickerHsva, setPickerHsva] = React.useState(() =>
    rgbaToHsva({ r: 255, g: 255, b: 255, a: 1 }),
  );
  const colorPickerTargetIdRef = React.useRef<string | null>(null);

  const closeColorPicker = React.useCallback(() => {
    colorPickerTargetIdRef.current = null;
    setColorPickerPos(null);
  }, []);

  const handleColorPickerOpen = (anchor: DOMRect) => {
    colorPickerTargetIdRef.current = null;
    setPickerHsva(
      rgbaToHsva({
        r: globalColor[0],
        g: globalColor[1],
        b: globalColor[2],
        a: globalColor[3] / 255,
      }),
    );
    setColorPickerPos(chromeColorPickerAnchorPosition(anchor));
  };

  const handleOpenAnnotationColorPicker = (
    annotationId: string,
    rgba: [number, number, number, number],
    anchor: DOMRect,
  ) => {
    colorPickerTargetIdRef.current = annotationId;
    setPickerHsva(
      rgbaToHsva({
        r: rgba[0],
        g: rgba[1],
        b: rgba[2],
        a: rgba[3] / 255,
      }),
    );
    setColorPickerPos(chromeColorPickerAnchorPosition(anchor));
  };

  const waypointClipboardActions = (
    <>
      <button
        type="button"
        className={styles.toolButton}
        disabled={layersPanelSelectedShapeIds.length === 0}
        title="Copy selected shapes to the clipboard"
        onClick={() => void copySelectedWaypointShapes()}
      >
        <CopyAnnotationsIcon />
      </button>
      <button
        type="button"
        className={styles.toolButton}
        title="Paste shapes from the clipboard"
        onClick={() => void pasteWaypointShapesFromClipboard()}
      >
        <PasteAnnotationsIcon />
      </button>
    </>
  );

  const handleToolChangeLocal = (tool: string) => {
    handleToolChange(tool);
  };

  const drawingToolbar = (
    <>
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
          {
            id: TOOLS.RECTANGLE,
            icon: <RectangleIcon />,
            title: "Rectangle",
          },
          { id: TOOLS.ELLIPSE, icon: <EllipseIcon />, title: "Ellipse" },
          {
            id: TOOLS.LASSO,
            icon: <PolygonIcon />,
            title: "Lasso Polygon",
          },
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
        className={`${styles.toolButton} ${activeTool === TOOLS.BRUSH ? styles.active : ""}`}
        title="Brush"
        onClick={() => handleToolChangeLocal(TOOLS.BRUSH)}
      >
        <BrushIcon />
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
        className={`${styles.toolButton} ${activeTool === TOOLS.MAGIC_WAND ? styles.active : ""}`}
        title="Magic Wand"
        onClick={() => handleToolChangeLocal(TOOLS.MAGIC_WAND)}
      >
        <MagicWandIcon />
      </button>
    </>
  );

  return (
    <div
      className={
        embeddedInScrollParent
          ? `${styles.annotationsPanel} ${styles.annotationsPanelEmbedded}`
          : styles.annotationsPanel
      }
    >
      <div className={styles.annotationsPanelContent}>
        <div className={styles.layersContainer}>
          <LayersPanel
            itemListVariant={
              embeddedInScrollParent ? "markdownEditorChrome" : "default"
            }
            toolbarSlot={drawingToolbar}
            waypointClipboardActions={waypointClipboardActions}
            onOpenGlobalColorPicker={handleColorPickerOpen}
            onOpenAnnotationColorPicker={handleOpenAnnotationColorPicker}
          />
        </div>
        {embeddedInScrollParent ? (
          <DrawingOverlay
            onLayerCreate={handleLayerCreate}
            activeTool={activeTool}
            currentInteraction={currentInteraction}
          />
        ) : null}
      </div>

      <ChromeColorPickerPopover
        position={colorPickerPos}
        onClose={closeColorPicker}
        color={pickerHsva}
        showAlpha
        onChange={(c) => {
          setPickerHsva(c.hsva);
          const { r, g, b, a } = c.rgba;
          const newColor: [number, number, number, number] = [
            Math.round(r),
            Math.round(g),
            Math.round(b),
            Math.round(a * 255),
          ];
          const targetId = colorPickerTargetIdRef.current;
          if (targetId) {
            applyWaypointPickerColor(targetId, newColor);
          } else {
            setGlobalColor(newColor);
          }
        }}
      />
    </div>
  );
};

export { WaypointAnnotationEditor };

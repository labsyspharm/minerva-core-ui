// Drag handlers for Deck.gl interactions
// These handlers translate Deck.gl events into interaction events for the overlay system

import { useOverlayStore } from "./stores";

type InteractionType = "click" | "dragStart" | "drag" | "dragEnd" | "hover";
type InteractionCallback = (
  type: InteractionType,
  coordinate: number[],
) => void;

// Compatible with Deck.gl PickingInfo
type PickInfo = {
  coordinate?: number[] | [number, number, number];
  layer?: {
    id: string;
  };
  object?: { id?: string };
  x?: number;
  y?: number;
  z?: number;
};

/** (worldX, worldY) -> [screenX, screenY] in canvas pixels; used for brush. */
export type WorldToScreen = (worldX: number, worldY: number) => [number, number] | undefined;

export const createDragHandlers = (
  activeTool: string,
  onInteraction?: InteractionCallback,
  getScreenFromWorld?: WorldToScreen,
) => {
  if (!onInteraction) {
    return {
      onClick: undefined,
      onDragStart: undefined,
      onDrag: undefined,
      onDragEnd: undefined,
      onHover: undefined,
    };
  }

  const emit = (
    type: InteractionType,
    coordinate?: number[],
  ) => {
    if (coordinate) {
      onInteraction(type, coordinate);
    }
  };

  // Use only coordinate (world space). Never use x,y - those are screen pixels.
  const toCoord = (info: PickInfo): [number, number, number] | undefined => {
    const c = info.coordinate;
    if (c && c.length >= 2) {
      return [c[0], c[1], c[2] ?? 0];
    }
    return undefined;
  };

  const store = useOverlayStore.getState;

  return {
    onClick: (info: PickInfo) => {
      const coord = toCoord(info);
      if (coord) emit("click", coord);
    },

    onDragStart: (info: PickInfo) => {
      const coord = toCoord(info);
      if (coord && activeTool === "brush" && getScreenFromWorld) {
        const screen = getScreenFromWorld(coord[0], coord[1]);
        if (screen) store().brushPaintStart(screen);
      }
      if (coord) emit("dragStart", coord);
    },

    onDrag: (info: PickInfo) => {
      const coord = toCoord(info);
      if (coord && activeTool === "brush" && getScreenFromWorld) {
        const screen = getScreenFromWorld(coord[0], coord[1]);
        if (screen) store().brushPaint(screen);
      }
      if (coord) emit("drag", coord);
    },

    onDragEnd: (info: PickInfo) => {
      const coord = toCoord(info);
      if (activeTool === "brush") store().brushPaintEnd();
      if (coord) emit("dragEnd", coord);
    },

    // Hover events (for tools that need hover feedback)
    onHover: (info: PickInfo) => {
      // Deck.gl hover events can have coordinate as an array or as x, y, z properties
      const coordinate = toCoord(info) ?? null;
      const layer = info.layer;
      const object = info.object;

      // Detect if hovering over an annotation (only for move tool)
      if (activeTool === "move") {
        if (layer?.id?.startsWith("annotation-") && object?.id) {
          // Use the picked object's id; strip -arrow or -text suffix for sub-layers
          let annotationId = object.id;
          if (annotationId.endsWith("-arrow")) {
            annotationId = annotationId.replace("-arrow", "");
          } else if (annotationId.endsWith("-text")) {
            annotationId = annotationId.replace("-text", "");
          }
          useOverlayStore.getState().setHoveredAnnotation(annotationId);
        } else {
          useOverlayStore.getState().setHoveredAnnotation(null);
        }
      } else {
        useOverlayStore.getState().setHoveredAnnotation(null);
      }

      // Emit hover coordinate for drawing tools
      if (
        activeTool === "move" ||
        activeTool === "text" ||
        activeTool === "polyline" ||
        activeTool === "rectangle" ||
        activeTool === "ellipse" ||
        activeTool === "arrow" ||
        activeTool === "line" ||
        activeTool === "lasso" ||
        activeTool === "magic_wand" ||
        activeTool === "brush"
      ) {
        if (coordinate) {
          emit("hover", coordinate);
        }
      }
    },
  };
};

// Drag handlers for Deck.gl interactions
// These handlers translate Deck.gl events into interaction events for the overlay system

import { useOverlayStore } from "./stores";

type InteractionType = "click" | "dragStart" | "drag" | "dragEnd" | "hover";
type InteractionCallback = (
  type: InteractionType,
  coordinate: [number, number, number],
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
}

export const createDragHandlers = (
  activeTool: string,
  onInteraction?: InteractionCallback,
) => {
  // Early return if no interaction callback provided
  if (!onInteraction) {
    return {
      onClick: undefined,
      onDragStart: undefined,
      onDrag: undefined,
      onDragEnd: undefined,
      onHover: undefined,
    };
  }

  // Helper to emit interaction if coordinate exists
  const emit = (
    type: InteractionType,
    coordinate?: [number, number, number],
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

  return {
    // Single click without dragging (used for text, polyline, lasso point-by-point)
    onClick: (info: PickInfo) => {
      const coord = toCoord(info);
      if (coord) emit("click", coord);
    },

    // Start of drag operation (used for rectangle, line, lasso freehand)
    onDragStart: (info: PickInfo) => {
      const coord = toCoord(info);
      if (coord) emit("dragStart", coord);
    },

    // During drag operation (used for rectangle, line, lasso freehand)
    onDrag: (info: PickInfo) => {
      const coord = toCoord(info);
      if (coord) emit("drag", coord);
    },

    // End of drag operation (used for rectangle, line, lasso freehand)
    onDragEnd: (info: PickInfo) => {
      const coord = toCoord(info);
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

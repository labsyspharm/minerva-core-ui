// Drag handlers for Deck.gl interactions
// These handlers translate Deck.gl events into interaction events for the overlay system

import { useOverlayStore } from "./stores";

type InteractionType = "click" | "dragStart" | "drag" | "dragEnd" | "hover";
type InteractionCallback = (
  type: InteractionType,
  coordinate: [number, number, number],
) => void;

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

  return {
    // Single click without dragging (used for text, polyline, lasso point-by-point)
    onClick: ({ coordinate }: any) => emit("click", coordinate),

    // Start of drag operation (used for rectangle, line, lasso freehand)
    onDragStart: ({ coordinate }: any) => emit("dragStart", coordinate),

    // During drag operation (used for rectangle, line, lasso freehand)
    onDrag: ({ coordinate }: any) => emit("drag", coordinate),

    // End of drag operation (used for rectangle, line, lasso freehand)
    onDragEnd: ({ coordinate }: any) => emit("dragEnd", coordinate),

    // Hover events (for tools that need hover feedback)
    onHover: (info: any) => {
      // Deck.gl hover events can have coordinate as an array or as x, y, z properties
      const coordinate =
        info.coordinate ||
        (info.x !== undefined && info.y !== undefined
          ? [info.x, info.y, info.z || 0]
          : null);
      const layer = info.layer;

      // Detect if hovering over an annotation layer (only for move tool)
      if (activeTool === "move") {
        if (layer && layer.id && layer.id.startsWith("annotation-")) {
          // Extract annotation ID, handling both 'annotation-{id}' and 'annotation-{id}-text' formats
          let annotationId = layer.id.replace("annotation-", "");
          // Remove '-text' suffix if present (for text layers attached to shapes)
          if (annotationId.endsWith("-text")) {
            annotationId = annotationId.replace("-text", "");
          }
          useOverlayStore.getState().setHoveredAnnotation(annotationId);
        } else {
          // Clear hover state if not hovering over an annotation
          useOverlayStore.getState().setHoveredAnnotation(null);
        }
      } else {
        // Clear hover state when not using move tool
        useOverlayStore.getState().setHoveredAnnotation(null);
      }

      // Emit hover coordinate for drawing tools
      if (
        activeTool === "move" ||
        activeTool === "text" ||
        activeTool === "polyline" ||
        activeTool === "rectangle" ||
        activeTool === "ellipse" ||
        activeTool === "line" ||
        activeTool === "lasso"
      ) {
        if (coordinate) {
          emit("hover", coordinate);
        }
      }
    },
  };
};

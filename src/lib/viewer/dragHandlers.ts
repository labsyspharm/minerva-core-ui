// Drag handlers for Deck.gl interactions
// These handlers translate Deck.gl events into interaction events for the overlay system

import { useAppStore } from "../stores/app-store";
import { SCALEBAR_VIEW_ID } from "./deckViewIds";

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
  viewport?: {
    id?: string;
    x: number;
    y: number;
    unproject: (position: number[], opts?: { topLeft?: boolean }) => number[];
  };
};

/** (worldX, worldY) -> [screenX, screenY] in canvas pixels; used for brush. */
export type WorldToScreen = (
  worldX: number,
  worldY: number,
) => [number, number] | undefined;

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

  // Helper to emit interaction if coordinate exists
  const emit = (type: InteractionType, coordinate?: number[]) => {
    if (coordinate) {
      onInteraction(type, coordinate);
    }
  };

  const xyFinite = (p: number[] | null | undefined): p is number[] =>
    !!p && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

  // Prefer viewport unproject on the slide (any view that is not the scale bar).
  // Fall back to layer `coordinate` — MultiscaleImageLayer can lie outside tiles.
  const toCoord = (info: PickInfo): [number, number, number] | undefined => {
    const vp = info.viewport;
    const { x, y } = info;
    if (
      vp &&
      vp.id !== SCALEBAR_VIEW_ID &&
      typeof x === "number" &&
      typeof y === "number" &&
      Number.isFinite(x) &&
      Number.isFinite(y)
    ) {
      const u = vp.unproject([x - vp.x, y - vp.y]);
      if (xyFinite(u)) {
        return [u[0], u[1], u[2] ?? 0];
      }
    }
    const c = info.coordinate;
    if (xyFinite(c)) {
      return [c[0], c[1], c[2] ?? 0];
    }
    return undefined;
  };

  const store = useAppStore.getState;

  return {
    onClick: (info: PickInfo) => {
      const coord = toCoord(info);
      // For brush tool, treat a simple click as a single stamped stroke that
      // immediately finalizes into a circular shape.
      if (coord && activeTool === "brush" && getScreenFromWorld) {
        const screen = getScreenFromWorld(coord[0], coord[1]);
        if (screen) {
          store().brushPaintStart(screen);
          store().brushPaintEnd();
        }
      }
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

      // Detect if hovering over a shape (only for move tool, and only
      // while a waypoint is open for edit — shape layers are not pickable otherwise).
      if (activeTool === "move" && store().authoringWaypointEditorOpen) {
        if (layer?.id?.startsWith("shape-") && object?.id) {
          // Use the picked object's id; strip -arrow or -text suffix for sub-layers
          let shapeId = object.id;
          if (shapeId.endsWith("-arrow")) {
            shapeId = shapeId.replace("-arrow", "");
          } else if (shapeId.endsWith("-text")) {
            shapeId = shapeId.replace("-text", "");
          }
          useAppStore.getState().setHoveredShape(shapeId);
        } else {
          useAppStore.getState().setHoveredShape(null);
        }
      } else {
        useAppStore.getState().setHoveredShape(null);
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
        activeTool === "brush" ||
        activeTool === "point"
      ) {
        if (coordinate) {
          emit("hover", coordinate);
        }
      }
    },
  };
};

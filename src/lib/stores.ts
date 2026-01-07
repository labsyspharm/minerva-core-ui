import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ConfigWaypoint, ConfigWaypointArrow, ConfigWaypointOverlay } from './config';

// Re-export config types for convenience
export type { ConfigWaypointArrow as ConfigArrow, ConfigWaypointOverlay as ConfigOverlay };

// Types for the overlay store
export interface OverlayLayer {
  id: string;
  [key: string]: any;
}

// New annotation types - all using polygon coordinates internally
type ColorRGBA = [number, number, number, number];
export interface RectangleAnnotation {
  id: string;
  type: 'rectangle';
  polygon: [number, number][]; // Converted to polygon coordinates
  style: {
    fillColor: ColorRGBA;
    lineColor: ColorRGBA;
    lineWidth: number;
  };
  text?: string; // Optional text content to display within the shape
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
}

export interface PolygonAnnotation {
  id: string;
  type: 'polygon';
  polygon: [number, number][]; // Keep as polygon coordinates
  style: {
    fillColor: [number, number, number, number];
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  text?: string; // Optional text content to display within the shape
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
}

export interface EllipseAnnotation {
  id: string;
  type: 'ellipse';
  polygon: [number, number][]; // Ellipse approximated as polygon coordinates
  style: {
    fillColor: [number, number, number, number];
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  text?: string; // Optional text content to display within the shape
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
}

export interface LineAnnotation {
  id: string;
  type: 'line';
  polygon: [number, number][]; // Simple line as degenerate polygon for stroke-based rendering
  style: {
    fillColor: [number, number, number, number];
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  text?: string; // Optional text content to display within the shape
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
}


export interface PolylineAnnotation {
  id: string;
  type: 'polyline';
  polygon: [number, number][]; // Polyline points as polygon coordinates
  style: {
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  text?: string; // Optional text content to display within the shape
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
}

export interface TextAnnotation {
  id: string;
  type: 'text';
  position: [number, number]; // Text position
  text: string; // The text content
  style: {
    fontSize: number;
    fontColor: [number, number, number, number];
    backgroundColor?: [number, number, number, number];
    padding?: number;
  };
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
}

export interface PointAnnotation {
  id: string;
  type: 'point';
  position: [number, number]; // Point position
  style: {
    fillColor: [number, number, number, number];
    strokeColor: [number, number, number, number];
    radius: number; // Point radius in pixels
  };
  text?: string; // Optional text content to display within the shape
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
    isImported?: boolean; // Flag to mark imported annotations as un-deletable
  };
}

export type Annotation = RectangleAnnotation | EllipseAnnotation | PolygonAnnotation | LineAnnotation | PolylineAnnotation | TextAnnotation | PointAnnotation;

// Annotation Group interface
export interface AnnotationGroup {
  id: string;
  name: string;
  annotationIds: string[]; // IDs of annotations in this group
  isExpanded: boolean; // Whether the group is expanded in the UI
  metadata?: {
    createdAt: Date;
    color?: [number, number, number, number]; // Optional group color
  };
}

// Helper functions to convert shapes to polygon coordinates
export const rectangleToPolygon = (start: [number, number], end: [number, number]): [number, number][] => {
  const [startX, startY] = start;
  const [endX, endY] = end;

  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);

  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
    [minX, minY] // Close the polygon
  ];
};

// Helper function to convert bounding box to ellipse polygon
export const ellipseToPolygon = (start: [number, number], end: [number, number], segments: number = 64): [number, number][] => {
  const [startX, startY] = start;
  const [endX, endY] = end;

  // Calculate center and radii
  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;
  const radiusX = Math.abs(endX - startX) / 2;
  const radiusY = Math.abs(endY - startY) / 2;

  // Generate points around the ellipse
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    points.push([x, y]);
  }

  return points;
};

export const lineToPolygon = (start: [number, number], end: [number, number], lineWidth: number = 3): [number, number][] => {
  const [startX, startY] = start;
  const [endX, endY] = end;

  // Calculate perpendicular vector for line width
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    // If line has no length, create a small square
    const halfWidth = lineWidth / 2;
    return [
      [startX - halfWidth, startY - halfWidth],
      [startX + halfWidth, startY - halfWidth],
      [startX + halfWidth, startY + halfWidth],
      [startX - halfWidth, startY + halfWidth],
      [startX - halfWidth, startY - halfWidth]
    ];
  }

  // Normalize and create perpendicular vector
  const nx = -dy / length;
  const ny = dx / length;
  const halfWidth = lineWidth / 2;

  return [
    [startX + nx * halfWidth, startY + ny * halfWidth],
    [endX + nx * halfWidth, endY + ny * halfWidth],
    [endX - nx * halfWidth, endY - ny * halfWidth],
    [startX - nx * halfWidth, startY - ny * halfWidth],
    [startX + nx * halfWidth, startY + ny * halfWidth] // Close the polygon
  ];
};

// Helper function to create hexagon polygon (rectangle with one pointy edge)
// The pointy edge is at the start position, and the rectangle extends to the end position
export const hexagonToPolygon = (start: [number, number], end: [number, number], width: number = 25): [number, number][] => {
  const [startX, startY] = start;
  const [endX, endY] = end;

  // Calculate direction vector from start to end
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    // If line has no length, return a small hexagon around the point
    const halfWidth = width / 2;
    return [
      [startX, startY], // Pointy tip
      [startX + halfWidth, startY - halfWidth],
      [startX + halfWidth, startY + halfWidth],
      [startX, startY + halfWidth],
      [startX - halfWidth, startY + halfWidth],
      [startX - halfWidth, startY - halfWidth],
      [startX, startY], // Close the polygon
    ];
  }

  // Normalize direction vector
  const dirX = dx / length;
  const dirY = dy / length;

  // Perpendicular vector for rectangle width
  const perpX = -dirY;
  const perpY = dirX;
  const halfWidth = width / 2;

  // Offset from the tip to start the rectangle (makes it look more like a hexagon)
  // Move a small distance along the direction vector from the tip
  const tipOffset = Math.min(width * 0.3, length * 0.1); // Small offset, but not more than 10% of length
  const rectangleStartX = startX + dirX * tipOffset;
  const rectangleStartY = startY + dirY * tipOffset;

  // Create hexagon points:
  // 1. Start position (pointy tip)
  // 2. Top edge of rectangle, starting slightly offset from tip
  // 3. Top corner at end
  // 4. Bottom corner at end
  // 5. Bottom edge of rectangle, starting slightly offset from tip
  // 6. Back to start (closes polygon)
  return [
    [startX, startY], // Point 1: Sharp point at start
    [rectangleStartX + perpX * halfWidth, rectangleStartY + perpY * halfWidth], // Point 2: Top edge at rectangle start
    [endX + perpX * halfWidth, endY + perpY * halfWidth], // Point 3: Top corner at end
    [endX - perpX * halfWidth, endY - perpY * halfWidth], // Point 4: Bottom corner at end
    [rectangleStartX - perpX * halfWidth, rectangleStartY - perpY * halfWidth], // Point 5: Bottom edge at rectangle start
    [startX, startY], // Point 6: Back to start (closes polygon)
  ];
};

export const isPointInPolygon = (point: [number, number], polygon: [number, number][]): boolean => {
  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
};

export const textToPolygon = (position: [number, number], text: string, fontSize: number = 14, padding: number = 4): [number, number][] => {
  const [x, y] = position;

  // Estimate text dimensions with better approximation
  const charWidth = fontSize * 0.7; // More accurate character width
  const textWidth = text.length * charWidth;
  const textHeight = fontSize * 1.2; // Account for line height

  // Add VERY generous padding for easy hit detection
  // Make the hit area much larger than the actual text
  const hitPadding = Math.max(fontSize * 2, 20); // Much larger padding - at least 2x font size or 20px
  const halfWidth = (textWidth + hitPadding * 2) / 2;
  const halfHeight = (textHeight + hitPadding * 2) / 2;

  return [
    [x - halfWidth, y - halfHeight],
    [x + halfWidth, y - halfHeight],
    [x + halfWidth, y + halfHeight],
    [x - halfWidth, y + halfHeight],
    [x - halfWidth, y - halfHeight] // Close the polygon
  ];
};

export interface InteractionCoordinate {
  type: 'click' | 'dragStart' | 'drag' | 'dragEnd' | 'hover';
  coordinate: [number, number, number];
}

export interface DrawingState {
  isDrawing: boolean;
  dragStart: [number, number] | null;
  dragEnd: [number, number] | null;
}

export interface DragState {
  isDragging: boolean;
  draggedAnnotationId: string | null;
  dragOffset: [number, number] | null;
}

export interface HoverState {
  hoveredAnnotationId: string | null;
}

export interface OverlayStore {
  // State
  overlayLayers: OverlayLayer[];
  activeTool: string;
  currentInteraction: InteractionCoordinate | null;
  drawingState: DrawingState;
  dragState: DragState; // New: drag state for move tool
  hoverState: HoverState; // New: hover state for move tool
  annotations: Annotation[]; // New: persistent annotations
  annotationGroups: AnnotationGroup[]; // New: annotation groups
  hiddenLayers: Set<string>; // New: track hidden layers
  globalColor: [number, number, number, number]; // New: global drawing color
  viewportZoom: number; // Current viewport zoom level for line width scaling
  
  // Stories state
  stories: ConfigWaypoint[];
  activeStoryIndex: number | null;
  waypoints: ConfigWaypoint[]; // All waypoints from all stories
  activeWaypointId: string | null;

  // Channel Group and Channel State
  activeChannelGroupId: string | null;

  // Actions
  setActiveTool: (tool: string) => void;
  setCurrentInteraction: (interaction: InteractionCoordinate | null) => void;
  addOverlayLayer: (layer: OverlayLayer) => void;
  removeOverlayLayer: (layerId: string) => void;
  clearOverlayLayers: () => void;
  updateDrawingState: (updates: Partial<DrawingState>) => void;
  resetDrawingState: () => void;
  handleLayerCreate: (layer: OverlayLayer | null) => void;
  handleToolChange: (tool: string) => void;
  handleOverlayInteraction: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd' | 'hover', coordinate: [number, number, number]) => void;

  // New annotation actions
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (annotationId: string) => void;
  updateAnnotation: (annotationId: string, updates: Partial<Annotation>) => void;
  clearAnnotations: () => void;
  finalizeRectangle: () => void; // Convert current drawing to annotation
  
  // Stories actions
  setStories: (stories: ConfigWaypoint[]) => void;
  setActiveStory: (index: number | null) => void;
  addStory: (story: ConfigWaypoint) => void;
  updateStory: (index: number, updates: Partial<ConfigWaypoint>) => void;
  removeStory: (index: number) => void;
  reorderStories: (fromIndex: number, toIndex: number) => void;
  
  // Waypoints actions
  setWaypoints: (waypoints: ConfigWaypoint[]) => void;
  setActiveWaypoint: (waypointId: string | null) => void;
  addWaypoint: (waypoint: ConfigWaypoint) => void;
  updateWaypoint: (waypointId: string, updates: Partial<ConfigWaypoint>) => void;
  removeWaypoint: (waypointId: string) => void;

  // Channel group and channel actions
  setActiveChannelGroup: (channelGroupId: string) => void;

  finalizeEllipse: () => void; // Convert current drawing to ellipse annotation
  finalizeLasso: (points: [number, number][]) => void; // Convert lasso points to polygon annotation
  finalizeLine: () => void; // Convert current drawing to line annotation
  finalizePolyline: (points: [number, number][]) => void; // Convert polyline points to polyline annotation
  createTextAnnotation: (position: [number, number], text: string, fontSize?: number) => void; // Create text annotation
  createPointAnnotation: (position: [number, number], radius?: number) => void; // Create point annotation
  updateTextAnnotation: (annotationId: string, newText: string, fontSize?: number) => void; // Update text annotation content
  updateTextAnnotationColor: (annotationId: string, fontColor: [number, number, number, number]) => void; // Update text annotation color
  updateShapeText: (annotationId: string, newText: string) => void; // Update text field on any annotation (for shapes with text)
  setGlobalColor: (color: [number, number, number, number]) => void; // Set global drawing color
  setViewportZoom: (zoom: number) => void; // Set viewport zoom for line width scaling

  // New layer visibility actions
  toggleLayerVisibility: (annotationId: string) => void;
  showAllLayers: () => void;
  hideAllLayers: () => void;

  // New drag actions for move tool
  startDrag: (annotationId: string, offset: [number, number]) => void;
  updateDrag: (coordinate: [number, number, number]) => void;
  endDrag: () => void;
  resetDragState: () => void;

  // New hover actions for move tool
  setHoveredAnnotation: (annotationId: string | null) => void;
  resetHoverState: () => void;

  // Group actions
  createGroup: (name?: string) => void;
  deleteGroup: (groupId: string) => void;
  addAnnotationToGroup: (groupId: string, annotationId: string) => void;
  removeAnnotationFromGroup: (groupId: string, annotationId: string) => void;
  toggleGroupExpanded: (groupId: string) => void;

  // Import waypoint annotations actions
  imageWidth: number;
  imageHeight: number;
  setImageDimensions: (width: number, height: number) => void;
  importWaypointAnnotations: (arrows: ConfigWaypointArrow[], overlays: ConfigWaypointOverlay[]) => void;
  clearImportedAnnotations: () => void;
}

// Initial state for overlay store
const overlayInitialState = {
  overlayLayers: [],
  activeTool: 'move',
  currentInteraction: null,
  drawingState: {
    isDrawing: false,
    dragStart: null,
    dragEnd: null,
  },
  dragState: {
    isDragging: false,
    draggedAnnotationId: null,
    dragOffset: null,
  },
  hoverState: {
    hoveredAnnotationId: null,
  },
  activeWaypoint: 0,
  annotations: [], // New: empty annotations array
  annotationGroups: [], // New: empty groups array
  hiddenLayers: new Set<string>(), // New: empty hidden layers set
  globalColor: [255, 255, 255, 255], // New: default white color
  viewportZoom: 0, // Default zoom level
  stories: [], // New: empty stories array
  activeStoryIndex: null, // New: no active story initially
  waypoints: [], // New: empty waypoints array
  activeWaypointId: null, // New: no active waypoint initially
  imageWidth: 0,
  imageHeight: 0,
};

// Create the overlay store
export const useOverlayStore = create<OverlayStore>()(
  devtools(
    (set, get) => ({
      ...overlayInitialState,

      setActiveTool: (tool: string) => {
        set({ activeTool: tool });
      },

      setCurrentInteraction: (interaction: InteractionCoordinate | null) => {
        set({ currentInteraction: interaction });
      },

      addOverlayLayer: (layer: OverlayLayer) => {
        set((state) => {
          const filtered = state.overlayLayers.filter(l => l && l.id !== layer.id);
          return { overlayLayers: [...filtered, layer] };
        });
      },

      removeOverlayLayer: (layerId: string) => {
        set((state) => ({
          overlayLayers: state.overlayLayers.filter(l => l && l.id !== layerId)
        }));
      },

      clearOverlayLayers: () => {
        set({ overlayLayers: [] });
      },

      updateDrawingState: (updates: Partial<DrawingState>) => {
        set((state) => ({
          drawingState: { ...state.drawingState, ...updates }
        }));
      },

      resetDrawingState: () => {
        set({ drawingState: overlayInitialState.drawingState });
      },

      handleLayerCreate: (layer: OverlayLayer | null) => {
        if (layer === null) {
          // Remove the drawing layer when tool is not active
          get().removeOverlayLayer('drawing-layer');
          return;
        }

        // Add or update the layer
        get().addOverlayLayer(layer);
      },

      handleToolChange: (tool: string) => {
        set({ activeTool: tool });

        // Clear any partial drawing state when switching tools
        get().resetDrawingState();

        // Clear any drag state when switching tools
        get().resetDragState();

        // Remove the unified drawing layer
        get().removeOverlayLayer('drawing-layer');
      },

      handleOverlayInteraction: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd' | 'hover', coordinate: [number, number, number]) => {
        const interaction: InteractionCoordinate = { type, coordinate };
        set({ currentInteraction: interaction });

        const { activeTool, drawingState, dragState } = get();
        const [x, y] = coordinate;

        // Handle move tool interactions
        if (activeTool === 'move') {
          const { hoverState } = get();
          
          switch (type) {
            case 'hover':
              // Hover detection is handled in dragHandlers.ts
              break;
            case 'click':
              // Click without drag - just a click on annotation (no action needed)
              break;
            case 'dragStart':
              // Start drag if clicking on a hovered annotation
              if (hoverState.hoveredAnnotationId) {
                const annotation = get().annotations.find(a => a.id === hoverState.hoveredAnnotationId);
                if (annotation) {
                  // Calculate offset between click position and annotation position
                  let offset: [number, number] = [0, 0];
                  
                  if (annotation.type === 'text' || annotation.type === 'point') {
                    // For text and point, offset from position
                    offset = [x - annotation.position[0], y - annotation.position[1]];
                  } else {
                    // For polygon-based annotations, calculate offset from first point
                    const firstPoint = annotation.polygon[0];
                    offset = [x - firstPoint[0], y - firstPoint[1]];
                  }
                  
                  get().startDrag(hoverState.hoveredAnnotationId, offset);
                }
              }
              break;
            case 'drag':
              // Update drag position
              if (dragState.isDragging) {
                get().updateDrag(coordinate);
              }
              break;
            case 'dragEnd':
              // End drag
              if (dragState.isDragging) {
                get().endDrag();
              }
              break;
          }
          return;
        }

        // Handle drawing state updates based on interaction type for drawing tools
        switch (type) {
          case 'click':
          case 'dragStart':
            // Start drawing
            get().updateDrawingState({
              isDrawing: true,
              dragStart: [x, y],
              dragEnd: [x, y],
            });
            break;
          case 'drag':
            // Update drawing
            if (drawingState.isDrawing) {
              get().updateDrawingState({
                dragEnd: [x, y],
              });
            }
            break;
          case 'dragEnd':
            // Finish drawing and automatically finalize as annotation
            if (drawingState.isDrawing) {
              get().updateDrawingState({
                dragEnd: [x, y],
              });
              // Finalize based on active tool
              if (activeTool === 'rectangle') {
                setTimeout(() => {
                  get().finalizeRectangle();
                }, 0);
              } else if (activeTool === 'ellipse') {
                setTimeout(() => {
                  get().finalizeEllipse();
                }, 0);
              } else if (activeTool === 'line') {
                setTimeout(() => {
                  get().finalizeLine();
                }, 0);
              }
            }
            break;
        }
      },

      // New annotation actions
      addAnnotation: (annotation: Annotation) => {
        set((state) => ({
          annotations: [...state.annotations, annotation]
        }));
      },

      removeAnnotation: (annotationId: string) => {
        set((state) => {
          const newHiddenLayers = new Set(state.hiddenLayers);
          newHiddenLayers.delete(annotationId); // Clean up hidden state
          return {
            annotations: state.annotations.filter(a => a.id !== annotationId),
            hiddenLayers: newHiddenLayers
          };
        });
      },

      updateAnnotation: (annotationId: string, updates: Partial<Annotation>) => {
        set((state) => ({
          annotations: state.annotations.map(a =>
            a.id === annotationId ? { ...a, ...updates } as Annotation : a
          )
        }));
      },

      clearAnnotations: () => {
        set({ annotations: [] });
      },

      finalizeRectangle: () => {
        const { drawingState } = get();
        if (drawingState.isDrawing && drawingState.dragStart && drawingState.dragEnd) {
          const [startX, startY] = drawingState.dragStart;
          const [endX, endY] = drawingState.dragEnd;

          // Create a new rectangle annotation using polygon coordinates
          const annotation: RectangleAnnotation = {
            id: `rect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'rectangle',
            polygon: rectangleToPolygon([startX, startY], [endX, endY]),
            style: {
              fillColor: [get().globalColor[0], get().globalColor[1], get().globalColor[2], 50], // Use global color with low opacity
              lineColor: get().globalColor, // Use global color for border
              lineWidth: 3,
            },
            metadata: {
              createdAt: new Date(),
              label: `Rectangle ${get().annotations.length + 1}`,
            },
          };

          // Add the annotation
          get().addAnnotation(annotation);

          // Reset drawing state
          get().resetDrawingState();

          // Remove the temporary drawing layer
          get().removeOverlayLayer('drawing-layer');
        }
      },

      finalizeEllipse: () => {
        const { drawingState } = get();
        if (drawingState.isDrawing && drawingState.dragStart && drawingState.dragEnd) {
          const [startX, startY] = drawingState.dragStart;
          const [endX, endY] = drawingState.dragEnd;

          // Create a new ellipse annotation using polygon coordinates
          const annotation: EllipseAnnotation = {
            id: `ellipse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'ellipse',
            polygon: ellipseToPolygon([startX, startY], [endX, endY]),
            style: {
              fillColor: [get().globalColor[0], get().globalColor[1], get().globalColor[2], 50], // Use global color with low opacity
              lineColor: get().globalColor, // Use global color for border
              lineWidth: 3,
            },
            metadata: {
              createdAt: new Date(),
              label: `Ellipse ${get().annotations.length + 1}`,
            },
          };

          // Add the annotation
          get().addAnnotation(annotation);

          // Reset drawing state
          get().resetDrawingState();

          // Remove the temporary drawing layer
          get().removeOverlayLayer('drawing-layer');
        }
      },

      finalizeLasso: (points: [number, number][]) => {
        if (points.length >= 3) {
          // Create a new polygon annotation
          const annotation: PolygonAnnotation = {
            id: `poly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'polygon',
            polygon: points,
            style: {
              fillColor: [get().globalColor[0], get().globalColor[1], get().globalColor[2], 50], // Use global color with low opacity
              lineColor: get().globalColor, // Use global color for border
              lineWidth: 3,
            },
            metadata: {
              createdAt: new Date(),
              label: `Polygon ${get().annotations.length + 1}`,
            },
          };

          // Add the annotation
          get().addAnnotation(annotation);

          // Remove the temporary drawing layer
          get().removeOverlayLayer('drawing-layer');
        }
      },

      finalizePolyline: (points: [number, number][]) => {
        if (points.length >= 2) {
          // Create a new polyline annotation
          const annotation: PolylineAnnotation = {
            id: `polyline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'polyline',
            polygon: points,
            style: {
              lineColor: get().globalColor, // Use global color for border
              lineWidth: 3,
            },
            metadata: {
              createdAt: new Date(),
              label: `Polyline ${get().annotations.length + 1}`,
            },
          };

          // Add the annotation
          get().addAnnotation(annotation);

          // Remove the temporary drawing layer
          get().removeOverlayLayer('drawing-layer');
        }
      },

      finalizeLine: () => {
        const { drawingState } = get();
        if (drawingState.isDrawing && drawingState.dragStart && drawingState.dragEnd) {
          const [startX, startY] = drawingState.dragStart;
          const [endX, endY] = drawingState.dragEnd;

          // Simple polygon for stroke-based line rendering (no fill, just stroke)
          const linePolygon: [number, number][] = [
            [startX, startY],
            [endX, endY],
            [endX, endY],
            [startX, startY],
            [startX, startY]
          ];

          const annotation: LineAnnotation = {
            id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'line',
            polygon: linePolygon,
            style: {
              fillColor: [0, 0, 0, 0] as [number, number, number, number], // Transparent fill
              lineColor: get().globalColor,
              lineWidth: 3,
            },
            metadata: {
              createdAt: new Date(),
              label: `Line ${get().annotations.length + 1}`,
            },
          };

          // Add the annotation
          get().addAnnotation(annotation);

          // Reset drawing state
          get().resetDrawingState();

          // Remove the temporary drawing layer
          get().removeOverlayLayer('drawing-layer');
        }
      },

      createTextAnnotation: (position: [number, number], text: string, fontSize: number = 14) => {
        if (!text.trim()) {
          return;
        }

        // Create a new text annotation
        const annotation: TextAnnotation = {
          id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'text',
          position: position,
          text: text.trim(),
          style: {
            fontSize: fontSize,
            fontColor: get().globalColor, // Use global color
            backgroundColor: [0, 0, 0, 100], // Semi-transparent black background
            padding: 4,
          },
          metadata: {
            createdAt: new Date(),
            label: `Text ${get().annotations.length + 1}`,
          },
        };

        // Add the annotation
        get().addAnnotation(annotation);
      },

      createPointAnnotation: (position: [number, number], radius: number = 5) => {
        // Create a new point annotation
        const annotation: PointAnnotation = {
          id: `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'point',
          position: position,
          style: {
            fillColor: get().globalColor, // Use global color for fill
            strokeColor: [255, 255, 255, 255], // White stroke
            radius: radius,
          },
          metadata: {
            createdAt: new Date(),
            label: `Point ${get().annotations.length + 1}`,
          },
        };

        // Add the annotation
        get().addAnnotation(annotation);
      },

      updateTextAnnotation: (annotationId: string, newText: string, fontSize?: number) => {
        if (!newText.trim()) {
          return;
        }

        const annotations = get().annotations;
        const annotation = annotations.find(a => a.id === annotationId);

        if (!annotation || annotation.type !== 'text') {
          return;
        }

        // Update the text content and optionally fontSize
        const updates: Partial<TextAnnotation> = {
          text: newText.trim()
        };

        if (fontSize !== undefined) {
          updates.style = {
            ...annotation.style,
            fontSize: fontSize
          };
        }

        get().updateAnnotation(annotationId, updates);
      },

      updateTextAnnotationColor: (annotationId: string, fontColor: [number, number, number, number]) => {
        const annotations = get().annotations;
        const annotation = annotations.find(a => a.id === annotationId);

        if (!annotation || annotation.type !== 'text') {
          return;
        }

        // Update the font color
        const updates: Partial<TextAnnotation> = {
          style: {
            ...annotation.style,
            fontColor: fontColor
          }
        };

        get().updateAnnotation(annotationId, updates);
      },

      updateShapeText: (annotationId: string, newText: string) => {
        const annotations = get().annotations;
        const annotation = annotations.find(a => a.id === annotationId);

        if (!annotation) {
          return;
        }

        // For text annotations, use the existing updateTextAnnotation method
        if (annotation.type === 'text') {
          get().updateTextAnnotation(annotationId, newText);
          return;
        }

        // Update the text field on the shape
        // Empty string removes the text field
        const updates: Partial<Annotation> = {
          text: newText.trim() || undefined
        };

        get().updateAnnotation(annotationId, updates);
      },

      setGlobalColor: (color: [number, number, number, number]) => {
        set({ globalColor: color });
      },

      setViewportZoom: (zoom: number) => {
        set({ viewportZoom: zoom });
      },

      // New layer visibility actions
      toggleLayerVisibility: (annotationId: string) => {
        set((state) => {
          const newHiddenLayers = new Set(state.hiddenLayers);
          if (newHiddenLayers.has(annotationId)) {
            newHiddenLayers.delete(annotationId);
          } else {
            newHiddenLayers.add(annotationId);
          }
          return { hiddenLayers: newHiddenLayers };
        });
      },

      showAllLayers: () => {
        set({ hiddenLayers: new Set<string>() });
      },

      hideAllLayers: () => {
        set((state) => ({
          hiddenLayers: new Set(state.annotations.map(a => a.id))
        }));
      },

      // New drag actions for move tool
      startDrag: (annotationId: string, offset: [number, number]) => {
        set({
          dragState: {
            isDragging: true,
            draggedAnnotationId: annotationId,
            dragOffset: offset,
          }
        });
      },

      updateDrag: (coordinate: [number, number, number]) => {
        const { dragState, annotations } = get();
        if (dragState.isDragging && dragState.draggedAnnotationId && dragState.dragOffset) {
          const [x, y] = coordinate;
          const [offsetX, offsetY] = dragState.dragOffset;

          // Calculate new position based on drag offset
          const newX = x - offsetX;
          const newY = y - offsetY;

          // Find the annotation being dragged
          const annotation = annotations.find(a => a.id === dragState.draggedAnnotationId);
          if (annotation) {
            if (annotation.type === 'text' || annotation.type === 'point') {
              // For text and point annotations, update the position directly
              const updatedAnnotation = {
                ...annotation,
                position: [newX, newY] as [number, number]
              };
              get().updateAnnotation(dragState.draggedAnnotationId, updatedAnnotation);
            } else {
              // For polygon-based annotations (rectangle, polygon, line, polyline), calculate delta from first point
              const deltaX = newX - annotation.polygon[0][0];
              const deltaY = newY - annotation.polygon[0][1];

              // Update all polygon points by the same delta
              const updatedPolygon = annotation.polygon.map(([px, py]) => [px + deltaX, py + deltaY] as [number, number]);

              const updatedAnnotation = {
                ...annotation,
                polygon: updatedPolygon
              };

              // Update the annotation in the store
              get().updateAnnotation(dragState.draggedAnnotationId, updatedAnnotation);
            }
          }
        }
      },

      endDrag: () => {
        set({
          dragState: {
            isDragging: false,
            draggedAnnotationId: null,
            dragOffset: null,
          }
        });
      },

      resetDragState: () => {
        set({ dragState: overlayInitialState.dragState });
      },

      // New hover actions for move tool
      setHoveredAnnotation: (annotationId: string | null) => {
        set({
          hoverState: {
            hoveredAnnotationId: annotationId,
          }
        });
      },

      resetHoverState: () => {
        set({ hoverState: overlayInitialState.hoverState });
      },

      // Group actions
      createGroup: (name?: string) => {
        const groupCount = get().annotationGroups.length;
        const newGroup: AnnotationGroup = {
          id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: name || `Group ${groupCount + 1}`,
          annotationIds: [],
          isExpanded: true,
          metadata: {
            createdAt: new Date(),
          },
        };
        set((state) => ({
          annotationGroups: [...state.annotationGroups, newGroup]
        }));
      },

      deleteGroup: (groupId: string) => {
        set((state) => ({
          annotationGroups: state.annotationGroups.filter(g => g.id !== groupId)
        }));
      },

      addAnnotationToGroup: (groupId: string, annotationId: string) => {
        set((state) => ({
          annotationGroups: state.annotationGroups.map(group =>
            group.id === groupId
              ? { ...group, annotationIds: [...group.annotationIds, annotationId] }
              : group
          )
        }));
      },

      removeAnnotationFromGroup: (groupId: string, annotationId: string) => {
        set((state) => ({
          annotationGroups: state.annotationGroups.map(group =>
            group.id === groupId
              ? { ...group, annotationIds: group.annotationIds.filter(id => id !== annotationId) }
              : group
          )
        }));
      },

      toggleGroupExpanded: (groupId: string) => {
        set((state) => ({
          annotationGroups: state.annotationGroups.map(group =>
            group.id === groupId
              ? { ...group, isExpanded: !group.isExpanded }
              : group
          )
        }));
      },

      // Stories actions
      setStories: (stories: ConfigWaypoint[]) => {
        set({ stories, activeStoryIndex: null });
      },

      setActiveStory: (index: number | null) => {
        set({ activeStoryIndex: index });
      },

      addStory: (story: ConfigWaypoint) => {
        set((state) => ({
          stories: [...state.stories, story]
        }));
      },

      updateStory: (index: number, updates: Partial<ConfigWaypoint>) => {
        set((state) => ({
          stories: state.stories.map((story, i) => 
            i === index ? { ...story, ...updates } : story
          )
        }));
      },

      removeStory: (index: number) => {
        set((state) => ({
          stories: state.stories.filter((_, i) => i !== index),
          activeStoryIndex: state.activeStoryIndex === index ? null : 
            state.activeStoryIndex && state.activeStoryIndex > index ? 
              state.activeStoryIndex - 1 : state.activeStoryIndex
        }));
      },

      reorderStories: (fromIndex: number, toIndex: number) => {
        set((state) => {
          const newStories = [...state.stories];
          const [movedStory] = newStories.splice(fromIndex, 1);
          newStories.splice(toIndex, 0, movedStory);
          
          // Update activeStoryIndex if it's affected by the reordering
          let newActiveStoryIndex = state.activeStoryIndex;
          if (state.activeStoryIndex !== null) {
            if (state.activeStoryIndex === fromIndex) {
              // The active story was moved
              newActiveStoryIndex = toIndex;
            } else if (fromIndex < state.activeStoryIndex && toIndex >= state.activeStoryIndex) {
              // Story moved from before active to after active
              newActiveStoryIndex = state.activeStoryIndex - 1;
            } else if (fromIndex > state.activeStoryIndex && toIndex <= state.activeStoryIndex) {
              // Story moved from after active to before active
              newActiveStoryIndex = state.activeStoryIndex + 1;
            }
          }
          
          return {
            stories: newStories,
            activeStoryIndex: newActiveStoryIndex
          };
        });
      },

      // Waypoints actions
      setWaypoints: (waypoints: ConfigWaypoint[]) => {
        set({ waypoints, activeWaypointId: null });
      },

      setActiveWaypoint: (waypointId: string | null) => {
        set({ activeWaypointId: waypointId });
      },

      addWaypoint: (waypoint: ConfigWaypoint) => {
        set((state) => ({
          waypoints: [...state.waypoints, waypoint]
        }));
      },

      updateWaypoint: (waypointId: string, updates: Partial<ConfigWaypoint>) => {
        set((state) => ({
          waypoints: state.waypoints.map((waypoint) =>
            waypoint.UUID === waypointId ? { ...waypoint, ...updates } : waypoint
          )
        }));
      },

      removeWaypoint: (waypointId: string) => {
        set((state) => ({
          waypoints: state.waypoints.filter((waypoint) => waypoint.UUID !== waypointId),
          activeWaypointId: state.activeWaypointId === waypointId ? null : state.activeWaypointId
        }));
      },


      // Image dimensions actions
      setImageDimensions: (width: number, height: number) => {
        set({ imageWidth: width, imageHeight: height });
      },

      // Import waypoint annotations actions
      importWaypointAnnotations: (arrows: ConfigWaypointArrow[], overlays: ConfigWaypointOverlay[]) => {
        const { imageWidth, imageHeight } = get();
        
        // Skip if image dimensions not set
        if (imageWidth === 0 || imageHeight === 0) {
          return;
        }
        
        const newAnnotations: Annotation[] = [];

        // Convert arrows to line annotations (coordinates are normalized 0-1, convert to image pixels)
        arrows.forEach((arrow, index) => {
          // Convert normalized coordinates to image pixels
          const [normX, normY] = arrow.Point;
          const x = normX * imageWidth;
          const y = normY * imageHeight;

          if (arrow.HideArrow) {
            // Create text-only annotation
            const textAnnotation: TextAnnotation = {
              id: `imported-text-${Date.now()}-${index}`,
              type: 'text',
              position: [x, y],
              text: arrow.Text,
              style: {
                fontSize: 16,
                fontColor: [255, 255, 255, 255], // White text
                backgroundColor: [0, 0, 0, 150], // Semi-transparent black background
                padding: 6,
              },
              metadata: {
                createdAt: new Date(),
                label: arrow.Text,
                isImported: true,
              },
            };
            newAnnotations.push(textAnnotation);
          } else {
            // Create line annotation (arrow converted to simple stroke-based line)
            // Convert angle from degrees to radians and calculate start point
            // Angle 0 = pointing right, 90 = pointing down, etc.
            const angleRad = (arrow.Angle * Math.PI) / 180;
            
            // Line length proportional to image size (50% of the smaller dimension)
            const minDimension = Math.min(imageWidth, imageHeight);
            const lineLength = minDimension * 0.50;
            
            // Calculate start point (line points TO the Point location)
            // So start is away from the point in the direction of the angle
            const startX = x + Math.cos(angleRad) * lineLength;
            const startY = y + Math.sin(angleRad) * lineLength;
            const endX = x;
            const endY = y;

            // Simple polygon for stroke-based line rendering (no fill, just stroke)
            const linePolygon: [number, number][] = [
              [startX, startY],
              [endX, endY],
              [endX, endY],
              [startX, startY],
              [startX, startY]
            ];

            const lineAnnotation: LineAnnotation = {
              id: `imported-line-${Date.now()}-${index}`,
              type: 'line',
              polygon: linePolygon,
              text: arrow.Text,
              style: {
                fillColor: [0, 0, 0, 0], // Transparent fill
                lineColor: [255, 255, 255, 255], // White line
                lineWidth: 3,
              },
              metadata: {
                createdAt: new Date(),
                label: arrow.Text,
                isImported: true,
              },
            };
            newAnnotations.push(lineAnnotation);
          }
        });

        // Convert overlays (rectangles) to annotations (coordinates are normalized 0-1, convert to image pixels)
        overlays.forEach((overlay, index) => {
          // Convert normalized coordinates to image pixels
          const x = overlay.x * imageWidth;
          const y = overlay.y * imageHeight;
          const width = overlay.width * imageWidth;
          const height = overlay.height * imageHeight;
          
          const polygon = rectangleToPolygon(
            [x, y],
            [x + width, y + height]
          );

          const rectAnnotation: RectangleAnnotation = {
            id: `imported-rect-${Date.now()}-${index}`,
            type: 'rectangle',
            polygon,
            style: {
              fillColor: [255, 255, 255, 30], // White with very low opacity
              lineColor: [255, 255, 255, 200], // White border
              lineWidth: 2,
            },
            metadata: {
              createdAt: new Date(),
              label: `Region ${index + 1}`,
              isImported: true,
            },
          };
          newAnnotations.push(rectAnnotation);
        });

        // Add all new annotations to the store
        set((state) => ({
          annotations: [...state.annotations, ...newAnnotations]
        }));
      },

      clearImportedAnnotations: () => {
        set((state) => ({
          annotations: state.annotations.filter(a => !a.metadata?.isImported),
          hiddenLayers: new Set(
            [...state.hiddenLayers].filter(id => {
              const annotation = state.annotations.find(a => a.id === id);
              return annotation && !annotation.metadata?.isImported;
            })
          )
        }));
      },

      // channel and group actions
      //
      setActiveChannelGroup: (channelGroupId: string) => {
        console.log('Store: Setting active channel group ID:', channelGroupId);
        set({ activeChannelGroupId: channelGroupId });
      }
    }),
    {
      name: 'overlay-store',
    }
  )
);

// Example of how to add more stores in the future:
// 
// export interface UserStore {
//   user: User | null;
//   isAuthenticated: boolean;
//   login: (credentials: LoginCredentials) => Promise<void>;
//   logout: () => void;
// }
// 
// export const useUserStore = create<UserStore>()(
//   devtools(
//     (set) => ({
//       user: null,
//       isAuthenticated: false,
//       login: async (credentials) => {
//         // Login logic
//       },
//       logout: () => {
//         set({ user: null, isAuthenticated: false });
//       },
//     }),
//     { name: 'user-store' }
//   )
// );

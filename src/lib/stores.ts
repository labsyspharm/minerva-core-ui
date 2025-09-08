import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Types for the overlay store
export interface OverlayLayer {
  id: string;
  [key: string]: any;
}

// New annotation types
export interface RectangleAnnotation {
  id: string;
  type: 'rectangle';
  coordinates: {
    start: [number, number];
    end: [number, number];
  };
  style: {
    fillColor: [number, number, number, number];
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
  };
}

export interface PolygonAnnotation {
  id: string;
  type: 'polygon';
  coordinates: [number, number][]; // Array of points
  style: {
    fillColor: [number, number, number, number];
    lineColor: [number, number, number, number];
    lineWidth: number;
  };
  metadata?: {
    createdAt: Date;
    label?: string;
    description?: string;
  };
}

export type Annotation = RectangleAnnotation | PolygonAnnotation; // Extended with polygon type

export interface InteractionCoordinate {
  type: 'click' | 'dragStart' | 'drag' | 'dragEnd';
  coordinate: [number, number, number];
}

export interface DrawingState {
  isDrawing: boolean;
  dragStart: [number, number] | null;
  dragEnd: [number, number] | null;
}

export interface OverlayStore {
  // State
  overlayLayers: OverlayLayer[];
  activeTool: string;
  currentInteraction: InteractionCoordinate | null;
  drawingState: DrawingState;
  annotations: Annotation[]; // New: persistent annotations
  hiddenLayers: Set<string>; // New: track hidden layers
  
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
  handleOverlayInteraction: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number]) => void;
  
  // New annotation actions
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (annotationId: string) => void;
  updateAnnotation: (annotationId: string, updates: Partial<Annotation>) => void;
  clearAnnotations: () => void;
  finalizeRectangle: () => void; // Convert current drawing to annotation
  finalizeLasso: (points: [number, number][]) => void; // Convert lasso points to polygon annotation
  
  // New layer visibility actions
  toggleLayerVisibility: (annotationId: string) => void;
  showAllLayers: () => void;
  hideAllLayers: () => void;
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
  annotations: [], // New: empty annotations array
  hiddenLayers: new Set<string>(), // New: empty hidden layers set
};

// Create the overlay store
export const useOverlayStore = create<OverlayStore>()(
  devtools(
    (set, get) => ({
      ...overlayInitialState,

      setActiveTool: (tool: string) => {
        console.log('Store: Tool changed to:', tool);
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
        console.log('Store: handleLayerCreate called with layer:', layer);
        
        if (layer === null) {
          // Remove the green rectangle layer when tool is not rectangle
          get().removeOverlayLayer('green-rectangle');
          return;
        }

        // Add or update the layer
        get().addOverlayLayer(layer);
      },

      handleToolChange: (tool: string) => {
        console.log('Store: Tool changed to:', tool);
        set({ activeTool: tool });
      },

      handleOverlayInteraction: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number]) => {
        console.log('Store: Overlay interaction:', type, 'at coordinate:', coordinate);
        
        const interaction: InteractionCoordinate = { type, coordinate };
        set({ currentInteraction: interaction });

        // Handle drawing state updates based on interaction type
        const { drawingState } = get();
        const [x, y] = coordinate;

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
              // Only finalize rectangle if rectangle tool is active
              const { activeTool } = get();
              if (activeTool === 'rectangle') {
                setTimeout(() => {
                  get().finalizeRectangle();
                }, 0);
              }
            }
            break;
        }
      },

      // New annotation actions
      addAnnotation: (annotation: Annotation) => {
        console.log('Store: Adding annotation:', annotation);
        set((state) => ({
          annotations: [...state.annotations, annotation]
        }));
      },

      removeAnnotation: (annotationId: string) => {
        console.log('Store: Removing annotation:', annotationId);
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
        console.log('Store: Updating annotation:', annotationId, updates);
        set((state) => ({
          annotations: state.annotations.map(a => 
            a.id === annotationId ? { ...a, ...updates } : a
          )
        }));
      },

      clearAnnotations: () => {
        console.log('Store: Clearing all annotations');
        set({ annotations: [] });
      },

      finalizeRectangle: () => {
        const { drawingState } = get();
        if (drawingState.isDrawing && drawingState.dragStart && drawingState.dragEnd) {
          const [startX, startY] = drawingState.dragStart;
          const [endX, endY] = drawingState.dragEnd;
          
          // Create a new rectangle annotation
          const annotation: RectangleAnnotation = {
            id: `rect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'rectangle',
            coordinates: {
              start: [startX, startY],
              end: [endX, endY],
            },
            style: {
              fillColor: [0, 255, 0, 50], // Green with low opacity
              lineColor: [0, 255, 0, 255], // Solid green border
              lineWidth: 3,
            },
            metadata: {
              createdAt: new Date(),
              label: `Rectangle ${get().annotations.length + 1}`,
            },
          };

          console.log('Store: Finalizing rectangle as annotation:', annotation);
          
          // Add the annotation
          get().addAnnotation(annotation);
          
          // Reset drawing state
          get().resetDrawingState();
          
          // Remove the temporary drawing layer
          get().removeOverlayLayer('green-rectangle');
        }
      },

      finalizeLasso: (points: [number, number][]) => {
        if (points.length >= 3) {
          // Create a new polygon annotation
          const annotation: PolygonAnnotation = {
            id: `poly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'polygon',
            coordinates: points,
            style: {
              fillColor: [255, 165, 0, 50], // Orange with low opacity
              lineColor: [255, 165, 0, 255], // Solid orange border
              lineWidth: 3,
            },
            metadata: {
              createdAt: new Date(),
              label: `Polygon ${get().annotations.length + 1}`,
            },
          };

          console.log('Store: Finalizing lasso as annotation:', annotation);
          
          // Add the annotation
          get().addAnnotation(annotation);
          
          // Remove the temporary drawing layer
          get().removeOverlayLayer('green-lasso');
        }
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

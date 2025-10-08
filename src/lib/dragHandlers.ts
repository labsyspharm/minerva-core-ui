// Drag handlers for Deck.gl interactions
// These handlers translate Deck.gl events into interaction events for the overlay system

type InteractionType = 'click' | 'dragStart' | 'drag' | 'dragEnd' | 'hover';
type InteractionCallback = (type: InteractionType, coordinate: [number, number, number]) => void;

export const createDragHandlers = (
  activeTool: string,
  onInteraction?: InteractionCallback
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
  const emit = (type: InteractionType, coordinate?: [number, number, number]) => {
    if (coordinate) {
      onInteraction(type, coordinate);
    }
  };

  return {
    // Single click without dragging (used for text, polyline, lasso point-by-point)
    onClick: ({ coordinate }: any) => emit('click', coordinate),

    // Start of drag operation (used for rectangle, line, lasso freehand)
    onDragStart: ({ coordinate }: any) => emit('dragStart', coordinate),

    // During drag operation (used for rectangle, line, lasso freehand)
    onDrag: ({ coordinate }: any) => emit('drag', coordinate),

    // End of drag operation (used for rectangle, line, lasso freehand)
    onDragEnd: ({ coordinate }: any) => emit('dragEnd', coordinate),

    // Hover events (for tools that need hover feedback)
    onHover: ({ coordinate }: any) => {
      if (activeTool === 'move' || activeTool === 'text' || activeTool === 'polyline' || activeTool === 'rectangle' || activeTool === 'ellipse' || activeTool === 'line' || activeTool === 'lasso') {
        emit('hover', coordinate);
      }
    },
  };
};

// Drag handlers for Deck.gl interactions with optimized performance
export const createDragHandlers = (
  activeTool: string, 
  onInteraction?: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd' | 'hover', coordinate: [number, number, number]) => void
) => {
  const handleClick = ({ coordinate }: any) => {
    if (coordinate && onInteraction) {
      // Handle all tools including move tool
      onInteraction('click', coordinate);
    }
  };

  const handleDragStart = ({ coordinate }: any) => {
    if (coordinate && onInteraction) {
      // Handle all tools including move tool
      onInteraction('dragStart', coordinate);
    }
  };

  const handleDrag = ({ coordinate }: any) => {
    if (coordinate && onInteraction) {
      // Handle all tools including move tool
      onInteraction('drag', coordinate);
    }
  };

  const handleDragEnd = ({ coordinate }: any) => {
    if (coordinate && onInteraction) {
      // Handle all tools including move tool
      onInteraction('dragEnd', coordinate);
    }
  };

  const handleHover = ({ coordinate }: any) => {
    if (coordinate && onInteraction && (activeTool === 'move' || activeTool === 'text')) {
      // Handle hover for move tool and text tool
      onInteraction('hover', coordinate);
    }
  };

  return {
    onClick: handleClick,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
    onHover: handleHover,
  };
};


// Drag handlers for Deck.gl interactions with optimized performance
export const createDragHandlers = (
  activeTool: string, 
  onInteraction?: (type: 'click' | 'dragStart' | 'drag' | 'dragEnd', coordinate: [number, number, number]) => void
) => {
  const handleClick = ({ coordinate }: any) => {
    if ((activeTool === 'rectangle' || activeTool === 'lasso' || activeTool === 'line') && coordinate && onInteraction) {
      onInteraction('click', coordinate);
    }
  };

  const handleDragStart = ({ coordinate }: any) => {
    if ((activeTool === 'rectangle' || activeTool === 'lasso' || activeTool === 'line') && coordinate && onInteraction) {
      onInteraction('dragStart', coordinate);
    }
  };

  const handleDrag = ({ coordinate }: any) => {
    if ((activeTool === 'rectangle' || activeTool === 'lasso' || activeTool === 'line') && coordinate && onInteraction) {
      onInteraction('drag', coordinate);
    }
  };

  const handleDragEnd = ({ coordinate }: any) => {
    if ((activeTool === 'rectangle' || activeTool === 'lasso' || activeTool === 'line') && coordinate && onInteraction) {
      onInteraction('dragEnd', coordinate);
    }
  };

  return {
    onClick: handleClick,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  };
};


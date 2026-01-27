import * as React from "react";
import type { Layer } from '@deck.gl/core';

export type LoadingWidgetProps = {
  /** Widget positioning within the view. Default 'top-left'. */
  placement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Tooltip message when loading */
  label?: string;
};

/**
 * A minimal loading widget that shows a spinner if any layers are loading data.
 * This is a simplified version that works with deck.gl 9.1.11 (no Widget class).
 * Uses onRedraw callback pattern similar to the original Widget implementation.
 */
export const LoadingWidget = React.forwardRef<
  { onRedraw: (params: { layers: Layer[] }) => void },
  LoadingWidgetProps
>(({ 
  placement = 'top-left',
  label = 'Loading layer data'
}, ref) => {
  const [loading, setLoading] = React.useState(true);

  // onRedraw callback - matches the original Widget implementation
  const onRedraw = React.useCallback(({ layers }: { layers: Layer[] }) => {
    const isLoading = layers.some(layer => !layer.isLoaded);
    setLoading(prev => prev !== isLoading ? isLoading : prev);
  }, []);

  React.useImperativeHandle(ref, () => ({ onRedraw }), [onRedraw]);

  if (!loading) {
    return null;
  }

  // Determine position based on placement
  const positionStyles: React.CSSProperties = {
    position: 'absolute',
    zIndex: 2,
    ...(placement === 'top-left' && { top: '8px', left: '8px' }),
    ...(placement === 'top-right' && { top: '8px', right: '8px' }),
    ...(placement === 'bottom-left' && { bottom: '8px', left: '8px' }),
    ...(placement === 'bottom-right' && { bottom: '8px', right: '8px' }),
  };

  return (
    <div className="deck-widget-loading" style={positionStyles} title={label}>
      <div 
        style={{
          width: '24px',
          height: '24px',
          border: '3px solid rgba(255, 255, 255, 0.3)',
          borderTop: '3px solid rgba(255, 255, 255, 0.9)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

LoadingWidget.displayName = 'LoadingWidget';

export type { LoadingWidgetProps };

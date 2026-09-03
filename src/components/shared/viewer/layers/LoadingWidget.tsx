import type { Layer } from "@deck.gl/core";
import * as React from "react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";

type LoadingWidgetProps = {
  /** Widget positioning within the view. Default 'top-left'. */
  placement?:
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
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
>(({ placement = "top-left", label = "Loading layer data" }, ref) => {
  const [loading, setLoading] = React.useState(true);

  // onRedraw callback - matches the original Widget implementation
  const onRedraw = React.useCallback(({ layers }: { layers: Layer[] }) => {
    const isLoading = layers.some((layer) => !layer.isLoaded);
    setLoading((prev) => (prev !== isLoading ? isLoading : prev));
  }, []);

  React.useImperativeHandle(ref, () => ({ onRedraw }), [onRedraw]);

  if (!loading) {
    return null;
  }

  // Determine position based on placement
  const positionStyles: React.CSSProperties = {
    position: "absolute",
    zIndex: 2,
    ...(placement === "top-left" && { top: "8px", left: "8px" }),
    ...(placement === "top-right" && { top: "8px", right: "8px" }),
    ...(placement === "bottom-left" && { bottom: "8px", left: "8px" }),
    ...(placement === "bottom-right" && { bottom: "8px", right: "8px" }),
    ...(placement === "center" && {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    }),
  };

  return (
    <output
      className="deck-widget-loading"
      style={{ ...positionStyles, pointerEvents: "none" }}
      title={label}
      aria-live="polite"
      aria-label={label}
    >
      <div className={minervaTheme.spinnerMd} aria-hidden="true" />
    </output>
  );
});

LoadingWidget.displayName = "LoadingWidget";

export type { LoadingWidgetProps };

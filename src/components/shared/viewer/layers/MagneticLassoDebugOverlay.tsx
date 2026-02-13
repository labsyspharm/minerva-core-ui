import type { CSSProperties } from "react";
// biome-ignore lint/correctness/noUnusedImports: React must be in scope for JSX
import * as React from "react";
import { useOverlayStore } from "@/lib/stores";

const OVERLAY_SIZE = 220;

const containerStyle: CSSProperties = {
  position: "absolute",
  right: 8,
  bottom: 8,
  width: OVERLAY_SIZE,
  height: OVERLAY_SIZE,
  zIndex: 3,
  pointerEvents: "none",
  border: "1px solid rgba(255, 255, 255, 0.25)",
  borderRadius: 4,
  backgroundColor: "rgba(0, 0, 0, 0.45)",
  overflow: "hidden",
};

/**
 * A small debug overlay pinned to the bottom-right of the image viewer.
 * Currently renders as an empty frame; later it will display the exported
 * viewer raster and vector-field / edge visualizations for the magnetic lasso.
 */
export const MagneticLassoDebugOverlay = () => {
  const enabled = useOverlayStore(
    (state) => state.magneticLassoOverlayEnabled,
  );

  if (!enabled) {
    return null;
  }

  return <div style={containerStyle} />;
};

MagneticLassoDebugOverlay.displayName = "MagneticLassoDebugOverlay";

import { Chrome } from "@uiw/react-color";
import * as React from "react";
import { createPortal } from "react-dom";
import CloseIcon from "@/components/shared/icons/close.svg?react";

const BACKDROP_Z = 9998;
const PANEL_Z = 9999;

const backdropButtonStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: BACKDROP_Z,
  margin: 0,
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "default",
};

const panelFrameStyle: React.CSSProperties = {
  padding: "3px 8px 8px",
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
};

const closeRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  flexShrink: 0,
  marginBottom: 0,
};

const closeButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  margin: 0,
  padding: 0,
  border: "none",
  borderRadius: 4,
  background: "transparent",
  cursor: "pointer",
  color: "#5c5c5c",
};

const closeIconStyle: React.CSSProperties = {
  width: "12px",
  height: "12px",
  display: "block",
};

/** Clamp popover so it stays on-screen (channel + annotation pickers). */
export function chromeColorPickerAnchorPosition(rect: DOMRect): {
  top: number;
  left: number;
} {
  return {
    top: Math.min(rect.bottom + 4, window.innerHeight - 318),
    left: Math.min(rect.left, window.innerWidth - 252),
  };
}

export type ChromeColorPickerPopoverProps = {
  position: { top: number; left: number } | null;
  onClose: () => void;
} & Omit<React.ComponentProps<typeof Chrome>, "ref">;

/**
 * Fixed popover + transparent backdrop; close control in a row above the picker.
 * Popover triangle (Github `showTriangle`) is off so the panel is a simple rectangle.
 */
export function ChromeColorPickerPopover({
  position,
  onClose,
  ...chromeProps
}: ChromeColorPickerPopoverProps) {
  React.useEffect(() => {
    if (!position) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [position, onClose]);

  if (!position || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close color picker"
        style={backdropButtonStyle}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          zIndex: PANEL_Z,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          ...panelFrameStyle,
        }}
      >
        <div style={closeRowStyle}>
          <button
            type="button"
            title="Close"
            aria-label="Close color picker"
            style={closeButtonStyle}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0, 0, 0, 0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <CloseIcon aria-hidden style={closeIconStyle} />
          </button>
        </div>
        <Chrome {...chromeProps} showTriangle={false} />
      </div>
    </>,
    document.body,
  );
}

import type { HsvaColor } from "@uiw/color-convert";
import { color } from "@uiw/color-convert";
import type { Chrome } from "@uiw/react-color";
import type { AlphaProps } from "@uiw/react-color-alpha";
import Hue from "@uiw/react-color-hue";
import Saturation from "@uiw/react-color-saturation";
import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
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

const colorGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.5em",
};

const colorShownStyle: React.CSSProperties = {
  transition: "height 0.33s ease-out, opacity 0.33s ease-out",
};

const colorHiddenStyle: React.CSSProperties = {
  height: 0,
  opacity: 0,
  pointerEvents: "none",
  transition: "height 0.33s ease-out, opacity 0.33s ease-out",
};

const hueRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.5em 1fr",
};

const groupFolderChevron: React.CSSProperties = {
  all: "unset",
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  cursor: "pointer",
  color: "#8b949e",
  lineHeight: 0,
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

interface HueProps extends Omit<AlphaProps, "hsva" | "onChange"> {
  onChange?: (newHue: { h: number }) => void;
  hue: number;
}

export interface SaturationProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  prefixCls?: string;
  hsva?: HsvaColor;
  onChange?: (newColor: HsvaColor) => void;
}

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

  const currentColor = color(chromeProps.color);
  const [expanded, setExpanded] = React.useState(false);

  const hueProps: HueProps = {
    hue: currentColor.hsva.h,
    onChange: ({ h }) => {
      const { v, s } = currentColor.hsva;
      chromeProps.onChange(color({ h, v, s, a: 1 }));
    },
  };
  const saturationProps: SaturationProps = {
    hsva: currentColor.hsva,
    onChange: ({ h, v, s, a }) => {
      chromeProps.onChange(color({ h, v, s, a }));
    },
    style: expanded ? colorShownStyle : colorHiddenStyle,
  };

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
        <div style={colorGridStyle}>
          <div style={hueRowStyle}>
            <button
              type="button"
              style={groupFolderChevron}
              aria-expanded={expanded}
              title={expanded ? "Fewer colors" : "More colors"}
              onClick={() => setExpanded(!expanded)}
            >
              <div></div>
              <ChevronIcon direction={expanded ? "down" : "right"} />
              <div></div>
            </button>
            <Hue {...hueProps} />
          </div>
          <Saturation {...saturationProps} />
        </div>
      </div>
    </>,
    document.body,
  );
}

import type { HsvaColor } from "@uiw/color-convert";
import { type Chrome, hexToHsva, hsvaToHex } from "@uiw/react-color";
import type { AlphaProps } from "@uiw/react-color-alpha";
import Hue from "@uiw/react-color-hue";
import Saturation from "@uiw/react-color-saturation";
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

interface HueProps extends Omit<AlphaProps, "hsva" | "onChange"> {
  onChange?: (newHue: { h: number }) => void;
  hue: number;
}

export interface SaturationProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  prefixCls?: string;
  hsva?: HsvaColor;
  radius?: CSS.Properties<string | number>["borderRadius"];
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
  const hueProps: HueProps = {
    hue: hexToHsva(chromeProps.color).h,
    onChange: ({ h }) => {
      const { v, s } = hexToHsva(chromeProps.color);
      const hex = hsvaToHex({ h, v, s, a: 1 });
      chromeProps.onChange({ hex });
    },
  };
  const saturationProps: SaturationProps = {
    hsva: hexToHsva(chromeProps.color),
    onChange: ({ h, v, s, a }) => {
      const hex = hsvaToHex({ h, v, s, a });
      chromeProps.onChange({ hex });
    },
  };

  if (!position || typeof document === "undefined") return null;

  console.log(chromeProps, hexToHsva(chromeProps.color).h);

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
        <Hue {...hueProps} />
        <Saturation {...saturationProps} />
      </div>
    </>,
    document.body,
  );
}

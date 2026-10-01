import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import MoveIcon from "@/components/shared/icons/move.svg?react";
import ReflectHorizontalIcon from "@/components/shared/icons/reflect-horizontal.svg?react";
import ReflectVerticalIcon from "@/components/shared/icons/reflect-vertical.svg?react";
import Rotate90CcwIcon from "@/components/shared/icons/rotate-90-ccw.svg?react";
import Rotate90CwIcon from "@/components/shared/icons/rotate-90-cw.svg?react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import { PanelIconButton } from "@/components/shared/panel/PanelButtons";
import {
  effectiveOrientation,
  withOrientation,
  wrapDisplayDeg,
} from "@/lib/imaging/imageOrientation";
import { useAppStore } from "@/lib/stores/appStore";
import type { Image } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { setImageOrientation } from "@/lib/stores/storeUtils";
import styles from "./ImageOrientationRow.module.css";

function formatDeg(deg: number): string {
  const w = wrapDisplayDeg(deg);
  const rounded = Math.round(w * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function angleFromPointer(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  // atan2(dx, -dy): 0° at 12 o'clock, clockwise positive (Y-down screen).
  const rad = Math.atan2(clientX - cx, -(clientY - cy));
  return wrapDisplayDeg((rad * 180) / Math.PI);
}

function RotationKnob(props: {
  degrees: number;
  onLive: (deg: number) => void;
  onCommit: (deg: number) => void;
  onResetAngle: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const shiftStep = useRef(false);

  const applyPointer = useCallback(
    (
      e: { clientX: number; clientY: number; shiftKey: boolean },
      commit: boolean,
    ) => {
      const el = svgRef.current;
      if (!el) return;
      let deg = angleFromPointer(
        e.clientX,
        e.clientY,
        el.getBoundingClientRect(),
      );
      if (shiftStep.current || e.shiftKey) {
        deg = Math.round(deg * 10) / 10;
      }
      if (commit) props.onCommit(deg);
      else props.onLive(deg);
    },
    [props],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      applyPointer(e, false);
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      applyPointer(e, true);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [applyPointer]);

  const display = wrapDisplayDeg(props.degrees);
  const handleRad = (display * Math.PI) / 180;
  const hx = 20 + 14 * Math.sin(handleRad);
  const hy = 20 - 14 * Math.cos(handleRad);

  return (
    <div
      className={styles.knobButton}
      role="slider"
      tabIndex={0}
      aria-label="Rotation angle"
      aria-valuemin={-180}
      aria-valuemax={180}
      aria-valuenow={Math.round(display * 10) / 10}
      aria-valuetext={`${formatDeg(display)} degrees`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragging.current = true;
        shiftStep.current = e.shiftKey;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        applyPointer(e, false);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onResetAngle();
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 1;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          props.onCommit(wrapDisplayDeg(display - step));
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          props.onCommit(wrapDisplayDeg(display + step));
        } else if (e.key === "Home") {
          e.preventDefault();
          props.onResetAngle();
        }
      }}
    >
      <svg
        ref={svgRef}
        className={styles.knob}
        viewBox="0 0 40 40"
        width="26"
        height="26"
        aria-hidden
      >
        <title>Rotation dial</title>
        <circle
          cx="20"
          cy="20"
          r="15.5"
          className={styles.knobRing}
          fill="none"
        />
        <line x1="20" y1="4.5" x2="20" y2="8" className={styles.knobTick} />
        <line x1="20" y1="20" x2={hx} y2={hy} className={styles.knobArm} />
        <circle cx={hx} cy={hy} r="3.5" className={styles.knobHandle} />
      </svg>
    </div>
  );
}

/** Reflect / rotate controls. Placed above the image while orientation is open. */
export function ImageOrientationToolbar(props: {
  image: Image;
  style?: CSSProperties;
}) {
  const { image } = props;
  const setImages = useDocumentStore((s) => s.setImages);
  const preview = useAppStore((s) =>
    s.imageOrientationPreview?.imageId === image.id
      ? s.imageOrientationPreview.orientation
      : null,
  );
  const setPreview = useAppStore((s) => s.setImageOrientationPreview);

  const committed = effectiveOrientation(image);
  const live = preview ?? committed;
  const [textDraft, setTextDraft] = useState(() =>
    formatDeg(live.rotationDegrees),
  );

  useEffect(() => {
    if (preview) return;
    setTextDraft(formatDeg(committed.rotationDegrees));
  }, [committed.rotationDegrees, preview]);

  const commit = useCallback(
    (patch: Parameters<typeof withOrientation>[1]) => {
      const next = withOrientation(live, patch);
      setPreview(null);
      setImages(
        setImageOrientation(useDocumentStore.getState().images, image.id, next),
      );
      setTextDraft(formatDeg(next.rotationDegrees));
    },
    [image.id, live, setImages, setPreview],
  );

  const previewLive = useCallback(
    (patch: Parameters<typeof withOrientation>[1]) => {
      const next = withOrientation(live, patch);
      setPreview({ imageId: image.id, orientation: next });
      setTextDraft(formatDeg(next.rotationDegrees));
    },
    [image.id, live, setPreview],
  );

  const commitText = (raw: string) => {
    const parsed = Number.parseFloat(raw.replace(/°/g, "").trim());
    if (!Number.isFinite(parsed)) {
      setTextDraft(formatDeg(live.rotationDegrees));
      return;
    }
    commit({ rotationDegrees: parsed });
  };

  return (
    <div
      className={styles.toolbar}
      style={props.style}
      role="toolbar"
      aria-label="Image orientation"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <fieldset className={styles.section}>
        <legend className={styles.sectionLabel}>Reflect</legend>
        <div className={styles.row}>
          <PanelIconButton
            title="Flip horizontal"
            aria-label="Flip horizontal"
            aria-pressed={live.flipHorizontal}
            active={live.flipHorizontal}
            onClick={() => commit({ flipHorizontal: !live.flipHorizontal })}
          >
            <ReflectHorizontalIcon aria-hidden />
          </PanelIconButton>
          <PanelIconButton
            title="Flip vertical"
            aria-label="Flip vertical"
            aria-pressed={live.flipVertical}
            active={live.flipVertical}
            onClick={() => commit({ flipVertical: !live.flipVertical })}
          >
            <ReflectVerticalIcon aria-hidden />
          </PanelIconButton>
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.sectionLabel}>Rotate</legend>
        <div className={styles.row}>
          <PanelIconButton
            title="Rotate 90° counter-clockwise"
            aria-label="Rotate 90 degrees counter-clockwise"
            onClick={() =>
              commit({ rotationDegrees: live.rotationDegrees - 90 })
            }
          >
            <Rotate90CcwIcon aria-hidden />
          </PanelIconButton>
          <RotationKnob
            degrees={live.rotationDegrees}
            onLive={(deg) => previewLive({ rotationDegrees: deg })}
            onCommit={(deg) => commit({ rotationDegrees: deg })}
            onResetAngle={() => commit({ rotationDegrees: 0 })}
          />
          <PanelIconButton
            title="Rotate 90° clockwise"
            aria-label="Rotate 90 degrees clockwise"
            onClick={() =>
              commit({ rotationDegrees: live.rotationDegrees + 90 })
            }
          >
            <Rotate90CwIcon aria-hidden />
          </PanelIconButton>
          <div className={styles.degField}>
            <input
              className={`${minervaTheme.input} ${styles.degInput}`}
              type="text"
              inputMode="decimal"
              value={textDraft}
              aria-label="Rotation degrees"
              onChange={(e) => setTextDraft(e.target.value)}
              onBlur={(e) => commitText(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitText(e.currentTarget.value);
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setTextDraft(formatDeg(live.rotationDegrees));
                  e.currentTarget.blur();
                }
              }}
            />
            <span className={styles.degUnit} aria-hidden>
              °
            </span>
          </div>
        </div>
      </fieldset>
    </div>
  );
}

export function ImageOrientationRow(props: {
  /** Selection frame is showing for this image. */
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className={styles.menuWrap}>
      <PanelIconButton
        title="Drag"
        aria-label="Drag"
        aria-pressed={props.open}
        active={props.open}
        onClick={(e) => {
          e.stopPropagation();
          props.onToggle?.();
        }}
      >
        <MoveIcon aria-hidden />
      </PanelIconButton>
    </div>
  );
}

import { useRef, useState } from "react";
import ReflectHorizontalIcon from "@/components/shared/icons/reflect-horizontal.svg?react";
import ReflectVerticalIcon from "@/components/shared/icons/reflect-vertical.svg?react";
import Rotate90CcwIcon from "@/components/shared/icons/rotate-90-ccw.svg?react";
import Rotate90CwIcon from "@/components/shared/icons/rotate-90-cw.svg?react";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import {
  PanelActionButton,
  PanelIconButton,
} from "@/components/shared/panel/PanelButtons";
import {
  clampDisplayScale,
  flipOnScreen,
  isIdentityOrientation,
  withOrientation,
} from "@/lib/imaging/imageOrientation";
import { WORLD_MICRON } from "@/lib/imaging/worldFrame";
import type { ImageOrientation } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { setImageOrientation } from "@/lib/stores/storeUtils";
import styles from "./ImageArrangeToolbar.module.css";

const UNPLACED = {
  rotationDegrees: 0,
  flipHorizontal: false,
  flipVertical: false,
  translateX: 0,
  translateY: 0,
  displayScale: 1,
};

function formatNumber(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** A number in a text field. Enter or blur commits; Esc cancels. */
function NumberField(props: {
  label: string;
  prefix?: string;
  unit: string;
  /** Shown while the field is not being edited. */
  value: string;
  onCommit: (n: number) => void;
}) {
  const { label, prefix, unit, value, onCommit } = props;
  // Text while editing; otherwise the field follows the image, live.
  const [draft, setDraft] = useState<string | null>(null);
  const cancel = useRef(false);

  const finish = (raw: string) => {
    setDraft(null);
    const skip = cancel.current || raw === value;
    cancel.current = false;
    const n = Number.parseFloat(raw);
    if (!skip && Number.isFinite(n)) onCommit(n);
  };

  return (
    <label className={styles.field} title={label}>
      {prefix ? <span className={styles.prefix}>{prefix}</span> : null}
      <input
        className={`${minervaTheme.input} ${styles.input}`}
        type="text"
        inputMode="decimal"
        value={draft ?? value}
        aria-label={label}
        onFocus={(e) => {
          setDraft(e.currentTarget.value);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => finish(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            cancel.current = true;
            e.currentTarget.blur();
          }
        }}
      />
      <span aria-hidden>{unit}</span>
    </label>
  );
}

/** Docked above the canvas while an image is being arranged. */
export function ImageArrangeToolbar(props: {
  imageId: string;
  /** Live placement, including an in-flight canvas drag. */
  orientation: ImageOrientation;
}) {
  const { imageId, orientation: o } = props;

  const commit = (patch: Partial<ImageOrientation>) => {
    const doc = useDocumentStore.getState();
    doc.setImages(
      setImageOrientation(doc.images, imageId, withOrientation(o, patch)),
    );
  };

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Arrange image">
      <div className={styles.group}>
        <PanelIconButton
          title="Rotate left 90°"
          onClick={() => commit({ rotationDegrees: o.rotationDegrees - 90 })}
        >
          <Rotate90CcwIcon aria-hidden />
        </PanelIconButton>
        <PanelIconButton
          title="Rotate right 90°"
          onClick={() => commit({ rotationDegrees: o.rotationDegrees + 90 })}
        >
          <Rotate90CwIcon aria-hidden />
        </PanelIconButton>
        <NumberField
          label="Rotation"
          unit="°"
          value={formatNumber(o.rotationDegrees)}
          onCommit={(deg) => commit({ rotationDegrees: deg })}
        />
      </div>
      <div className={styles.group}>
        <PanelIconButton
          title="Flip horizontal"
          onClick={() => commit(flipOnScreen(o, "horizontal"))}
        >
          <ReflectHorizontalIcon aria-hidden />
        </PanelIconButton>
        <PanelIconButton
          title="Flip vertical"
          onClick={() => commit(flipOnScreen(o, "vertical"))}
        >
          <ReflectVerticalIcon aria-hidden />
        </PanelIconButton>
      </div>
      <div className={styles.group}>
        <NumberField
          label="Scale"
          prefix="Scale"
          unit="%"
          value={formatNumber(o.displayScale * 100)}
          onCommit={(pct) => {
            if (pct > 0) commit({ displayScale: clampDisplayScale(pct / 100) });
          }}
        />
        <NumberField
          label="Horizontal shift"
          prefix="X"
          unit={WORLD_MICRON}
          value={formatNumber(o.translateX)}
          onCommit={(x) => commit({ translateX: x })}
        />
        <NumberField
          label="Vertical shift"
          prefix="Y"
          unit={WORLD_MICRON}
          value={formatNumber(o.translateY)}
          onCommit={(y) => commit({ translateY: y })}
        />
      </div>
      <div className={styles.group}>
        <PanelActionButton
          disabled={isIdentityOrientation(o)}
          onClick={() => commit(UNPLACED)}
        >
          Reset
        </PanelActionButton>
      </div>
    </div>
  );
}

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  EyeIcon,
  EyeOffIcon,
} from "@/components/shared/channel/ChannelVisibilitySwatch";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import { clampImageOpacity } from "@/lib/imaging/imageOpacity";
import { useAppStore } from "@/lib/stores/appStore";
import { type Image, useDocumentStore } from "@/lib/stores/documentStore";
import { setImageOpacity } from "@/lib/stores/storeUtils";
import styles from "./ImageEye.module.css";
import { cx } from "./units";

function clearOpacityPreview(imageId: string) {
  const app = useAppStore.getState();
  if (app.imageOpacityPreview?.imageId === imageId) {
    app.setImageOpacityPreview(null);
  }
}

/**
 * An image's opacity in whole percent for a range input: `show` previews a
 * value in the viewer, `commit` saves the last shown one (one undo step),
 * `cancel` drops the preview.
 */
function useImageOpacity(image: Image) {
  const committed = Math.round(clampImageOpacity(image.opacity) * 100);
  const [pct, setPct] = useState(committed);
  const pctRef = useRef(committed);
  const last = useRef(committed);

  useEffect(() => {
    pctRef.current = committed;
    last.current = committed;
    setPct(committed);
  }, [committed]);
  useEffect(() => () => clearOpacityPreview(image.id), [image.id]);

  const show = (next: number) => {
    pctRef.current = next;
    setPct(next);
    useAppStore
      .getState()
      .setImageOpacityPreview({ imageId: image.id, opacity: next / 100 });
  };
  const commit = () => {
    const next = pctRef.current;
    if (next !== last.current) {
      last.current = next;
      const doc = useDocumentStore.getState();
      doc.setImages(setImageOpacity(doc.images, image.id, next / 100));
    }
    clearOpacityPreview(image.id);
  };
  const cancel = () => {
    pctRef.current = last.current;
    setPct(last.current);
    clearOpacityPreview(image.id);
  };
  return { pct, show, commit, cancel };
}

const POP_W = 200;
/** About the popover's height, to open it above when below won't fit. */
const POP_H = 64;

/**
 * An image's eye: open or crossed per `visible`, with its opacity beside it
 * when under 100%. A click opens a small popover holding the opacity slider
 * (0% hides the image); outside, Escape or scrolling the panel closes it.
 */
export function ImageEye(props: {
  image: Image;
  label: string;
  visible: boolean;
}) {
  const { image, label } = props;
  const { pct, show, commit, cancel } = useImageOpacity(image);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!at) return;
    const inside = (t: EventTarget | null) =>
      t instanceof Node &&
      (pop.current?.contains(t) || btn.current?.contains(t));
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target)) setAt(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAt(null);
      btn.current?.focus();
    };
    const onScroll = (e: Event) => {
      if (!inside(e.target)) setAt(null);
    };
    const onResize = () => setAt(null);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [at]);

  const toggle = () => {
    if (at) {
      setAt(null);
      return;
    }
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = r.bottom + 4;
    setAt({
      top:
        below + POP_H > window.innerHeight
          ? Math.max(8, r.top - 4 - POP_H)
          : below,
      left: Math.max(8, r.right - POP_W),
    });
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={cx(
          minervaTheme.focusRing,
          styles.eye,
          !props.visible && styles.off,
        )}
        title={`${props.visible ? "On screen" : "Not on screen"} · click for opacity`}
        aria-label={`${label} opacity, ${pct}%`}
        aria-expanded={Boolean(at)}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        {pct < 100 ? <span className={styles.pct}>{pct}%</span> : null}
        {props.visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
      {at
        ? createPortal(
            <div
              ref={pop}
              role="dialog"
              aria-label={`${label} opacity`}
              className={styles.pop}
              style={
                {
                  top: at.top,
                  left: at.left,
                  width: POP_W,
                  "--pct": `${pct}%`,
                } as CSSProperties
              }
            >
              <label className={styles.row}>
                <span>Opacity</span>
                <span className={styles.value}>{pct}%</span>
                <input
                  // biome-ignore lint/a11y/noAutofocus: opened by an explicit click; arrows step it at once.
                  autoFocus
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={pct}
                  className={styles.slider}
                  onChange={(e) => show(Number(e.target.value))}
                  onPointerUp={commit}
                  onPointerCancel={cancel}
                  onKeyUp={commit}
                  onBlur={commit}
                />
              </label>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

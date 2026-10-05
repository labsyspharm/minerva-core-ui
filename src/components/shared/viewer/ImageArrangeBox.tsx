import {
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import OrientationIcon from "@/components/shared/icons/orientation.svg?react";
import { ImageArrangeToolbar } from "@/components/shared/viewer/ImageArrangeToolbar";
import {
  clampDisplayScale,
  effectiveOrientation,
  orientationForImage,
  withOrientation,
} from "@/lib/imaging/imageOrientation";
import type { LoaderList } from "@/lib/imaging/loaderEntries";
import {
  layerModelMatrix,
  worldFrameFromLoader,
} from "@/lib/imaging/worldFrame";
import type { ImageOrientationPreview } from "@/lib/stores/appStore";
import { useAppStore } from "@/lib/stores/appStore";
import type { Image, ImageOrientation } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { setImageOrientation } from "@/lib/stores/storeUtils";
import styles from "./ImageArrangeBox.module.css";

type World = [number, number];

/** PowerPoint's eight handles, clockwise from top-left, as image fractions. */
const HANDLES: readonly World[] = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [1, 0.5],
  [1, 1],
  [0.5, 1],
  [0, 1],
  [0, 0.5],
];
const RESIZE_CURSORS = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];

/** Screen px from the top edge to the rotate knob. */
const ROTATE_OFFSET = 28;
const HANDLE_SIZE = 10;
const KNOB_RADIUS = 11;
/** Below this side length (screen px) only the corner handles show. */
const MIN_SIDE_FOR_EDGE_HANDLES = 48;
/** Shift-drag rotation step, as in PowerPoint. */
const SNAP_DEGREES = 15;

type Drag = {
  start: ImageOrientation;
  latest: ImageOrientation;
  apply: (world: World, e: PointerEvent) => ImageOrientation;
};

function clockDeg(world: World, center: World): number {
  const rad = Math.atan2(world[0] - center[0], -(world[1] - center[1]));
  return (rad * 180) / Math.PI;
}

/** Resize cursor for the on-screen anchor → handle direction. */
function resizeCursor(anchor: World, handle: World): string {
  const deg =
    (Math.atan2(handle[1] - anchor[1], handle[0] - anchor[0]) * 180) / Math.PI;
  return RESIZE_CURSORS[((Math.round(deg / 45) % 4) + 4) % 4];
}

function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable]") !== null
  );
}

/**
 * PowerPoint-style selection for one image: drag the body to move, a handle
 * to resize, the knob to rotate (Shift snaps to 15°). Esc or a click on the
 * empty canvas ends it.
 */
export function ImageArrangeBox(props: {
  imageId: string;
  images: Image[];
  loaders: LoaderList;
  preview: ImageOrientationPreview | null;
  project: (worldX: number, worldY: number) => [number, number];
  unproject: (clientX: number, clientY: number) => World | null;
  layoutRef: MutableRefObject<(() => void) | null>;
  /** Deck's event target. Wheel over the image is passed on so zoom works. */
  getCanvas: () => HTMLCanvasElement | null;
}) {
  const {
    imageId,
    images,
    loaders,
    preview,
    project,
    unproject,
    layoutRef,
    getCanvas,
  } = props;
  const [, setTick] = useState(0);
  const dragRef = useRef<Drag | null>(null);
  const unprojectRef = useRef(unproject);
  unprojectRef.current = unproject;
  const setPreview = useAppStore((s) => s.setImageOrientationPreview);
  const setArrangeImageId = useAppStore((s) => s.setArrangeImageId);

  useLayoutEffect(() => {
    layoutRef.current = () => setTick((n) => n + 1);
    return () => {
      layoutRef.current = null;
      if (dragRef.current) {
        dragRef.current = null;
        useAppStore.getState().setImageOrientationPreview(null);
      }
    };
  }, [layoutRef]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const world = unprojectRef.current(e.clientX, e.clientY);
      if (!world) return;
      drag.latest = drag.apply(world, e);
      setPreview({ imageId, orientation: drag.latest });
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      if (drag.latest !== drag.start) {
        const doc = useDocumentStore.getState();
        doc.setImages(setImageOrientation(doc.images, imageId, drag.latest));
      }
      setPreview(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (dragRef.current) {
        // Cancel the gesture; the image returns to where it started.
        dragRef.current = null;
        setPreview(null);
      } else if (!isTextField(e.target)) {
        setArrangeImageId(null);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [imageId, setPreview, setArrangeImageId]);

  const item = loaders.find((l) => l.sourceImageId === imageId);
  const o = orientationForImage(images, imageId, preview);
  if (!item || !o) return null;
  const { pixelWidth: w, pixelHeight: h } = worldFrameFromLoader(item.loader);
  if (w <= 1 || h <= 1) return null;

  // A flip maps the frame onto itself, so handles ignore it. The rotate knob
  // then stays on the visual top edge, as in PowerPoint.
  const frameO = { ...o, flipHorizontal: false, flipVertical: false };
  const frameMatrix = layerModelMatrix(item.loader, frameO);
  const worldAt = ([u, v]: World, m = frameMatrix): World => {
    const p = m.transformAsPoint([u * w, v * h, 0]);
    return [p[0], p[1]];
  };
  const points = HANDLES.map((uv) => project(...worldAt(uv)));
  if (points.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
    return null;
  }
  const [nw, n, ne, , se, , sw] = points;
  const center: World = [(nw[0] + se[0]) / 2, (nw[1] + se[1]) / 2];
  const up = Math.hypot(n[0] - center[0], n[1] - center[1]) || 1;
  const knob: World = [
    n[0] + ((n[0] - center[0]) / up) * ROTATE_OFFSET,
    n[1] + ((n[1] - center[1]) / up) * ROTATE_OFFSET,
  ];
  const showEdgeHandles =
    Math.min(
      Math.hypot(ne[0] - nw[0], ne[1] - nw[1]),
      Math.hypot(sw[0] - nw[0], sw[1] - nw[1]),
    ) >= MIN_SIDE_FOR_EDGE_HANDLES;

  const begin = (e: ReactPointerEvent<Element>, apply: Drag["apply"]) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { start: o, latest: o, apply };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is optional; the window listeners cover the gesture.
    }
  };

  const startMove = (e: ReactPointerEvent<Element>) => {
    const origin = unprojectRef.current(e.clientX, e.clientY);
    if (!origin) return;
    begin(e, (world, ev) => {
      let dx = world[0] - origin[0];
      let dy = world[1] - origin[1];
      // Shift keeps the move horizontal or vertical.
      if (ev.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      return effectiveOrientation({
        ...o,
        translateX: o.translateX + dx,
        translateY: o.translateY + dy,
      });
    });
  };

  // Uniform scale about the opposite handle, so µm/px stays true.
  const startResize = (e: ReactPointerEvent<Element>, i: number) => {
    const [u, v] = HANDLES[i];
    const anchorUv: World = [1 - u, 1 - v];
    const anchor = worldAt(anchorUv);
    const handle = worldAt(HANDLES[i]);
    const bare = layerModelMatrix(item.loader, {
      ...frameO,
      displayScale: 1,
      translateX: 0,
      translateY: 0,
    });
    const localAnchor = worldAt(anchorUv, bare);
    const centerUm = worldAt([0.5, 0.5], bare);
    const lx = localAnchor[0] - centerUm[0];
    const ly = localAnchor[1] - centerUm[1];
    const dx = handle[0] - anchor[0];
    const dy = handle[1] - anchor[1];
    const span = Math.hypot(dx, dy);
    if (span < 1e-6) return;
    begin(e, (world) => {
      const along =
        ((world[0] - anchor[0]) * dx + (world[1] - anchor[1]) * dy) / span;
      const displayScale = clampDisplayScale(o.displayScale * (along / span));
      return effectiveOrientation({
        ...o,
        displayScale,
        translateX: anchor[0] - centerUm[0] - displayScale * lx,
        translateY: anchor[1] - centerUm[1] - displayScale * ly,
      });
    });
  };

  const startRotate = (e: ReactPointerEvent<Element>) => {
    const pivot = worldAt([0.5, 0.5]);
    const origin = unprojectRef.current(e.clientX, e.clientY);
    if (!origin) return;
    const startAngle = clockDeg(origin, pivot);
    begin(e, (world, ev) => {
      let deg = o.rotationDegrees + (clockDeg(world, pivot) - startAngle);
      if (ev.shiftKey) deg = Math.round(deg / SNAP_DEGREES) * SNAP_DEGREES;
      return withOrientation(o, { rotationDegrees: deg });
    });
  };

  return (
    <div className={styles.layer}>
      <svg className={styles.frame} aria-hidden>
        <polygon
          className={styles.body}
          points={[nw, ne, se, sw].map((p) => p.join(",")).join(" ")}
          onPointerDown={startMove}
          onWheel={(e) =>
            getCanvas()?.dispatchEvent(new WheelEvent("wheel", e.nativeEvent))
          }
        />
        <line
          className={styles.stem}
          x1={n[0]}
          y1={n[1]}
          x2={knob[0]}
          y2={knob[1]}
        />
        {HANDLES.map(([u, v], i) =>
          i % 2 === 1 && !showEdgeHandles ? null : (
            <rect
              key={`${u},${v}`}
              className={styles.handle}
              x={points[i][0] - HANDLE_SIZE / 2}
              y={points[i][1] - HANDLE_SIZE / 2}
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              style={{ cursor: resizeCursor(points[(i + 4) % 8], points[i]) }}
              onPointerDown={(e) => startResize(e, i)}
            />
          ),
        )}
        <g
          className={styles.knob}
          transform={`translate(${knob[0]} ${knob[1]})`}
          onPointerDown={startRotate}
        >
          <title>Rotate</title>
          <circle r={KNOB_RADIUS} />
          <OrientationIcon x={-7} y={-7} width={14} height={14} />
        </g>
      </svg>
      <ImageArrangeToolbar imageId={imageId} orientation={o} />
    </div>
  );
}

import {
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ImageOrientationToolbar } from "@/components/shared/channel/ImageOrientationRow";
import OrientationIcon from "@/components/shared/icons/orientation.svg?react";
import {
  effectiveOrientation,
  orientationForImage,
  withOrientation,
} from "@/lib/imaging/imageOrientation";
import type { LoaderList } from "@/lib/imaging/loaderEntries";
import {
  imagePixelToWorld,
  worldFrameFromLoader,
} from "@/lib/imaging/worldFrame";
import type { ImageOrientationPreview } from "@/lib/stores/appStore";
import { useAppStore } from "@/lib/stores/appStore";
import type { Image, ImageOrientation } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { setImageOrientation } from "@/lib/stores/storeUtils";
import styles from "./ImageArrangeBox.module.css";

const CORNERS: readonly [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const CORNER_NAMES = ["nw", "ne", "se", "sw"] as const;

const MIN_SCALE = 0.02;
const MAX_SCALE = 100;

type World = [number, number];

type BoxModel = {
  imageId: string;
  width: number;
  height: number;
  orientation: ImageOrientation;
  points: World[];
  top: World;
  center: World;
  rotate: World;
  cursors: string[];
};

type Drag = {
  imageId: string;
  start: ImageOrientation;
  latest: ImageOrientation;
  moved: boolean;
  apply: (world: World) => ImageOrientation;
};

function clockDeg(world: World, center: World): number {
  const rad = Math.atan2(world[0] - center[0], -(world[1] - center[1]));
  return (rad * 180) / Math.PI;
}

function samePlacement(a: ImageOrientation, b: ImageOrientation): boolean {
  return (
    a.rotationDegrees === b.rotationDegrees &&
    a.translateX === b.translateX &&
    a.translateY === b.translateY &&
    a.displayScale === b.displayScale
  );
}

function resizeCursor(anchor: World, handle: World): string {
  const dx = handle[0] - anchor[0];
  const dy = handle[1] - anchor[1];
  return dx * dy >= 0 ? "nwse-resize" : "nesw-resize";
}

export function ImageArrangeBox(props: {
  images: Image[];
  loaders: LoaderList;
  preview: ImageOrientationPreview | null;
  project: (worldX: number, worldY: number) => [number, number];
  unproject: (clientX: number, clientY: number) => World | null;
  layoutRef: MutableRefObject<(() => void) | null>;
  /** Image whose move outline and handles are shown. */
  frameImageId?: string | null;
  /** Reflect / rotate bar above every image. */
  showToolbar?: boolean;
}) {
  const {
    images,
    loaders,
    preview,
    project,
    unproject,
    layoutRef,
    frameImageId = null,
    showToolbar = false,
  } = props;
  const [, setTick] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const unprojectRef = useRef(unproject);
  unprojectRef.current = unproject;
  const setPreview = useAppStore((s) => s.setImageOrientationPreview);

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

  const boxes: BoxModel[] = [];
  const seen = new Set<string>();
  for (const item of loaders) {
    const imageId = item.sourceImageId;
    if (!imageId || seen.has(imageId)) continue;
    const frame = worldFrameFromLoader(item.loader);
    if (frame.pixelWidth <= 1 || frame.pixelHeight <= 1) continue;
    const orientation = orientationForImage(images, imageId, preview);
    if (!orientation) continue;
    seen.add(imageId);
    const { pixelWidth: w, pixelHeight: h } = frame;
    const worldAt = (px: number, py: number) =>
      imagePixelToWorld(px, py, w, h, orientation);
    const points = CORNERS.map(([u, v]) => project(...worldAt(u * w, v * h)));
    if (points.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
      continue;
    }
    const top: World = [
      (points[0][0] + points[1][0]) / 2,
      (points[0][1] + points[1][1]) / 2,
    ];
    const center: World = [
      (points[0][0] + points[2][0]) / 2,
      (points[0][1] + points[2][1]) / 2,
    ];
    const dx = top[0] - center[0];
    const dy = top[1] - center[1];
    const len = Math.hypot(dx, dy) || 1;
    const rotate: World = [top[0] + (dx / len) * 28, top[1] + (dy / len) * 28];
    const cursors = CORNERS.map((_, i) =>
      resizeCursor(points[(i + 2) % 4], points[i]),
    );
    boxes.push({
      imageId,
      width: w,
      height: h,
      orientation,
      points,
      top,
      center,
      rotate,
      cursors,
    });
  }
  boxes.sort(
    (a, b) =>
      Number(a.imageId === draggingId) - Number(b.imageId === draggingId),
  );

  const begin = (
    e: ReactPointerEvent,
    imageId: string,
    start: ImageOrientation,
    apply: (world: World) => ImageOrientation,
  ) => {
    if (!unprojectRef.current(e.clientX, e.clientY)) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { imageId, start, latest: start, moved: false, apply };
    setDraggingId(imageId);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is optional; the window listeners cover the gesture.
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const world = unprojectRef.current(e.clientX, e.clientY);
      if (!world) return;
      drag.moved = true;
      drag.latest = drag.apply(world);
      setPreview({ imageId: drag.imageId, orientation: drag.latest });
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setDraggingId(null);
      if (!drag.moved || samePlacement(drag.start, drag.latest)) {
        if (drag.moved) setPreview(null);
        return;
      }
      useDocumentStore
        .getState()
        .setImages(
          setImageOrientation(
            useDocumentStore.getState().images,
            drag.imageId,
            drag.latest,
          ),
        );
      setPreview(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [setPreview]);

  if (boxes.length === 0) return null;

  return (
    <div className={styles.layer}>
      {boxes.map((box) => {
        const { width: w, height: h, orientation: o } = box;
        const bare = { ...o, displayScale: 1, translateX: 0, translateY: 0 };
        const image = images.find((im) => im.id === box.imageId);
        let toolbar = null;
        if (showToolbar && image) {
          const half = Math.hypot(
            box.top[0] - box.center[0],
            box.top[1] - box.center[1],
          );
          toolbar = (
            <ImageOrientationToolbar
              image={image}
              style={{
                left: box.center[0],
                // Stays above the unrotated top. A turn can cover the bar.
                top: Math.max(48, box.center[1] - half - 8),
              }}
            />
          );
        }
        return (
          <div key={box.imageId}>
            {frameImageId === box.imageId ? (
              <>
                <svg className={styles.frame}>
                  <title>Move image</title>
                  <polygon
                    className={styles.hit}
                    points={box.points.map((p) => p.join(",")).join(" ")}
                    onPointerDown={(e) => {
                      const origin = unprojectRef.current(e.clientX, e.clientY);
                      if (!origin) return;
                      begin(e, box.imageId, o, (world) =>
                        effectiveOrientation({
                          ...o,
                          translateX: o.translateX + (world[0] - origin[0]),
                          translateY: o.translateY + (world[1] - origin[1]),
                        }),
                      );
                    }}
                  />
                  <polygon
                    className={styles.edge}
                    points={box.points.map((p) => p.join(",")).join(" ")}
                  />
                  <line
                    className={styles.stem}
                    x1={box.top[0]}
                    y1={box.top[1]}
                    x2={box.rotate[0]}
                    y2={box.rotate[1]}
                  />
                </svg>
                {CORNERS.map((_, i) => {
                  const point = box.points[i];
                  const anchorPx = CORNERS[(i + 2) % 4];
                  return (
                    <button
                      key={CORNER_NAMES[i]}
                      type="button"
                      className={styles.handle}
                      style={{
                        left: point[0],
                        top: point[1],
                        cursor: box.cursors[i],
                      }}
                      aria-label="Resize image"
                      onPointerDown={(e) => {
                        const anchor = imagePixelToWorld(
                          anchorPx[0] * w,
                          anchorPx[1] * h,
                          w,
                          h,
                          o,
                        );
                        const handle = imagePixelToWorld(
                          CORNERS[i][0] * w,
                          CORNERS[i][1] * h,
                          w,
                          h,
                          o,
                        );
                        const localAnchor = imagePixelToWorld(
                          anchorPx[0] * w,
                          anchorPx[1] * h,
                          w,
                          h,
                          bare,
                        );
                        const centerUm = imagePixelToWorld(
                          w / 2,
                          h / 2,
                          w,
                          h,
                          bare,
                        );
                        const dx = handle[0] - anchor[0];
                        const dy = handle[1] - anchor[1];
                        const span = Math.hypot(dx, dy);
                        if (span < 1e-6) return;
                        const axis: World = [dx / span, dy / span];
                        begin(e, box.imageId, o, (world) => {
                          const along =
                            (world[0] - anchor[0]) * axis[0] +
                            (world[1] - anchor[1]) * axis[1];
                          const displayScale = Math.min(
                            MAX_SCALE,
                            Math.max(
                              MIN_SCALE,
                              o.displayScale * (along / span),
                            ),
                          );
                          const lx = localAnchor[0] - centerUm[0];
                          const ly = localAnchor[1] - centerUm[1];
                          return effectiveOrientation({
                            ...o,
                            displayScale,
                            translateX:
                              anchor[0] - centerUm[0] - displayScale * lx,
                            translateY:
                              anchor[1] - centerUm[1] - displayScale * ly,
                          });
                        });
                      }}
                    />
                  );
                })}
                <button
                  type="button"
                  className={`${styles.handle} ${styles.rotate}`}
                  style={{
                    left: box.rotate[0],
                    top: box.rotate[1],
                    // Button reset sets radius to 0; an inline value wins.
                    borderRadius: "50%",
                  }}
                  aria-label="Rotate image"
                  onPointerDown={(e) => {
                    const center = imagePixelToWorld(w / 2, h / 2, w, h, o);
                    const origin = unprojectRef.current(e.clientX, e.clientY);
                    if (!origin) return;
                    const startAngle = clockDeg(origin, center);
                    begin(e, box.imageId, o, (world) =>
                      withOrientation(o, {
                        rotationDegrees:
                          o.rotationDegrees +
                          (clockDeg(world, center) - startAngle),
                      }),
                    );
                  }}
                >
                  <OrientationIcon aria-hidden />
                </button>
              </>
            ) : null}
            {toolbar}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hook for SAM2 segmentation with iterative refinement.
 *
 * Session lifecycle:
 *   1. startSession(x, y)    — encode viewport + first decode (slow ~1-2s)
 *   2. refineSession(x, y, label) — decode only with accumulated points (fast ~50ms)
 *      repeat as many times as needed…
 *   3. confirmSession()       — finalize polygon as annotation
 *      -or- cancelSession()   — discard everything
 */

import * as React from "react";
import {
  computeImageViewRect,
  computeSamTransform,
  type SamTransform,
} from "@/lib/samViewport";
import { useOverlayStore } from "@/lib/stores";
import {
  maskFloatToCanvas,
  maskToPolygon,
  saveEncodedImageForDebug,
  sliceTensorMask,
} from "./imageUtils";

type WorkerMessage =
  | { type: "loadingInProgress" }
  | { type: "pong"; success: boolean; device: string }
  | { type: "encodeImageDone"; data: object }
  | {
      type: "decodeMaskResult";
      masks: { dims: readonly number[]; cpuData: Float32Array };
      iou_predictions: Float32Array;
    }
  | {
      type: "dinoPatchFeatures";
      data: { gridH: number; gridW: number; dim: number };
    }
  | {
      type: "findSimilarResult";
      data: {
        masks: { dims: readonly number[]; cpuData: Float32Array }[];
      };
    }
  | { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------

export interface Sam2PromptPoint {
  x: number; // image space
  y: number; // image space
  label: 0 | 1; // 1 = foreground, 0 = background
}

export interface Sam2Session {
  samTransform: SamTransform;
  points: Sam2PromptPoint[];
  currentMask256: Float32Array;
  previewPolygon: [number, number][];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MASK_SIZE = 256;

function maskToImagePolygon(
  mask256: Float32Array,
  transform: SamTransform,
  threshold = 0.25,
): [number, number][] {
  const maskScale = transform.samSize / MASK_SIZE;
  const maskSpacePolygon = maskToPolygon(
    mask256,
    0,
    0,
    MASK_SIZE,
    MASK_SIZE,
    threshold,
  );
  if (maskSpacePolygon.length < 3) return [];
  return maskSpacePolygon.map(([mx, my]) => {
    const samX = mx * maskScale;
    const samY = my * maskScale;
    const [imgX, imgY] = transform.samToImage([samX, samY]);
    return [imgX, imgY] as [number, number];
  });
}

function pickBestMask(iou: Float32Array): { idx: number; score: number } {
  if (iou.length === 0) return { idx: 0, score: 0 };
  let bestIdx = 0;
  for (let i = 1; i < iou.length; i++) {
    if (iou[i] > iou[bestIdx]) bestIdx = i;
  }
  return { idx: bestIdx, score: iou[bestIdx] };
}

function countForegroundRatio(
  mask: Float32Array,
  transform: SamTransform,
  threshold = 0.25,
): number {
  const { padX, padY, samSize } = transform;
  const contentFracX = (samSize - 2 * padX) / samSize;
  const contentFracY = (samSize - 2 * padY) / samSize;
  const contentPixels = MASK_SIZE * MASK_SIZE * contentFracX * contentFracY;
  if (contentPixels <= 0) return 1;
  let fg = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > threshold) fg++;
  }
  return fg / contentPixels;
}

const isDebug = () =>
  typeof localStorage !== "undefined" &&
  localStorage.getItem("sam2_debug") === "1";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSam2() {
  const workerRef = React.useRef<Worker | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const readyRef = React.useRef(false);
  const resolveEncodeRef = React.useRef<(() => void) | null>(null);
  const resolveDecodeRef = React.useRef<
    | ((result: {
        masks: { dims: readonly number[]; cpuData: Float32Array };
        iou_predictions: Float32Array;
      }) => void)
    | null
  >(null);

  const [session, setSession] = React.useState<Sam2Session | null>(null);
  const sessionRef = React.useRef<Sam2Session | null>(null);
  const [hasDinoFeatures, setHasDinoFeatures] = React.useState(false);
  const [similarPolygons, setSimilarPolygons] = React.useState<
    [number, number][][]
  >([]);

  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const sam2ImageFetcher = useOverlayStore((s) => s.sam2ImageFetcher);
  const finalizeLasso = useOverlayStore((s) => s.finalizeLasso);
  const setSam2Processing = useOverlayStore((s) => s.setSam2Processing);
  const setSam2DebugImages = useOverlayStore((s) => s.setSam2DebugImages);
  const imageWidth = useOverlayStore((s) => s.imageWidth);
  const imageHeight = useOverlayStore((s) => s.imageHeight);

  // ------- Worker lifecycle -------

  React.useEffect(() => {
    const worker = new Worker(new URL("./sam2.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === "loadingInProgress" || msg.type === "pong") {
        if (msg.type === "pong" && msg.success && msg.device) {
          setIsLoading(false);
          console.log(
            `[SAM2] Loaded, running on ${msg.device === "webgpu" ? "GPU (WebGPU)" : "CPU (WASM)"}`,
          );
        } else if (msg.type === "pong") {
          setIsLoading(false);
        }
        return;
      }
      if (msg.type === "encodeImageDone") {
        resolveEncodeRef.current?.();
        resolveEncodeRef.current = null;
        return;
      }
      if (msg.type === "decodeMaskResult") {
        resolveDecodeRef.current?.({
          masks: msg.masks,
          iou_predictions: msg.iou_predictions,
        });
        resolveDecodeRef.current = null;
        setIsProcessing(false);
        return;
      }
      if (msg.type === "dinoPatchFeatures") {
        setHasDinoFeatures(true);
        return;
      }
      if (msg.type === "findSimilarResult") {
        const currentSession = sessionRef.current;
        if (!currentSession) {
          setIsProcessing(false);
          useOverlayStore.getState().setSam2Processing(false);
          return;
        }
        const polys: [number, number][][] = [];
        for (const m of msg.data.masks) {
          const dims = m.dims;
          if (!Array.isArray(dims) || dims.length < 3) continue;
          const h = dims[dims.length - 2] ?? 0;
          const w = dims[dims.length - 1] ?? 0;
          if (h <= 0 || w <= 0) continue;
          const size = h * w;
          const mask256 = m.cpuData.slice(0, size);
          const poly = maskToImagePolygon(mask256, currentSession.samTransform);
          if (poly.length >= 3) polys.push(poly);
        }
        setSimilarPolygons(polys);
        setIsProcessing(false);
        useOverlayStore.getState().setSam2Processing(false);
        return;
      }
      if (msg.type === "error") {
        setError(msg.message);
        setIsLoading(false);
        setIsProcessing(false);
        useOverlayStore.getState().setSam2Processing(false);
        resolveEncodeRef.current?.();
        resolveDecodeRef.current = null;
      }
    };
    worker.onerror = (e) => {
      setError(e.message || "Worker error");
      setIsLoading(false);
      setIsProcessing(false);
      useOverlayStore.getState().setSam2Processing(false);
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const ensureReady = React.useCallback((): Promise<void> => {
    if (readyRef.current) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error("Worker not ready"));
        return;
      }
      const timeout = setTimeout(() => {
        worker.removeEventListener("message", handler);
        reject(new Error("SAM2 load timeout (2 min)"));
      }, 120_000);
      const handler = (e: MessageEvent<WorkerMessage>) => {
        if (e.data.type === "pong" && e.data.success) {
          clearTimeout(timeout);
          worker.removeEventListener("message", handler);
          readyRef.current = true;
          setIsReady(true);
          resolve();
        }
        if (e.data.type === "error") {
          clearTimeout(timeout);
          worker.removeEventListener("message", handler);
          reject(new Error(e.data.message));
        }
      };
      worker.addEventListener("message", handler);
      worker.postMessage({ type: "ping" });
    });
  }, []);

  const warmup = React.useCallback(async () => {
    setError(null);
    setIsLoading(true);
    useOverlayStore.getState().setSam2Processing(true);
    try {
      await ensureReady();
    } catch (e) {
      setError(e instanceof Error ? e.message : "SAM2 load failed");
    } finally {
      setIsLoading(false);
      useOverlayStore.getState().setSam2Processing(false);
    }
  }, [ensureReady]);

  // ------- Shared decode helper -------

  const waitForDecode = React.useCallback(() => {
    return new Promise<{
      masks: { dims: readonly number[]; cpuData: Float32Array };
      iou_predictions: Float32Array;
    }>((res, rej) => {
      resolveDecodeRef.current = res;
      setTimeout(() => {
        if (resolveDecodeRef.current) {
          resolveDecodeRef.current = null;
          rej(new Error("Decode timeout"));
        }
      }, 30_000);
    });
  }, []);

  const decodeMask = React.useCallback(
    async (
      points: Sam2PromptPoint[],
      samTransform: SamTransform,
      previousMask: Float32Array | null,
    ) => {
      const worker = workerRef.current;
      if (!worker) throw new Error("Worker not ready");

      const samPoints = points.map((p) => {
        const [sx, sy] = samTransform.imageToSam([p.x, p.y]);
        return { x: sx, y: sy, label: p.label };
      });

      worker.postMessage({
        type: "decodeMask",
        points: samPoints,
        maskArray: previousMask,
      });

      const result = await waitForDecode();
      const { idx, score } = pickBestMask(result.iou_predictions);
      const mask256 = sliceTensorMask(result.masks, idx);
      const polygon = maskToImagePolygon(mask256, samTransform);

      if (isDebug()) {
        const maskCanvas = maskFloatToCanvas(mask256, MASK_SIZE, MASK_SIZE);
        setSam2DebugImages({
          encoded: useOverlayStore.getState().sam2DebugImages?.encoded ?? "",
          mask: maskCanvas.toDataURL("image/png"),
        });
        console.log(
          `[SAM2 debug] IoU=${score.toFixed(3)} area=${countForegroundRatio(mask256, samTransform).toFixed(3)} pts=${points.length}`,
        );
      }

      return { mask256, polygon, iou: score };
    },
    [waitForDecode, setSam2DebugImages],
  );

  // ------- Session API -------

  const startSession = React.useCallback(
    async (clickX: number, clickY: number): Promise<boolean> => {
      if (!sam2ImageFetcher || !workerRef.current) {
        setError("No image loaded or worker not ready");
        return false;
      }

      const { sam2ViewState, sam2ViewportSize } = useOverlayStore.getState();
      if (!sam2ViewState || !sam2ViewportSize) {
        setError("Viewer state not available");
        return false;
      }

      setError(null);
      setIsProcessing(true);
      setSam2Processing(true);

      try {
        const imageShape = { x: imageWidth, y: imageHeight };
        const viewRect = computeImageViewRect(
          sam2ViewState,
          sam2ViewportSize,
          imageShape,
        );
        const samTransform = computeSamTransform(viewRect);

        // Fetch + encode (the slow part).
        const { float32Array, shape, dinoTensor } =
          await sam2ImageFetcher(viewRect);

        if (isDebug()) {
          const canvas = saveEncodedImageForDebug(
            float32Array,
            shape,
            clickX,
            clickY,
          );
          setSam2DebugImages({
            encoded: canvas.toDataURL("image/png"),
            mask: "",
          });
        }

        try {
          await ensureReady();
        } catch (e) {
          setError(e instanceof Error ? e.message : "SAM2 load failed");
          return false;
        }

        workerRef.current.postMessage({
          type: "encodeImage",
          float32Array,
          shape,
        });
        if (dinoTensor) {
          workerRef.current.postMessage({
            type: "encodeDinoImage",
            float32Array: dinoTensor.float32Array,
            shape: dinoTensor.shape,
            scaleXY: dinoTensor.scaleXY,
            gridHW: dinoTensor.gridHW,
          });
        }
        await new Promise<void>((res, rej) => {
          const t = setTimeout(() => {
            resolveEncodeRef.current = null;
            rej(new Error("Encode timeout"));
          }, 60_000);
          resolveEncodeRef.current = () => {
            clearTimeout(t);
            resolveEncodeRef.current = null;
            res();
          };
        });

        // First decode — single positive point, no prior mask.
        const firstPoint: Sam2PromptPoint = { x: clickX, y: clickY, label: 1 };
        const { mask256, polygon, iou } = await decodeMask(
          [firstPoint],
          samTransform,
          null,
        );

        // Quality gates (only for the initial click).
        const MIN_IOU = 0.5;
        if (iou < MIN_IOU) {
          console.log(
            `[SAM2] Rejected initial mask: IoU ${iou.toFixed(3)} < ${MIN_IOU}`,
          );
          setError("No clear object detected at click location");
          return false;
        }
        const MAX_AREA = 0.7;
        const area = countForegroundRatio(mask256, samTransform);
        if (area > MAX_AREA) {
          console.log(
            `[SAM2] Rejected initial mask: area ${area.toFixed(3)} > ${MAX_AREA}`,
          );
          setError("No clear object detected at click location");
          return false;
        }

        setSession({
          samTransform,
          points: [firstPoint],
          currentMask256: mask256,
          previewPolygon: polygon,
        });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setIsProcessing(false);
        setSam2Processing(false);
      }
    },
    [
      sam2ImageFetcher,
      imageWidth,
      imageHeight,
      ensureReady,
      decodeMask,
      setSam2Processing,
      setSam2DebugImages,
    ],
  );

  const refineSession = React.useCallback(
    async (clickX: number, clickY: number, label: 0 | 1): Promise<boolean> => {
      if (!session || !workerRef.current) return false;

      setError(null);
      setIsProcessing(true);
      setSam2Processing(true);

      try {
        const newPoint: Sam2PromptPoint = { x: clickX, y: clickY, label };
        const nextPoints = [...session.points, newPoint];

        // Decode with all accumulated points + previous mask for refinement.
        const { mask256, polygon } = await decodeMask(
          nextPoints,
          session.samTransform,
          session.currentMask256,
        );

        setSession({
          ...session,
          points: nextPoints,
          currentMask256: mask256,
          previewPolygon: polygon,
        });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setIsProcessing(false);
        setSam2Processing(false);
      }
    },
    [session, decodeMask, setSam2Processing],
  );

  const confirmSession = React.useCallback(() => {
    if (session && session.previewPolygon.length >= 3) {
      finalizeLasso(session.previewPolygon);
    }
    setSession(null);
    if (!isDebug()) setSam2DebugImages(null);
  }, [session, finalizeLasso, setSam2DebugImages]);

  const cancelSession = React.useCallback(() => {
    setSession(null);
    setError(null);
    if (!isDebug()) setSam2DebugImages(null);
  }, [setSam2DebugImages]);

  const findSimilar = React.useCallback(
    (config?: Partial<import("./similaritySearch").SimilarityConfig>) => {
      if (!session || !workerRef.current || !hasDinoFeatures) return;
      setError(null);
      setIsProcessing(true);
      setSam2Processing(true);
      workerRef.current.postMessage({
        type: "findSimilar",
        queryMask: session.currentMask256,
        maskSize: MASK_SIZE,
        config: config ?? {},
      });
    },
    [session, hasDinoFeatures, setSam2Processing],
  );

  return {
    session,
    startSession,
    refineSession,
    confirmSession,
    cancelSession,
    isLoading,
    isProcessing,
    error,
    isReady,
    warmup,
    hasDinoFeatures,
    findSimilar,
    similarPolygons,
    isAvailable: !!sam2ImageFetcher,
  };
}

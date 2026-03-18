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
  polygonToMask256,
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
  | {
      type: "findSimilarDebugResult";
      data: {
        candidates: Array<{
          peak: [number, number];
          negPeak: [number, number];
          box: [number, number, number, number];
        }>;
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

/** When enabled, Find Similar returns DINO candidate points only (no SAM2 decode). */
const isSimilarityDebugMode = () =>
  typeof localStorage !== "undefined" &&
  localStorage.getItem("sam2_similarity_debug") === "1";

// Shared singleton worker to avoid repeated model/session loads if the hook
// is ever remounted (e.g. due to parent subtree remounting).
let sharedSam2Worker: Worker | null = null;
let sharedSam2WorkerUsers = 0;

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
  const encodeWaiterRef = React.useRef<{
    resolve: () => void;
    reject: (e: Error) => void;
  } | null>(null);
  const dinoWaiterRef = React.useRef<{
    resolve: () => void;
    reject: (e: Error) => void;
  } | null>(null);
  const opChainRef = React.useRef<Promise<void>>(Promise.resolve());
  const findSimilarInFlightRef = React.useRef(false);
  const resolveDecodeRef = React.useRef<
    | ((result: {
        masks: { dims: readonly number[]; cpuData: Float32Array };
        iou_predictions: Float32Array;
      }) => void)
    | null
  >(null);

  const [session, setSession] = React.useState<Sam2Session | null>(null);
  const sessionRef = React.useRef<Sam2Session | null>(null);
  const lastSamTransformRef = React.useRef<SamTransform | null>(null);
  const pendingFindSimilarTargetIdRef = React.useRef<string | null>(null);
  const [pendingFindSimilarTargetId, setPendingFindSimilarTargetId] =
    React.useState<string | null>(null);
  const [hasDinoFeatures, setHasDinoFeatures] = React.useState(false);
  const [similarPolygons, setSimilarPolygons] = React.useState<
    [number, number][][]
  >([]);
  const [similarityDebugCandidates, setSimilarityDebugCandidates] =
    React.useState<{
      peaks: [number, number][];
      negPeaks: [number, number][];
    } | null>(null);

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
    if (!sharedSam2Worker) {
      sharedSam2Worker = new Worker(
        new URL("./sam2.worker.ts", import.meta.url),
        { type: "module" },
      );
    }
    sharedSam2WorkerUsers++;
    const worker = sharedSam2Worker;
    workerRef.current = worker;

    const onMessage = (e: MessageEvent<WorkerMessage>) => {
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
        encodeWaiterRef.current?.resolve();
        encodeWaiterRef.current = null;
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
        dinoWaiterRef.current?.resolve();
        dinoWaiterRef.current = null;
        return;
      }
      if (msg.type === "findSimilarDebugResult") {
        const samTransform =
          sessionRef.current?.samTransform ?? lastSamTransformRef.current;
        if (!samTransform) {
          setIsProcessing(false);
          useOverlayStore.getState().setSam2Processing(false);
          return;
        }
        const peaks: [number, number][] = [];
        const negPeaks: [number, number][] = [];
        for (const c of msg.data.candidates) {
          peaks.push(samTransform.samToImage(c.peak) as [number, number]);
          negPeaks.push(samTransform.samToImage(c.negPeak) as [number, number]);
        }
        setSimilarityDebugCandidates({ peaks, negPeaks });
        setSimilarPolygons([]);
        findSimilarInFlightRef.current = false;
        setIsProcessing(false);
        useOverlayStore.getState().setSam2Processing(false);
        return;
      }
      if (msg.type === "findSimilarResult") {
        console.log("[SAM2 findSimilar] Received findSimilarResult", {
          masksCount: msg.data?.masks?.length ?? 0,
        });
        const currentSession = sessionRef.current;
        const samTransform =
          currentSession?.samTransform ?? lastSamTransformRef.current;
        if (!samTransform) {
          console.warn("[SAM2 findSimilar] No samTransform, aborting");
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
          const poly = maskToImagePolygon(mask256, samTransform);
          if (poly.length >= 3) polys.push(poly);
        }
        const pendingTargetId = pendingFindSimilarTargetIdRef.current;
        console.log("[SAM2 findSimilar] Processed result", {
          masksReceived: msg.data.masks.length,
          polysExtracted: polys.length,
          pendingTargetId: pendingTargetId ?? "(none)",
        });
        if (pendingTargetId) {
          // Per-layer find similar: show preview overlays first. The user can
          // later Apply/Discard which will merge into the target annotation.
          setSimilarPolygons(polys);
          findSimilarInFlightRef.current = false;
        } else {
          setSimilarPolygons(polys);
        }
        setIsProcessing(false);
        useOverlayStore.getState().setSam2Processing(false);
        return;
      }
      if (msg.type === "error") {
        console.error("[SAM2] Worker error:", msg.message);
        setError(msg.message);
        setIsLoading(false);
        setIsProcessing(false);
        useOverlayStore.getState().setSam2Processing(false);
        encodeWaiterRef.current?.reject(new Error(msg.message));
        encodeWaiterRef.current = null;
        dinoWaiterRef.current?.reject(new Error(msg.message));
        dinoWaiterRef.current = null;
        pendingFindSimilarTargetIdRef.current = null;
        findSimilarInFlightRef.current = false;
        resolveDecodeRef.current = null;
      }
    };

    const onError = (e: ErrorEvent) => {
      setError(e.message || "Worker error");
      setIsLoading(false);
      setIsProcessing(false);
      useOverlayStore.getState().setSam2Processing(false);

      // Reject any pending operations so callers don't proceed to decode.
      const err = new Error(e.message || "Worker error");
      encodeWaiterRef.current?.reject(err);
      encodeWaiterRef.current = null;
      dinoWaiterRef.current?.reject(err);
      dinoWaiterRef.current = null;
      resolveDecodeRef.current = null;
      pendingFindSimilarTargetIdRef.current = null;
      findSimilarInFlightRef.current = false;
    };

    worker.addEventListener("message", onMessage as EventListener);
    worker.addEventListener("error", onError as EventListener);
    return () => {
      worker.removeEventListener("message", onMessage as EventListener);
      worker.removeEventListener("error", onError as EventListener);
      sharedSam2WorkerUsers = Math.max(0, sharedSam2WorkerUsers - 1);
      if (sharedSam2WorkerUsers === 0) {
        worker.terminate();
        sharedSam2Worker = null;
      }
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

  const waitForEncode = React.useCallback(() => {
    return new Promise<void>((res, rej) => {
      const t = setTimeout(() => {
        encodeWaiterRef.current = null;
        rej(new Error("Encode timeout"));
      }, 60_000);
      encodeWaiterRef.current = {
        resolve: () => {
          clearTimeout(t);
          encodeWaiterRef.current = null;
          res();
        },
        reject: (e: Error) => {
          clearTimeout(t);
          encodeWaiterRef.current = null;
          rej(e);
        },
      };
    });
  }, []);

  const waitForDino = React.useCallback(() => {
    return new Promise<void>((res, rej) => {
      const t = setTimeout(() => {
        dinoWaiterRef.current = null;
        rej(new Error("DINO encode timeout"));
      }, 120_000);
      dinoWaiterRef.current = {
        resolve: () => {
          clearTimeout(t);
          dinoWaiterRef.current = null;
          res();
        },
        reject: (e: Error) => {
          clearTimeout(t);
          dinoWaiterRef.current = null;
          rej(e);
        },
      };
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

  const runExclusive = React.useCallback(async <T>(fn: () => Promise<T>) => {
    const prev = opChainRef.current;
    let release: () => void = () => {};
    const gate = new Promise<void>((res) => {
      release = res;
    });
    opChainRef.current = prev.then(() => gate);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }, []);

  const encodeViewport = React.useCallback(async (): Promise<SamTransform> => {
    return await runExclusive(async () => {
      if (!sam2ImageFetcher || !workerRef.current) {
        throw new Error("No image loaded or worker not ready");
      }
      const { sam2ViewState, sam2ViewportSize } = useOverlayStore.getState();
      if (!sam2ViewState || !sam2ViewportSize) {
        throw new Error("Viewer state not available");
      }

      const imageShape = { x: imageWidth, y: imageHeight };
      const viewRect = computeImageViewRect(
        sam2ViewState,
        sam2ViewportSize,
        imageShape,
      );
      const samTransform = computeSamTransform(viewRect);
      lastSamTransformRef.current = samTransform;

      const fetched = (await sam2ImageFetcher(viewRect)) as unknown as {
        float32Array: Float32Array;
        shape: [number, number, number, number];
        dinoTensor?: {
          float32Array: Float32Array;
          shape: [number, number, number, number];
          scaleXY: [number, number];
          gridHW: [number, number];
        } | null;
      };

      // Similarity search requires a fresh DINO encode for this viewport; never
      // fall back to stale worker features from a previous encode.
      if (!fetched.dinoTensor) {
        setHasDinoFeatures(false);
        throw new Error("DINO features not available for this viewport");
      }

      await ensureReady();

      workerRef.current.postMessage({
        type: "encodeImage",
        float32Array: fetched.float32Array,
        shape: fetched.shape,
      });

      // Ensure callers don't race `findSimilar` against stale worker features.
      setHasDinoFeatures(false);
      workerRef.current.postMessage({
        type: "encodeDinoImage",
        float32Array: fetched.dinoTensor.float32Array,
        shape: fetched.dinoTensor.shape,
        scaleXY: fetched.dinoTensor.scaleXY,
        gridHW: fetched.dinoTensor.gridHW,
      });

      await waitForEncode();
      await waitForDino();
      return samTransform;
    });
  }, [
    sam2ImageFetcher,
    imageWidth,
    imageHeight,
    ensureReady,
    runExclusive,
    waitForEncode,
    waitForDino,
  ]);

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
        lastSamTransformRef.current = samTransform;

        // Fetch + encode (the slow part).
        const { float32Array, shape, dinoTensor } = (await sam2ImageFetcher(
          viewRect,
        )) as unknown as {
          float32Array: Float32Array;
          shape: [number, number, number, number];
          dinoTensor?: {
            float32Array: Float32Array;
            shape: [number, number, number, number];
            scaleXY: [number, number];
            gridHW: [number, number];
          } | null;
        };

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

        // Wait only for the SAM2 encoder — DINO finishes in the background.
        await waitForEncode();

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

        // Kick off DINO in the background *after* the first decode completes,
        // so segmentation latency is not dominated by DINO encode.
        setHasDinoFeatures(false);
        if (dinoTensor) {
          workerRef.current.postMessage({
            type: "encodeDinoImage",
            float32Array: dinoTensor.float32Array,
            shape: dinoTensor.shape,
            scaleXY: dinoTensor.scaleXY,
            gridHW: dinoTensor.gridHW,
          });
        }
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
      waitForEncode,
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

  const findSimilarForLayer = React.useCallback(
    async (
      annotationId: string,
      config?: Partial<import("./similaritySearch").SimilarityConfig>,
    ): Promise<void> => {
      if (!workerRef.current) throw new Error("Worker not ready");
      if (findSimilarInFlightRef.current) {
        console.log(
          "[SAM2 findSimilar] Skipped: find similar already in flight",
        );
        return;
      }
      console.log("[SAM2 findSimilar] Starting for layer", annotationId);
      setError(null);
      setIsProcessing(true);
      setSam2Processing(true);
      pendingFindSimilarTargetIdRef.current = annotationId;
      setPendingFindSimilarTargetId(annotationId);
      findSimilarInFlightRef.current = true;
      try {
        // If we already have DINO features + a recent transform (typically from
        // the last segmentation), skip the expensive re-encode path.
        const existingTransform = lastSamTransformRef.current;
        const skipEncode = hasDinoFeatures && existingTransform !== null;
        const samTransform = skipEncode
          ? existingTransform
          : await encodeViewport();
        console.log("[SAM2 findSimilar] Transform ready", {
          skipEncode,
          hasSamTransform: !!samTransform,
        });
        const state = useOverlayStore.getState();
        const target = state.annotations.find((a) => a.id === annotationId);
        if (!target || target.type !== "polygon") {
          throw new Error("Target layer is not a polygon");
        }
        const queryMask = polygonToMask256(target.polygon, samTransform);
        console.log("[SAM2 findSimilar] Posting findSimilar to worker", {
          queryMaskLength: queryMask.length,
          polygonVertices: target.polygon.length,
        });
        workerRef.current.postMessage({
          type: "findSimilar",
          queryMask,
          maskSize: MASK_SIZE,
          config: config ?? {},
          debug: isSimilarityDebugMode(),
        });
      } catch (e) {
        console.error("[SAM2 findSimilar] Error:", e);
        pendingFindSimilarTargetIdRef.current = null;
        setPendingFindSimilarTargetId(null);
        findSimilarInFlightRef.current = false;
        setError(e instanceof Error ? e.message : String(e));
        setIsProcessing(false);
        setSam2Processing(false);
      }
    },
    [encodeViewport, hasDinoFeatures, setSam2Processing],
  );

  const discardFindSimilar = React.useCallback(() => {
    pendingFindSimilarTargetIdRef.current = null;
    setPendingFindSimilarTargetId(null);
    findSimilarInFlightRef.current = false;
    setSimilarPolygons([]);
    setSimilarityDebugCandidates(null);
  }, []);

  const applyFindSimilar = React.useCallback(() => {
    const targetId = pendingFindSimilarTargetIdRef.current;
    if (!targetId || similarPolygons.length === 0) {
      discardFindSimilar();
      return;
    }
    const state = useOverlayStore.getState();
    const target = state.annotations.find((a) => a.id === targetId);
    const baseLabel = target?.metadata?.label ?? "layer";
    const fillColor = (
      target?.type === "polygon" && target.style?.fillColor
        ? target.style.fillColor
        : [128, 128, 128, 50]
    ) as [number, number, number, number];
    const lineColor = (
      target?.type === "polygon" && target.style?.lineColor
        ? target.style.lineColor
        : [128, 128, 128, 255]
    ) as [number, number, number, number];
    const lineWidth =
      target?.type === "polygon" && target.style?.lineWidth
        ? target.style.lineWidth
        : 3;

    for (let i = 0; i < similarPolygons.length; i++) {
      const polygon = similarPolygons[i];
      if (polygon.length < 3) continue;
      const annotation: import("@/lib/stores").PolygonAnnotation = {
        id: `poly-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        type: "polygon",
        polygon,
        style: { fillColor, lineColor, lineWidth },
        metadata: {
          createdAt: new Date(),
          label: `Similar ${i + 1} to ${baseLabel}`,
        },
      };
      state.addAnnotation(annotation);
    }
    discardFindSimilar();
  }, [discardFindSimilar, similarPolygons]);

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
    findSimilarForLayer,
    pendingFindSimilarTargetId,
    applyFindSimilar,
    discardFindSimilar,
    similarPolygons,
    similarityDebugCandidates,
    isSimilarityDebugMode: isSimilarityDebugMode,
    isAvailable: !!sam2ImageFetcher,
  };
}

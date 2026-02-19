/**
 * Hook to run SAM2 segmentation on magic wand click.
 */

import * as React from "react";
import { useOverlayStore } from "@/lib/stores";
import {
  sliceTensorMask,
  maskToPolygon,
  saveEncodedImageForDebug,
  maskFloatToCanvas,
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
  | { type: "error"; message: string };

export function useSam2() {
  const workerRef = React.useRef<Worker | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const resolveEncodeRef = React.useRef<(() => void) | null>(null);
  const resolveDecodeRef = React.useRef<
    ((result: { masks: { dims: readonly number[]; cpuData: Float32Array }; iou_predictions: Float32Array }) => void) | null
  >(null);

  const sam2ImageFetcher = useOverlayStore((s) => s.sam2ImageFetcher);
  const finalizeLasso = useOverlayStore((s) => s.finalizeLasso);
  const setSam2Processing = useOverlayStore((s) => s.setSam2Processing);
  const setSam2DebugImages = useOverlayStore((s) => s.setSam2DebugImages);
  const imageWidth = useOverlayStore((s) => s.imageWidth);
  const imageHeight = useOverlayStore((s) => s.imageHeight);

  React.useEffect(() => {
    const worker = new Worker(
      new URL("./sam2.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === "loadingInProgress" || msg.type === "pong") {
        if (msg.type === "pong" && msg.success && msg.device) {
          setIsLoading(false);
          console.log(`[SAM2] Loaded, running on ${msg.device === "webgpu" ? "GPU (WebGPU)" : "CPU (WASM)"}`);
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
    return new Promise((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error("Worker not ready"));
        return;
      }
      const timeout = setTimeout(() => {
        worker.removeEventListener("message", handler);
        reject(new Error("SAM2 load timeout (2 min)"));
      }, 120000);
      const handler = (e: MessageEvent<WorkerMessage>) => {
        if (e.data.type === "pong" && e.data.success) {
          clearTimeout(timeout);
          worker.removeEventListener("message", handler);
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

  const runSegmentation = React.useCallback(
    async (clickX: number, clickY: number): Promise<boolean> => {
      if (!sam2ImageFetcher || !workerRef.current) {
        setError("No image loaded or worker not ready");
        return false;
      }
      setError(null);
      setIsProcessing(true);
      setSam2Processing(true);

      try {
        const { float32Array, shape } = await sam2ImageFetcher(clickX, clickY);

        let encodedDataUrl: string | null = null;
        if (typeof localStorage !== "undefined" && localStorage.getItem("sam2_debug") === "1") {
          const canvas = saveEncodedImageForDebug(float32Array, shape, clickX, clickY);
          encodedDataUrl = canvas.toDataURL("image/png");
          setSam2DebugImages({ encoded: encodedDataUrl, mask: "" });
          console.log("[SAM2 debug] Encoded image ready");
        }

        const cropSize = 1024;
        const half = cropSize / 2;
        const cropOffsetX = Math.max(0, Math.floor(clickX - half));
        const cropOffsetY = Math.max(0, Math.floor(clickY - half));
        const cropW = Math.min(cropSize, imageWidth - cropOffsetX);
        const cropH = Math.min(cropSize, imageHeight - cropOffsetY);

        try {
          await ensureReady();
        } catch (e) {
          setError(e instanceof Error ? e.message : "SAM2 load failed");
          setIsProcessing(false);
          return false;
        }

        workerRef.current.postMessage({
          type: "encodeImage",
          float32Array,
          shape,
        });

        await new Promise<void>((res, rej) => {
          const t = setTimeout(() => {
            resolveEncodeRef.current = null;
            rej(new Error("Encode timeout"));
          }, 60000);
          resolveEncodeRef.current = () => {
            clearTimeout(t);
            resolveEncodeRef.current = null;
            res();
          };
        });

        const pointInCropX = Math.min(cropSize - 1, Math.max(0, clickX - cropOffsetX));
        const pointInCropY = Math.min(cropSize - 1, Math.max(0, clickY - cropOffsetY));
        const scaleTo1024 = 1024 / cropSize;
        const x1024 = pointInCropX * scaleTo1024;
        const y1024 = pointInCropY * scaleTo1024;

        workerRef.current.postMessage({
          type: "decodeMask",
          points: [{ x: x1024, y: y1024, label: 1 }],
        });

        const result = await new Promise<{
          masks: { dims: readonly number[]; cpuData: Float32Array };
          iou_predictions: Float32Array;
        }>((res, rej) => {
          resolveDecodeRef.current = res;
          setTimeout(() => {
            if (resolveDecodeRef.current) {
              resolveDecodeRef.current = null;
              rej(new Error("Decode timeout"));
            }
          }, 30000);
        });

        const iou = result.iou_predictions;
        const bestIdx = iou.length > 0
          ? Array.from(iou).reduce((best, v, i) => (v > iou[best] ? i : best), 0)
          : 0;

        const mask256 = sliceTensorMask(result.masks, bestIdx);

        if (typeof localStorage !== "undefined" && localStorage.getItem("sam2_debug") === "1") {
          const maskCanvas = maskFloatToCanvas(mask256, 256, 256);
          const maskDataUrl = maskCanvas.toDataURL("image/png");
          setSam2DebugImages({
            encoded: encodedDataUrl ?? "",
            mask: maskDataUrl,
          });
          console.log("[SAM2 debug] Images in overlay – right-click to save");
        } else {
          setSam2DebugImages(null);
        }

        const polygon = maskToPolygon(
          mask256,
          cropOffsetX,
          cropOffsetY,
          cropW,
          cropH,
        );

        if (polygon.length >= 3) {
          finalizeLasso(polygon);
          return true;
        }
        setError("No region detected");
        return false;
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
      finalizeLasso,
      setSam2Processing,
      setSam2DebugImages,
    ],
  );

  return {
    runSegmentation,
    isLoading,
    isProcessing,
    error,
    isAvailable: !!sam2ImageFetcher,
  };
}

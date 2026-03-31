/**
 * SAM2 Web Worker - runs encoder/decoder off main thread.
 */

import * as ort from "onnxruntime-web";
import "onnxruntime-web/webgpu";
import { sliceTensorMask } from "./imageUtils";
import { SAM2, type Sam2Point } from "./sam2";

// Normalize base: avoid "." which would produce origin + "." => "https://example.com." (invalid)
const rawBase =
  typeof import.meta.env?.BASE_URL === "string"
    ? import.meta.env.BASE_URL
    : "/";
const basePath =
  rawBase === "." || rawBase === "" ? "/" : rawBase.replace(/\/?$/, "/");
// Use an absolute URL so Vite treats this as a network fetch (not a module import),
// while still respecting the configured base path.
ort.env.wasm.wasmPaths = `${self.location.origin}${basePath}wasm/`;

let sam2: SAM2 | null = null;

async function ensureLoaded(): Promise<"webgpu" | "cpu"> {
  if (!sam2) {
    sam2 = new SAM2();
    return await sam2.load(ort);
  }
  return "cpu";
}

function pickBestMaskIdx(iou: Float32Array): number {
  if (iou.length === 0) return 0;
  let best = 0;
  for (let i = 1; i < iou.length; i++) {
    if (iou[i] > iou[best]) best = i;
  }
  return best;
}

// Serial message queue: ORT WebGPU sessions cannot handle concurrent run()
// calls on the same session. Since self.onmessage is async, concurrent
// messages would interleave at await-points and cause "session mismatch".
// Chain every handler onto this promise so they execute one at a time.
let messageQueue: Promise<void> = Promise.resolve();

self.onmessage = (
  e: MessageEvent<{ type: string; [key: string]: unknown }>,
) => {
  messageQueue = messageQueue.then(() => handleMessage(e));
};

async function handleMessage(
  e: MessageEvent<{ type: string; [key: string]: unknown }>,
): Promise<void> {
  const { type } = e.data;
  try {
    if (type === "ping") {
      self.postMessage({ type: "loadingInProgress" });
      const device = await ensureLoaded();
      self.postMessage({ type: "pong", success: true, device });
      return;
    }
    if (type === "encodeImage") {
      const data = e.data as unknown as {
        float32Array: Float32Array;
        shape: [number, number, number, number];
      };
      const { float32Array, shape } = data;
      if (!sam2) await ensureLoaded();
      if (!sam2) throw new Error("SAM2 not loaded");
      self.postMessage({ type: "loadingInProgress" });
      await sam2.encode(ort, float32Array, shape);
      self.postMessage({ type: "encodeImageDone", data: {} });
      return;
    }
    if (type === "decodeMask") {
      const data = e.data as unknown as {
        points: Sam2Point[];
        maskArray?: Float32Array | null;
        maskShape?: [number, number, number, number] | null;
      };
      const { points, maskArray } = data;
      if (!sam2) throw new Error("Encode first");
      const result = await sam2.decode(ort, points, maskArray ?? null);
      self.postMessage({
        type: "decodeMaskResult",
        masks: { dims: result.masks.dims, cpuData: result.masks.cpuData },
        iou_predictions: result.iou_predictions,
      });
      return;
    }
  } catch (err) {
    console.error("[SAM2 worker] Error in handleMessage:", err);
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

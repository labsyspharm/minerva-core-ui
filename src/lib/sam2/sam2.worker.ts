/**
 * SAM2 Web Worker - runs encoder/decoder off main thread.
 */

import * as ort from "onnxruntime-web";
import { SAM2, type Sam2Point } from "./sam2";

// Normalize base: avoid "." which would produce origin + "." => "https://example.com." (invalid)
const rawBase = typeof import.meta.env?.BASE_URL === "string" ? import.meta.env.BASE_URL : "/";
const basePath = rawBase === "." || rawBase === "" ? "/" : rawBase.replace(/\/?$/, "/");
ort.env.wasm.wasmPaths = `${self.location.origin}${basePath}wasm/`;

let sam2: SAM2 | null = null;

async function ensureLoaded(): Promise<"webgpu" | "cpu"> {
  if (!sam2) {
    sam2 = new SAM2();
    return await sam2.load(ort);
  }
  return "cpu";
}

self.onmessage = async (e: MessageEvent<{ type: string; [key: string]: unknown }>) => {
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
      const result = await sam2.decode(
        ort,
        points,
        maskArray ?? null,
      );
      self.postMessage({
        type: "decodeMaskResult",
        masks: { dims: result.masks.dims, cpuData: result.masks.cpuData },
        iou_predictions: result.iou_predictions,
      });
      return;
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

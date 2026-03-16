/**
 * SAM2 Web Worker - runs encoder/decoder off main thread.
 */

import * as ort from "onnxruntime-web";
import "onnxruntime-web/webgpu";
import { DINOv2 } from "./dinoV2";
import { SAM2, type Sam2Point } from "./sam2";
import { candidateToSamCoords, findSimilarRegions } from "./similaritySearch";

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
let dino: DINOv2 | null = null;
let lastDinoFeatures: {
  features: Float32Array;
  gridH: number;
  gridW: number;
  dim: number;
  scaleXY: [number, number];
} | null = null;

async function ensureLoaded(): Promise<"webgpu" | "cpu"> {
  if (!sam2) {
    sam2 = new SAM2();
    return await sam2.load(ort);
  }
  return "cpu";
}

self.onmessage = async (
  e: MessageEvent<{ type: string; [key: string]: unknown }>,
) => {
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
    if (type === "encodeDinoImage") {
      const data = e.data as unknown as {
        float32Array: Float32Array;
        shape: [number, number, number, number];
        scaleXY: [number, number];
        gridHW: [number, number];
      };
      if (!dino) {
        dino = new DINOv2();
      }
      const { float32Array, shape, scaleXY, gridHW } = data;
      const tensor = new ort.Tensor("float32", float32Array, shape);
      const encoded = await dino.encodeImage(tensor, scaleXY, gridHW);
      lastDinoFeatures = encoded;
      self.postMessage({
        type: "dinoPatchFeatures",
        data: {
          gridH: encoded.gridH,
          gridW: encoded.gridW,
          dim: encoded.dim,
        },
      });
      return;
    }
    if (type === "findSimilar") {
      const data = e.data as unknown as {
        queryMask: Float32Array;
        maskSize: number;
        config?: Partial<import("./similaritySearch").SimilarityConfig>;
      };
      if (!sam2 || !lastDinoFeatures) {
        throw new Error("DINO features not available for similarity search");
      }
      const { queryMask, maskSize, config } = data;
      const { features, gridH, gridW, dim, scaleXY } = lastDinoFeatures;
      const candidates = findSimilarRegions({
        patchFeatures: features,
        gridH,
        gridW,
        dim,
        queryMask,
        maskSize,
        config,
      });

      const samSize = 1024;
      const patchSize = 14;

      const masksOut: {
        dims: readonly number[];
        cpuData: Float32Array;
      }[] = [];

      for (const cand of candidates) {
        const { box, peak } = candidateToSamCoords(
          cand,
          patchSize,
          scaleXY,
          samSize,
        );
        const peakPoint: Sam2Point = {
          x: peak[0],
          y: peak[1],
          label: 1,
        };
        const result = await sam2.decode(ort, [peakPoint], null, [box]);
        masksOut.push({
          dims: result.masks.dims,
          cpuData: result.masks.cpuData,
        });
      }

      self.postMessage({
        type: "findSimilarResult",
        data: { masks: masksOut },
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

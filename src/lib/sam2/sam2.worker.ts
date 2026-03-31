/**
 * SAM2 Web Worker - runs encoder/decoder off main thread.
 */

import * as ort from "onnxruntime-web";
import "onnxruntime-web/webgpu";
import { DINOv2 } from "./dinoV2";
import { sliceTensorMask } from "./imageUtils";
import { SAM2, type Sam2Point } from "./sam2";
import type { SamContentBoundsSam } from "./similaritySearch";
import {
  candidateToSamCoords,
  DEFAULT_SIMILARITY_CONFIG,
  findSimilarRegions,
  samDecodeBoxForCandidate,
  samMaskPassesSizeRatio,
} from "./similaritySearch";

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
  samContentBounds?: SamContentBoundsSam | null;
} | null = null;

async function ensureLoaded(): Promise<"webgpu" | "cpu"> {
  if (!sam2) {
    sam2 = new SAM2();
    return await sam2.load(ort);
  }
  return "cpu";
}

const MASK_THRESH = 0.25;

function maskForegroundCount(mask: Float32Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > MASK_THRESH) n++;
  }
  return n;
}

function maskIoU(a: Float32Array, b: Float32Array): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    const va = a[i] > MASK_THRESH ? 1 : 0;
    const vb = b[i] > MASK_THRESH ? 1 : 0;
    if (va && vb) inter++;
    if (va || vb) union++;
  }
  return union > 0 ? inter / union : 0;
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
    if (type === "encodeDinoImage") {
      const data = e.data as unknown as {
        float32Array: Float32Array;
        shape: [number, number, number, number];
        scaleXY: [number, number];
        gridHW: [number, number];
        samContentBounds?: SamContentBoundsSam | null;
      };
      if (!dino) {
        dino = new DINOv2();
      }
      const { float32Array, shape, scaleXY, gridHW, samContentBounds } = data;
      const tensor = new ort.Tensor("float32", float32Array, shape);
      const encoded = await dino.encodeImage(tensor, scaleXY, gridHW);
      lastDinoFeatures = {
        ...encoded,
        samContentBounds: samContentBounds ?? null,
      };
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
        debug?: boolean;
      };
      const debug = data.debug === true;
      console.log("[SAM2 worker] findSimilar received", {
        hasSam2: !!sam2,
        hasLastDinoFeatures: !!lastDinoFeatures,
        queryMaskLength: data.queryMask?.length ?? 0,
        debug,
      });
      if (!lastDinoFeatures) {
        throw new Error("DINO features not available for similarity search");
      }
      if (!debug && !sam2) {
        throw new Error("SAM2 not available");
      }
      const { queryMask, maskSize, config: configOverrides } = data;
      const config = { ...DEFAULT_SIMILARITY_CONFIG, ...configOverrides };
      const { features, gridH, gridW, dim, scaleXY, samContentBounds } =
        lastDinoFeatures;
      const candidates = findSimilarRegions({
        patchFeatures: features,
        gridH,
        gridW,
        dim,
        queryMask,
        maskSize,
        scaleXY,
        samContentBounds: samContentBounds ?? null,
        config: configOverrides,
      });
      console.log("[SAM2 worker] findSimilarRegions returned", {
        candidatesCount: candidates.length,
      });

      const samSize = 1024;
      const patchSize = 14;
      /** DINO candidate peaks in SAM 1024 space (before SAM decode) — for UI dots. */
      const candidateMarkersSam = candidates.map((cand) => {
        const { peak, negPeak } = candidateToSamCoords(
          cand,
          patchSize,
          scaleXY,
          samSize,
        );
        return { peak, negPeak };
      });

      if (debug) {
        const debugCandidates = candidates.map((cand) => {
          const { box, peak, negPeak } = candidateToSamCoords(
            cand,
            patchSize,
            scaleXY,
            samSize,
          );
          return { peak, negPeak, box };
        });
        self.postMessage({
          type: "findSimilarDebugResult",
          data: { candidates: debugCandidates },
        });
        return;
      }

      const queryArea = maskForegroundCount(queryMask);
      const rawMasks: Float32Array[] = [];
      for (const cand of candidates) {
        const {
          box: componentBox,
          peak,
          negPeak,
        } = candidateToSamCoords(cand, patchSize, scaleXY, samSize);
        const decodeBox = samDecodeBoxForCandidate(
          peak,
          componentBox,
          samSize,
          samContentBounds ?? null,
          config.samDecodePeakRadiusSam,
        );
        const points: Sam2Point[] = [
          { x: peak[0], y: peak[1], label: 1 },
          { x: negPeak[0], y: negPeak[1], label: 0 },
        ];
        if (!sam2) throw new Error("SAM2 not loaded");
        const result = await sam2.decode(ort, points, null, [decodeBox]);
        const bestIdx = pickBestMaskIdx(result.iou_predictions);
        const mask256 = sliceTensorMask(
          { dims: result.masks.dims, cpuData: result.masks.cpuData },
          bestIdx,
        );

        const maskArea = maskForegroundCount(mask256);
        if (!samMaskPassesSizeRatio(maskArea, queryArea, config)) {
          console.log("[SAM2 worker] findSimilar skip size filter", {
            maskArea,
            queryArea,
            ratio:
              queryArea > 0 ? Number((maskArea / queryArea).toFixed(2)) : null,
            smallQuery: queryArea < config.skipSizeRatioIfQueryAreaBelow,
          });
          continue;
        }

        rawMasks.push(mask256);
      }

      // IoU dedup (plan Step 4): keep masks with IoU < dedupIou to others
      const masksOut: { dims: readonly number[]; cpuData: Float32Array }[] = [];
      const size = 256 * 256;
      for (const m of rawMasks) {
        let dup = false;
        for (const kept of masksOut) {
          if (maskIoU(m, kept.cpuData) >= config.dedupIou) {
            dup = true;
            break;
          }
        }
        if (!dup) {
          masksOut.push({ dims: [1, 1, 256, 256], cpuData: m });
        }
      }

      console.log("[SAM2 worker] findSimilar posting result", {
        rawCount: rawMasks.length,
        afterDedup: masksOut.length,
      });
      self.postMessage({
        type: "findSimilarResult",
        data: { masks: masksOut, candidateMarkers: candidateMarkersSam },
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

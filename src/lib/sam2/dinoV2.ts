/**
 * DINOv2 encoder for similarity search.
 * Uses onnx-community/dinov2-base-ONNX with WebGPU-first execution.
 */

import * as ort from "onnxruntime-web";

/**
 * Quantized Dinov2-base ONNX (~90MB). The fp16 export (`model_fp16.onnx`) fails to load on
 * several ORT builds (broken LayerNorm fusion) and fp16 I/O is easy to mis-read in JS.
 */
const DINO_MODEL_URL =
  "https://huggingface.co/onnx-community/dinov2-base-ONNX/resolve/main/onnx/model_quantized.onnx";

type ExecutionProvider = "webgpu" | "cpu";

/** IEEE 754 half → float32 (ORT may expose fp16 as raw uint16). */
function float16ToFloat32Bits(bits: number): number {
  const h = bits & 0xffff;
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const m = h & 0x03ff;
  if (e === 0) {
    const sub = m * 2 ** -24 * (s ? -1 : 1);
    return sub;
  }
  if (e === 31) {
    return m ? Number.NaN : s ? -Infinity : Infinity;
  }
  const exp = e - 15;
  const frac = 1 + m / 1024;
  return (s ? -1 : 1) * frac * 2 ** exp;
}

async function tensorCpuData(t: ort.Tensor): Promise<ArrayBufferView> {
  const loc = t.location;
  if (loc === "cpu" || loc === "cpu-pinned") {
    return t.data as ArrayBufferView;
  }
  return (await t.getData(true)) as ArrayBufferView;
}

function tensorToFloat32Linear(
  t: ort.Tensor,
  raw: ArrayBufferView,
): Float32Array {
  const size = t.dims.reduce((a, b) => a * b, 1);
  const out = new Float32Array(size);
  if (t.type === "float32" && raw instanceof Float32Array) {
    out.set(raw);
    return out;
  }
  if (t.type === "float16") {
    if (typeof Float16Array !== "undefined" && raw instanceof Float16Array) {
      out.set(raw);
      return out;
    }
    const u16 = raw as Uint16Array;
    for (let i = 0; i < size; i++) {
      out[i] = float16ToFloat32Bits(u16[i] ?? 0);
    }
    return out;
  }
  throw new Error(`[DINOv2] Unsupported output element type: ${t.type}`);
}

type HiddenLayout = "btd" | "bdt";

function resolveHiddenLayout(
  dims: readonly number[],
  expectedTokens: number,
): { numTokens: number; dim: number; layout: HiddenLayout } {
  if (dims.length !== 3) {
    throw new Error(
      `[DINOv2] Unexpected output dims ${JSON.stringify(dims)}; expected rank-3`,
    );
  }
  const a = dims[1];
  const b = dims[2];
  if (a === undefined || b === undefined) {
    throw new Error(`[DINOv2] Invalid output dims ${JSON.stringify(dims)}`);
  }
  if (a === expectedTokens && b !== expectedTokens) {
    return { numTokens: a, dim: b, layout: "btd" };
  }
  if (b === expectedTokens && a !== expectedTokens) {
    return { numTokens: b, dim: a, layout: "bdt" };
  }
  if (a === expectedTokens && b === expectedTokens) {
    throw new Error(
      `[DINOv2] Ambiguous last_hidden_state shape [1,${a},${b}] for ${expectedTokens} tokens`,
    );
  }
  throw new Error(
    `[DINOv2] last_hidden_state token dim mismatch: got [1,${a},${b}], expected one axis == ${expectedTokens} (1+gridH*gridW)`,
  );
}

function stripClsToPatchFeatures(
  data: Float32Array,
  layout: HiddenLayout,
  numTokens: number,
  dim: number,
): Float32Array {
  const patchCount = numTokens - 1;
  const features = new Float32Array(patchCount * dim);
  if (layout === "btd") {
    const skip = dim;
    features.set(data.subarray(skip, skip + patchCount * dim));
    return features;
  }
  for (let t = 1; t < numTokens; t++) {
    const dst = (t - 1) * dim;
    for (let d = 0; d < dim; d++) {
      features[dst + d] = data[d * numTokens + t];
    }
  }
  return features;
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if ("storage" in navigator && "getDirectory" in navigator.storage) {
      return await navigator.storage.getDirectory();
    }
  } catch {
    // OPFS not available
  }
  return null;
}

async function fetchWithCache(
  url: string,
  opfsRoot: FileSystemDirectoryHandle | null,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const name = url.split("/").pop() || "model";
  if (opfsRoot) {
    try {
      const handle = await opfsRoot.getFileHandle(name, { create: false });
      const file = await handle.getFile();
      return await file.arrayBuffer();
    } catch {
      // Not cached, fall through to network fetch.
    }
  }
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  if (opfsRoot) {
    try {
      const handle = await opfsRoot.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(buffer);
      await writable.close();
    } catch {
      // Cache write failed; continue with in-memory model.
    }
  }
  return buffer;
}

export type DinoEncoded = {
  /** Patch features flattened to [numPatches * dim]. CLS token is stripped. */
  features: Float32Array;
  /** Number of patch rows and columns. */
  gridH: number;
  gridW: number;
  /** Feature dimension (e.g. 768 for dinov2-base). */
  dim: number;
  /** Scale from SAM crop (1024×1024) to DINO input resolution. */
  scaleXY: [number, number];
};

export class DINOv2 {
  private buffer: ArrayBuffer | null = null;
  private session: [ort.InferenceSession, ExecutionProvider] | null = null;
  private lastEncoded: DinoEncoded | null = null;

  async downloadModel(signal?: AbortSignal): Promise<void> {
    const opfsRoot = await getOpfsRoot();
    this.buffer = await fetchWithCache(DINO_MODEL_URL, opfsRoot, signal);
  }

  private async createSession(): Promise<
    [ort.InferenceSession, ExecutionProvider]
  > {
    if (!this.buffer) {
      await this.downloadModel();
    }
    if (!this.buffer) {
      throw new Error("DINOv2 model buffer not available");
    }
    const providers: ExecutionProvider[] = ["webgpu", "cpu"];
    for (const ep of providers) {
      try {
        const session = await ort.InferenceSession.create(this.buffer, {
          executionProviders: [ep],
          graphOptimizationLevel: "all",
        } as unknown as ort.InferenceSession.SessionOptions);
        return [session, ep];
      } catch (e) {
        console.warn(`[DINOv2] Session create failed for ${ep}:`, e);
      }
    }
    throw new Error("[DINOv2] Could not create session with webgpu or cpu");
  }

  async getSession(): Promise<[ort.InferenceSession, ExecutionProvider]> {
    if (this.session) return this.session;
    this.session = await this.createSession();
    return this.session;
  }

  /**
   * Encode an image tensor and cache flattened patch features for similarity search.
   * The input tensor should already be preprocessed with ImageNet mean/std
   * and have shape [1, 3, H, W]. scaleXY and gridHW come from canvasToFloat32ArrayDINO.
   */
  async encodeImage(
    inputTensor: ort.Tensor,
    scaleXY: [number, number],
    gridHW: [number, number],
  ): Promise<DinoEncoded> {
    const [session] = await this.getSession();
    const inputName = session.inputNames[0] ?? "pixel_values";
    const results = await session.run({ [inputName]: inputTensor });

    const outputName = session.outputNames[0] ?? "last_hidden_state";
    const out = results[outputName] as ort.Tensor;
    const dims = out.dims;
    const [gridH, gridW] = gridHW;
    const expectedPatches = gridH * gridW;
    const expectedTokens = 1 + expectedPatches;

    const raw = await tensorCpuData(out);
    const linear = tensorToFloat32Linear(out, raw);
    const { numTokens, dim, layout } = resolveHiddenLayout(
      dims,
      expectedTokens,
    );

    if (linear.length !== numTokens * dim) {
      throw new Error(
        `[DINOv2] Output data length ${linear.length} does not match tokens*dim=${numTokens * dim}`,
      );
    }

    const features = stripClsToPatchFeatures(linear, layout, numTokens, dim);

    const encoded: DinoEncoded = {
      features,
      gridH,
      gridW,
      dim,
      scaleXY,
    };
    this.lastEncoded = encoded;
    return encoded;
  }

  getLastEncoded(): DinoEncoded | null {
    return this.lastEncoded;
  }
}

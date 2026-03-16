/**
 * DINOv2 encoder for similarity search.
 * Uses onnx-community/dinov2-base-ONNX with WebGPU-first execution.
 */

import * as ort from "onnxruntime-web";

const DINO_MODEL_URL =
  "https://huggingface.co/onnx-community/dinov2-base-ONNX/resolve/main/onnx/model_fp16.onnx";

type ExecutionProvider = "webgpu" | "cpu";

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
    if (dims.length !== 3) {
      throw new Error(
        `[DINOv2] Unexpected output dims ${JSON.stringify(dims)}; expected [1, numTokens, dim]`,
      );
    }

    const [, numTokens, dim] = dims;
    // First token is CLS; remaining tokens are patches on a gridH*gridW layout.
    const [gridH, gridW] = gridHW;
    const expectedPatches = gridH * gridW;
    const patchTokens = numTokens - 1;
    if (patchTokens !== expectedPatches) {
      console.warn(
        `[DINOv2] Patch token count ${patchTokens} != gridH*gridW=${expectedPatches}`,
      );
    }

    const data = out.data as Float32Array;
    const totalTokens = numTokens;
    if (data.length !== totalTokens * dim) {
      throw new Error(
        `[DINOv2] Output data length ${data.length} does not match tokens*dim=${totalTokens * dim}`,
      );
    }

    const features = new Float32Array((totalTokens - 1) * dim);
    // Strip CLS token (index 0) and flatten patches.
    for (let t = 1; t < totalTokens; t++) {
      const srcOffset = t * dim;
      const dstOffset = (t - 1) * dim;
      features.set(data.subarray(srcOffset, srcOffset + dim), dstOffset);
    }

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

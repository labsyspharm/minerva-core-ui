/**
 * SAM2 class for browser-based segmentation.
 * Loads encoder/decoder from Hugging Face, runs in Web Worker.
 */

const ENCODER_URL =
  "https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_encoder.with_runtime_opt.ort";
const DECODER_URL =
  "https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_decoder_pr1.onnx";

export type Sam2Point = { x: number; y: number; label: number };

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
      // Not cached, fetch and cache
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
      // Cache write failed, continue with in-memory
    }
  }
  return buffer;
}

export class SAM2 {
  private encoderSession: import("onnxruntime-web").InferenceSession | null = null;
  private decoderSession: import("onnxruntime-web").InferenceSession | null = null;
  private embedding: {
    high_res_feats_0: import("onnxruntime-web").Tensor;
    high_res_feats_1: import("onnxruntime-web").Tensor;
    image_embed: import("onnxruntime-web").Tensor;
  } | null = null;

  async load(ort: typeof import("onnxruntime-web"), signal?: AbortSignal): Promise<"webgpu" | "cpu"> {
    const opfsRoot = await getOpfsRoot();
    const encoderBuffer = await fetchWithCache(ENCODER_URL, opfsRoot, signal);
    const decoderBuffer = await fetchWithCache(DECODER_URL, opfsRoot, signal);

    let device: "webgpu" | "cpu" = "cpu";
    const providers: Array<"webgpu" | "wasm"> = ["webgpu", "wasm"];

    try {
      this.encoderSession = await ort.InferenceSession.create(encoderBuffer, {
        executionProviders: providers,
        graphOptimizationLevel: "all",
      });
      device = "webgpu";
      console.log("[SAM2] Encoder: WebGPU");
    } catch {
      try {
        this.encoderSession = await ort.InferenceSession.create(encoderBuffer, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
        console.log("[SAM2] Encoder: CPU (WASM)");
      } catch (e) {
        throw new Error(`Encoder load failed: ${e}`);
      }
    }

    try {
      this.decoderSession = await ort.InferenceSession.create(decoderBuffer, {
        executionProviders: providers,
        graphOptimizationLevel: "all",
      });
      if (device === "webgpu") console.log("[SAM2] Decoder: WebGPU");
    } catch {
      try {
        this.decoderSession = await ort.InferenceSession.create(decoderBuffer, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
        if (device === "cpu") console.log("[SAM2] Decoder: CPU (WASM)");
      } catch (e) {
        throw new Error(`Decoder load failed: ${e}`);
      }
    }

    console.log(`[SAM2] Running on ${device === "webgpu" ? "GPU (WebGPU)" : "CPU (WASM)"}`);
    return device;
  }

  async encode(
    ort: typeof import("onnxruntime-web"),
    float32Array: Float32Array,
    shape: [number, number, number, number],
    signal?: AbortSignal,
  ): Promise<void> {
    if (!this.encoderSession) throw new Error("Encoder not loaded");
    const imageTensor = new ort.Tensor("float32", float32Array, shape);
    const feeds = { image: imageTensor };
    const results = await this.encoderSession.run(feeds);
    this.embedding = {
      high_res_feats_0: results.high_res_feats_0,
      high_res_feats_1: results.high_res_feats_1,
      image_embed: results.image_embed,
    };
  }

  async decode(
    ort: typeof import("onnxruntime-web"),
    points: Sam2Point[],
    maskArray: Float32Array | null,
    signal?: AbortSignal,
  ): Promise<{ masks: { dims: readonly number[]; cpuData: Float32Array }; iou_predictions: Float32Array }> {
    if (!this.decoderSession || !this.embedding) throw new Error("Not encoded");

    const n = points.length;
    const pointCoords = new Float32Array(1 * n * 2);
    const pointLabels = new Float32Array(1 * n);
    points.forEach((p, i) => {
      pointCoords[i * 2] = p.x;
      pointCoords[i * 2 + 1] = p.y;
      pointLabels[i] = p.label;
    });

    const maskInputArray = maskArray ?? new Float32Array(256 * 256);
    const feeds: Record<string, import("onnxruntime-web").Tensor> = {
      image_embed: this.embedding.image_embed,
      high_res_feats_0: this.embedding.high_res_feats_0,
      high_res_feats_1: this.embedding.high_res_feats_1,
      point_coords: new ort.Tensor("float32", pointCoords, [1, n, 2]),
      point_labels: new ort.Tensor("float32", pointLabels, [1, n]),
      mask_input: new ort.Tensor("float32", maskInputArray, [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor("float32", new Float32Array([maskArray ? 1 : 0]), [1]),
    };

    const results = await this.decoderSession.run(feeds);
    const masks = results.masks as import("onnxruntime-web").Tensor;
    const iou = results.iou_predictions as import("onnxruntime-web").Tensor;
    return {
      masks: { dims: masks.dims, cpuData: masks.data as Float32Array },
      iou_predictions: iou.data as Float32Array,
    };
  }
}

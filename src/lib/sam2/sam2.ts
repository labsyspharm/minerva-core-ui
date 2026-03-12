/**
 * SAM2 class for browser-based segmentation.
 * Uses ONNX-community sam2.1-hiera-tiny-ONNX encoder/decoder with WebGPU.
 */

const ENCODER_MODEL_URL =
  "https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/resolve/main/onnx/vision_encoder.onnx";
const ENCODER_DATA_URL =
  "https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/resolve/main/onnx/vision_encoder.onnx_data";
const DECODER_MODEL_URL =
  "https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/resolve/main/onnx/prompt_encoder_mask_decoder.onnx";
const DECODER_DATA_URL =
  "https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/resolve/main/onnx/prompt_encoder_mask_decoder.onnx_data";

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

type ExecutionProvider = "webgpu" | "cpu";

export class SAM2 {
  private encoderSession: import("onnxruntime-web").InferenceSession | null =
    null;
  private decoderSession: import("onnxruntime-web").InferenceSession | null =
    null;
  /**
   * Cached encoder outputs keyed by tensor name. These are fed back into
   * the decoder, which expects multiple embeddings (image, high-res feats, etc.).
   */
  private encodedTensors: Record<
    string,
    import("onnxruntime-web").Tensor
  > | null = null;

  /**
   * Try webgpu then cpu; return [session, provider] on success.
   * Mirrors the working onnx-test implementation's session creation logic.
   */
  private async createSession(
    ort: typeof import("onnxruntime-web"),
    model: ArrayBuffer,
    externalData?: { data: Uint8Array; path: string }[],
  ): Promise<[import("onnxruntime-web").InferenceSession, ExecutionProvider]> {
    const providers: ExecutionProvider[] = ["webgpu", "cpu"];
    for (const ep of providers) {
      try {
        const session = await ort.InferenceSession.create(model, {
          executionProviders: [ep],
          ...(externalData ? { externalData } : {}),
          graphOptimizationLevel: "all",
        } as unknown as import("onnxruntime-web").InferenceSession.SessionOptions);
        return [session, ep];
      } catch (e) {
        console.warn(`[SAM2] Session create failed for ${ep}:`, e);
      }
    }
    throw new Error("[SAM2] Could not create session with webgpu or cpu");
  }

  async load(
    ort: typeof import("onnxruntime-web"),
    signal?: AbortSignal,
  ): Promise<"webgpu" | "cpu"> {
    const opfsRoot = await getOpfsRoot();
    const [
      encoderModelBuffer,
      encoderDataBuffer,
      decoderModelBuffer,
      decoderDataBuffer,
    ] = await Promise.all([
      fetchWithCache(ENCODER_MODEL_URL, opfsRoot, signal),
      fetchWithCache(ENCODER_DATA_URL, opfsRoot, signal),
      fetchWithCache(DECODER_MODEL_URL, opfsRoot, signal),
      fetchWithCache(DECODER_DATA_URL, opfsRoot, signal),
    ]);

    const encoderExternalData = [
      {
        data: new Uint8Array(encoderDataBuffer),
        path: "vision_encoder.onnx_data",
      },
    ];
    const decoderExternalData = [
      {
        data: new Uint8Array(decoderDataBuffer),
        path: "prompt_encoder_mask_decoder.onnx_data",
      },
    ];

    // Prefer WebGPU, fall back to CPU. Try each EP separately, as in onnx-test.
    const [encoderSession, encoderDevice] = await this.createSession(
      ort,
      encoderModelBuffer,
      encoderExternalData,
    );
    const [decoderSession] = await this.createSession(
      ort,
      decoderModelBuffer,
      decoderExternalData,
    );

    this.encoderSession = encoderSession;
    this.decoderSession = decoderSession;

    const device: "webgpu" | "cpu" = encoderDevice;
    console.log(
      `[SAM2] Running on ${device === "webgpu" ? "GPU (WebGPU)" : "CPU (CPU execution provider)"}`,
    );
    return device;
  }

  async encode(
    ort: typeof import("onnxruntime-web"),
    float32Array: Float32Array,
    shape: [number, number, number, number],
  ): Promise<void> {
    if (!this.encoderSession) throw new Error("Encoder not loaded");
    const imageTensor = new ort.Tensor("float32", float32Array, shape);

    // Use the first (and only) encoder input name, e.g. "pixel_values".
    const inputName = this.encoderSession.inputNames[0];
    const results = await this.encoderSession.run({ [inputName]: imageTensor });

    const encodedTensors: Record<string, import("onnxruntime-web").Tensor> = {};
    for (const name of Object.keys(results)) {
      encodedTensors[name] = results[name] as import("onnxruntime-web").Tensor;
    }
    this.encodedTensors = encodedTensors;
  }

  async decode(
    ort: typeof import("onnxruntime-web"),
    points: Sam2Point[],
    maskArray: Float32Array | null,
  ): Promise<{
    masks: { dims: readonly number[]; cpuData: Float32Array };
    iou_predictions: Float32Array;
  }> {
    if (!this.decoderSession || !this.encodedTensors) {
      throw new Error("Image must be encoded before decode()");
    }

    const n = points.length;

    // Flatten points into [1, 1, n, 2] for input_points / point_coords
    const pointCoords = new Float32Array(1 * 1 * n * 2);
    const pointLabels = new BigInt64Array(1 * 1 * n);
    for (let i = 0; i < n; i++) {
      const base = i * 2;
      pointCoords[base] = points[i]?.x ?? 0;
      pointCoords[base + 1] = points[i]?.y ?? 0;
      pointLabels[i] = BigInt(points[i]?.label ?? 0);
    }

    const maskInputArray = maskArray ?? new Float32Array(256 * 256);
    const hasMaskInputFlag = new BigInt64Array([maskArray ? 1n : 0n]);

    const feeds: Record<string, import("onnxruntime-web").Tensor> = {};

    const encodedTensors = this.encodedTensors;
    for (const name of this.decoderSession.inputNames) {
      if (encodedTensors?.[name]) {
        // image embeddings / high-res features produced by the encoder.
        feeds[name] = encodedTensors[name] as import("onnxruntime-web").Tensor;
        continue;
      }

      if (name === "input_points" || name === "point_coords") {
        feeds[name] = new ort.Tensor("float32", pointCoords, [1, 1, n, 2]);
      } else if (name === "input_labels" || name === "point_labels") {
        feeds[name] = new ort.Tensor("int64", pointLabels, [1, 1, n]);
      } else if (name === "input_boxes") {
        // No boxes used in this UI.
        feeds[name] = new ort.Tensor("float32", new Float32Array(0), [1, 0, 4]);
      } else if (name === "mask_input") {
        feeds[name] = new ort.Tensor(
          "float32",
          maskInputArray,
          [1, 1, 256, 256],
        );
      } else if (name === "has_mask_input") {
        feeds[name] = new ort.Tensor("int64", hasMaskInputFlag, [1]);
      }
    }

    const results = await this.decoderSession.run(feeds);
    const outputNames = this.decoderSession.outputNames;
    if (outputNames.length < 2) {
      throw new Error(
        `Unexpected number of decoder outputs: ${outputNames.length}`,
      );
    }

    const out0 = results[outputNames[0]] as import("onnxruntime-web").Tensor;
    const out1 = results[outputNames[1]] as import("onnxruntime-web").Tensor;

    // Heuristic: masks are high-rank (H×W per mask), IoU scores are small.
    const out0IsMasks =
      out0.dims.length >= 4 || out0.data.length > out1.data.length;

    const masksTensor = out0IsMasks ? out0 : out1;
    const iouTensor = out0IsMasks ? out1 : out0;

    return {
      masks: {
        dims: masksTensor.dims,
        cpuData: masksTensor.data as Float32Array,
      },
      iou_predictions: iouTensor.data as Float32Array,
    };
  }
}

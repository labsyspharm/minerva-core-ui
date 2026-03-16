# SAM2 in the Browser with WebGPU and ONNX-Community Weights

This document explains how to go from a **“classic” ONNX Runtime Web-only SAM2 setup** to a **transformers.js-style pipeline** that uses the ONNX-community `sam2.1-hiera-tiny-ONNX` model in the browser with WebGPU.

It assumes you already have a React/Vite app that:
- Loads an image onto a `<canvas>`,
- Sends it to a Web Worker for inference,
- Renders segmentation masks as overlays.

---

## 1. Old vs New Architecture: High-Level

### 1.1 Classic (ORT-only) Approach

In a “main-branch-style” implementation:

- **Model loading**
  - You download:
    - A single **encoder** file (often `.ort` or `.onnx`),
    - A single **decoder** file (`.onnx`),
  - And create two `onnxruntime-web` `InferenceSession`s.

- **Preprocessing**
  - On the main thread:
    - Resize the canvas to `1024×1024`,
    - Convert RGBA to float32 tensor `[1, 3, 1024, 1024]`,
    - Normalize by `/255` (and possibly mean/std).

- **Interactive segmentation**
  - Web Worker:
    - `encodeImage(tensor)` once → caches `image_embed` + high-res features,
    - On each click, `decode(points, prev_mask)` → outputs `[1, num_masks, H, W]` and IoU scores.

- **Postprocessing**
  - Main thread:
    - Pick best IoU,
    - Slice one `[H, W]` mask,
    - Convert to an overlay canvas and draw.

This is all built directly on `onnxruntime-web` and some custom image helpers.

### 1.2 New (Transformers.js-style + ONNX-community) Approach

The new approach is conceptually similar but driven by the **ONNX-community SAM2.1 model naming/layout** and is organized like a transformers.js pipeline:

- **Model source**: `onnx-community/sam2.1-hiera-tiny-ONNX`
  - Encoder: `onnx/vision_encoder.onnx` + `vision_encoder.onnx_data`
  - Decoder: `onnx/prompt_encoder_mask_decoder.onnx` + `prompt_encoder_mask_decoder.onnx_data`

- **Loading**:
  - Use `onnxruntime-web` with the `externalData` mechanism to load `.onnx` + `.onnx_data` pairs.
  - Favor WebGPU, with CPU fallback.

- **Preprocessing**:
  - Still use a canvas-based pipeline, but match **HF’s `preprocessor_config.json`**:
    - `size: 1024×1024`,
    - `rescale_factor = 1/255`,
    - `image_mean` / `image_std` (ImageNet-style),
    - `data_format: "channels_first"`.

- **Interactive segmentation**:
  - Web Worker holds a singleton `SAM2` helper that:
    - Downloads and caches models,
    - Encodes the current image once,
    - Decodes on each prompt, matching the decoder’s **actual input names and dtypes** (`input_points`, `input_labels` (int64), `image_embeddings.*`, etc.).

- **Postprocessing**:
  - Main thread:
    - Receives `{ masks: { dims, cpuData }, iou_predictions }`,
    - Selects best mask, slices `[H, W]`, and renders just like before.

---

## 2. Dependencies and Setup

### 2.1 Dependencies

Add:

- `onnxruntime-web` (already present in many ORT-based setups),
- Optionally `@huggingface/transformers` if you want to grow into full transformers.js later (not strictly required for the current worker-based flow).

Example `package.json` snippet:

```json
"dependencies": {
  "onnxruntime-web": "^1.24.1",
  "@huggingface/transformers": "^3.5.0",
  "react": "...",
  "react-dom": "..."
}
```

### 2.2 WebGPU Backend

Ensure you import the WebGPU backend where you create sessions:

```ts
import * as ort from 'onnxruntime-web'
import 'onnxruntime-web/webgpu'
```

Then you can prefer WebGPU but fall back to CPU:

```ts
const providers: ExecutionProvider[] = ['webgpu', 'cpu']

const session = await ort.InferenceSession.create(modelBuffer, {
  executionProviders: providers,
})
```

---

## 3. SAM2 Helper Class (Encoder + Decoder)

This helper encapsulates the ONNX-community model layout: downloading, caching, creating sessions, encoding, and decoding.

Key ideas:

- **Download both main graph and external weights**:
  - `vision_encoder.onnx` + `vision_encoder.onnx_data`
  - `prompt_encoder_mask_decoder.onnx` + `prompt_encoder_mask_decoder.onnx_data`
- **Use `externalData`** when creating sessions.
- **Cache all encoder outputs** into a `Record<string, ort.Tensor>` so that decoding can feed them by name.

Conceptually:

```ts
class SAM2 {
  private bufferEncoder: ArrayBuffer | null = null
  private bufferDecoder: ArrayBuffer | null = null
  private encoderExternalData: { data: Uint8Array; path: string }[] | null = null
  private decoderExternalData: { data: Uint8Array; path: string }[] | null = null
  private sessionEncoder: [ort.InferenceSession, ExecutionProvider] | null = null
  private sessionDecoder: [ort.InferenceSession, ExecutionProvider] | null = null
  private imageEncoded: Record<string, ort.Tensor> | null = null

  async downloadModels() {
    // fetch encoder .onnx and .onnx_data, decoder .onnx and .onnx_data
    // optionally cache them via navigator.storage
  }

  private async createSession(model: ArrayBuffer, externalData?: { data: Uint8Array; path: string }[]) {
    // ExecutionProvider: webgpu → cpu
    return await ort.InferenceSession.create(model, {
      executionProviders: ['webgpu', 'cpu'],
      ...(externalData ? { externalData } : {}),
    })
  }

  async createSessions() {
    // create encoder/decoder sessions with externalData lists
  }

  async encodeImage(inputTensor: ort.Tensor) {
    const [session] = await this.getEncoderSession()
    const inputName = session.inputNames[0] // often "pixel_values"
    const results = await session.run({ [inputName]: inputTensor })

    const encoded: Record<string, ort.Tensor> = {}
    for (const name of session.outputNames) {
      encoded[name] = results[name] as ort.Tensor
    }
    this.imageEncoded = encoded
  }

  async decode(points, maskInput?): Promise<{ masks: ort.Tensor; iou_predictions: ort.Tensor }> {
    const [session] = await this.getDecoderSession()
    if (!this.imageEncoded) throw new Error('Image not encoded')

    // Flatten and prepare prompts
    const flatPoints = points.flatMap((p) => [p.x, p.y])
    const flatLabels = points.map((p) => p.label)

    const maskInputTensor =
      maskInput ??
      new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256])
    const hasMaskInput = new ort.Tensor(
      'int64',
      BigInt64Array.from([maskInput ? 1n : 0n]),
      [1],
    )

    const feeds: Record<string, ort.Tensor> = {}

    for (const name of session.inputNames) {
      if (this.imageEncoded[name]) {
        // image_embeddings.0, high_res_feats.0, high_res_feats.1, etc.
        feeds[name] = this.imageEncoded[name]
      } else if (name === 'input_points' || name === 'point_coords') {
        feeds[name] = new ort.Tensor('float32', flatPoints, [1, 1, points.length, 2])
      } else if (name === 'input_labels' || name === 'point_labels') {
        const labelsInt64 = BigInt64Array.from(flatLabels.map((v) => BigInt(v)))
        feeds[name] = new ort.Tensor('int64', labelsInt64, [1, 1, points.length])
      } else if (name === 'input_boxes') {
        feeds[name] = new ort.Tensor('float32', new Float32Array(0), [1, 0, 4])
      } else if (name === 'mask_input') {
        feeds[name] = maskInputTensor
      } else if (name === 'has_mask_input') {
        feeds[name] = hasMaskInput
      }
    }

    const results = await session.run(feeds)
    const out0 = results[session.outputNames[0]] as ort.Tensor
    const out1 = results[session.outputNames[1]] as ort.Tensor

    // Heuristic to decide which output is masks vs IoUs
    const firstIsMasks = (out0.dims.length >= 4) || (out0.data.length > out1.data.length)
    const masks = firstIsMasks ? out0 : out1
    const iou_predictions = firstIsMasks ? out1 : out0

    return { masks, iou_predictions }
  }
}
```

This abstracts away ONNX file structure and naming differences from your React UI.

---

## 4. Web Worker for On-the-Fly Segmentation

The worker is where you keep the heavy ONNX Runtime logic off the main thread. The basic flow matches ORT-only setups, but now it talks to the `SAM2` helper.

### 4.1 Message Protocol

Define a small message union:

- **Incoming**:
  - `ping` – ask the worker to init and report device (`webgpu`/`cpu`).
  - `encodeImage` – send `{ float32Array, shape }` for `[1, 3, 1024, 1024]`.
  - `decodeMask` – send `{ points, maskArray, maskShape }`.

- **Outgoing**:
  - `pong` – `{ success, device }`.
  - `loadingInProgress`.
  - `encodeImageDone`.
  - `decodeMaskResult` – `{ masks: { dims, cpuData }, iou_predictions }`.
  - `error` – error message string.

### 4.2 Worker Implementation Sketch

```ts
import * as ort from 'onnxruntime-web'
import 'onnxruntime-web/webgpu'
import { SAM2, type SAM2SessionReport } from './sam2'

const sam = new SAM2()
let sessionsReady = false

async function ensureSessionsLoaded(): Promise<SAM2SessionReport> {
  if (sessionsReady) {
    return { success: true, device: 'webgpu' } // you can refine this later
  }
  await sam.downloadModels()
  const report = await sam.createSessions()
  sessionsReady = report.success
  return report
}

function postMessageFromWorker(message: OutgoingMessage, transfer?: Transferable[]) {
  const globalScope = self as unknown as Worker
  if (transfer && transfer.length > 0) {
    globalScope.postMessage(message, transfer)
  } else {
    globalScope.postMessage(message)
  }
}

async function handlePing() {
  try {
    postMessageFromWorker({ type: 'loadingInProgress' })
    const report = await ensureSessionsLoaded()
    postMessageFromWorker({ type: 'pong', data: report })
  } catch (e) {
    postMessageFromWorker({ type: 'error', data: e instanceof Error ? e.message : String(e) })
  }
}

async function handleEncodeImage(message: EncodeImageMessage) {
  try {
    postMessageFromWorker({ type: 'loadingInProgress' })
    await ensureSessionsLoaded()
    const { float32Array, shape } = message.data
    const inputTensor = new ort.Tensor('float32', float32Array, shape)
    await sam.encodeImage(inputTensor)
    postMessageFromWorker({ type: 'encodeImageDone', data: {} })
  } catch (e) {
    postMessageFromWorker({ type: 'error', data: e instanceof Error ? e.message : String(e) })
  }
}

async function handleDecodeMask(message: DecodeMaskMessage) {
  try {
    const { points, maskArray, maskShape } = message.data
    let maskInput: ort.Tensor | undefined
    if (maskArray && maskShape) {
      maskInput = new ort.Tensor('float32', maskArray, maskShape)
    }
    const { masks, iou_predictions } = await sam.decode(points, maskInput)
    const masksData = masks.data as Float32Array
    const iouData = iou_predictions.data as Float32Array
    const dims = [...masks.dims]

    postMessageFromWorker(
      {
        type: 'decodeMaskResult',
        data: {
          masks: { dims, cpuData: masksData },
          iou_predictions: iouData,
        },
      },
      [masksData.buffer, iouData.buffer],
    )
  } catch (e) {
    postMessageFromWorker({ type: 'error', data: e instanceof Error ? e.message : String(e) })
  }
}

;(self as unknown as Worker).onmessage = (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data
  if (msg.type === 'ping') {
    void handlePing()
  } else if (msg.type === 'encodeImage') {
    void handleEncodeImage(msg)
  } else if (msg.type === 'decodeMask') {
    void handleDecodeMask(msg)
  }
}
```

This is very similar structurally to an ORT-only worker; the main difference is how models and feeds are arranged via `SAM2`.

---

## 5. React App Integration

The React side (or whatever UI you use) barely changes from the ORT-only implementation:

- **On startup**: create the worker and send `ping`.
- **On “Encode image”**: resize canvas to 1024×1024, convert to tensor using HF-style normalization, `postMessage({ type: 'encodeImage', data: { float32Array, shape } })`.
- **On click**: maintain a list of points and optional previous mask, `postMessage({ type: 'decodeMask', data: { points, maskArray, maskShape } })`.
- **On `decodeMaskResult`**:
  - Inspect `masks.dims`,
  - Use the last two dims as `[H, W]`,
  - Slice out the best mask,
  - Convert to an overlay canvas and render.

Key differences vs a simpler ORT-only branch:

1. **Input naming**:
   - Encoder input is not hardcoded as `"image"` but taken from `session.inputNames[0]` (e.g. `"pixel_values"`).
   - Decoder uses `input_points`, `input_labels`, `input_boxes`, etc., instead of hardcoded `point_coords`/`point_labels`.

2. **Dtypes**:
   - `input_labels` and `has_mask_input` are `int64` (`BigInt64Array`), not floats.

3. **Model outputs**:
   - You treat the two decoder outputs generically and decide which one is masks vs IoUs by shape/length, instead of assuming a fixed index.

4. **Mask layout**:
   - `sliceTensorMask` is written to support both 4D and 5D outputs and only depends on the **last two dims** being `H/W`.

These adaptations make the “new transformers.js-style” pipeline robust to the ONNX-community SAM2 model’s naming and shape conventions, while keeping the overall control flow very close to your main-branch ORT-only code.

---


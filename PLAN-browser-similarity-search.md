# Plan: Add DINOv2 Similarity Search to next-sam (Browser)

## Goal

After the user clicks on an object and SAM2 produces a mask, a "Find Similar" button triggers an in-browser similarity search that highlights all visually similar objects in the image -- no server, no Python, everything client-side via `onnxruntime-web`.

---

## Architecture overview

```
User clicks image
       |
       v
  SAM2 encoder (existing, already cached)
  SAM2 decoder (existing) --> query mask
       |
       v
  [Find Similar] button click
       |
       v
  DINOv2 ONNX encoder (new, runs once per image, cached)
       |  output: Float32Array patch_feats [1, Hp*Wp, D]
       v
  similaritySearch.js  (new, pure JS, no onnxruntime needed)
       |  - pool exemplar from mask
       |  - contrastive similarity map
       |  - connected components
       |  - for each candidate: call SAM2 decoder with seed point + box + neg point
       v
  Render all similar masks as colored overlays on canvas
```

All heavy inference (DINOv2 encoder, SAM2 encoder/decoder) runs in the existing **Web Worker**. The lightweight similarity logic (pooling, dot products, connected components, coordinate math) can run either in the worker or on the main thread -- worker is preferred to avoid blocking UI.

---

## Prerequisites

### P1. Export DINOv2-small to ONNX

Create a one-time Python export script (not shipped with the app). It should:

1. Load `facebook/dinov2-small` from HuggingFace transformers.
2. Export with `torch.onnx.export`, input shape `[1, 3, H, W]` with dynamic axes for H and W (multiples of 14).
3. The output should be `last_hidden_state` of shape `[1, 1+Hp*Wp, 384]` (CLS + patch tokens).
4. Optimize with `onnxruntime` and/or `onnxsim` to reduce size.
5. Upload the resulting `.onnx` file to HuggingFace (like the SAM2 models at `g-ronimo/sam2-tiny`).

The dinov2-small model is ~85MB as float32. Quantize to float16 or int8 to get it to ~22-43MB for browser download.

Example export (for reference, not part of the app):

```python
import torch
from transformers import AutoModel

model = AutoModel.from_pretrained("facebook/dinov2-small")
model.eval()

dummy = torch.randn(1, 3, 518, 518)  # 518 = 37 * 14
torch.onnx.export(
    model, dummy, "dinov2_small.onnx",
    input_names=["pixel_values"],
    output_names=["last_hidden_state"],
    dynamic_axes={
        "pixel_values": {2: "height", 3: "width"},
        "last_hidden_state": {1: "num_tokens"},
    },
    opset_version=17,
)
```

### P2. Host the ONNX file

Upload to HuggingFace or a CDN. The app downloads and caches it via OPFS (same pattern as the SAM2 models in `app/SAM2.js`).

---

## Implementation steps

### Step 1. Add DINOv2 model management to `app/SAM2.js`

Rename or extend the class to handle both models. Add:

```js
const DINO_URL = "https://huggingface.co/<your-repo>/resolve/main/dinov2_small.onnx";
```

Add to the `SAM2` class (or create a new `DINOv2` class in a new file `app/DINOv2.js`):

- `bufferDino`, `sessionDino` fields
- `downloadDinoModel()` -- same OPFS caching pattern as `downloadModel()`
- `createDinoSession()` -- same `getORTSession()` pattern
- `encodeDinoImage(inputTensor)` -- runs the DINO ONNX session:
  ```js
  async encodeDinoImage(inputTensor) {
    const [session, device] = await this.getDinoSession();
    const results = await session.run({ pixel_values: inputTensor });
    // results.last_hidden_state: Tensor [1, 1+Hp*Wp, D]
    this.dino_encoded = {
      tokens: results.last_hidden_state,  // Float32Array
      // Store Hp, Wp computed from input dimensions and patch_size=14
    };
  }
  ```

Key detail: DINOv2 needs ImageNet normalization (mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]) applied to the input tensor. This differs from SAM2's preprocessing. Implement this in a new helper in `lib/imageutils.js`:

```js
export function canvasToFloat32ArrayDINO(canvas, maxSide = 518, patchSize = 14) {
  // 1. Compute target size: scale longest side to maxSide, round both dims to multiple of patchSize
  // 2. Resize canvas to (w1, h1)
  // 3. Convert to float [0,1], then normalize with ImageNet mean/std
  // 4. Return { float32Array, shape: [1, 3, h1, w1], scaleXY: [sx, sy], gridHW: [hp, wp] }
}
```

### Step 2. Add worker messages for DINOv2 in `app/worker.js`

Add three new message types:

```js
} else if (type === "downloadDino") {
  self.postMessage({ type: "dinoDownloadInProgress" });
  await sam.downloadDinoModel();  // or dino.downloadModel()
  await sam.createDinoSession();
  self.postMessage({ type: "dinoReady" });

} else if (type === "encodeDinoImage") {
  const { float32Array, shape } = data;
  const imgTensor = new Tensor("float32", float32Array, shape);
  await sam.encodeDinoImage(imgTensor);
  // Post back the patch features for use in similarity search
  self.postMessage({
    type: "dinoPatchFeatures",
    data: {
      features: sam.dino_encoded.tokens.cpuData,   // Float32Array
      shape: sam.dino_encoded.tokens.dims,          // [1, numTokens, D]
    }
  });

} else if (type === "findSimilar") {
  // Receives: { queryMaskArray, queryMaskShape, patchFeatures, patchShape, scaleXY, gridHW, imageSize }
  // Runs the full similarity search pipeline (Step 3) inside the worker
  // For each candidate, calls sam.decode() to get refined mask
  // Posts back: { masks: [...], points: [...], scores: [...] }
  self.postMessage({ type: "findSimilarResult", data: { masks, points, scores } });
}
```

**Design choice**: Run the similarity search logic inside the worker because it involves loops, connected components, and multiple SAM2 decode calls. This keeps the UI responsive.

### Step 3. Create `lib/similaritySearch.js` -- the core algorithm

This is a pure-JS port of the Python pipeline in `similarity_search.py`. No torch, no numpy, no cv2 -- just typed arrays and basic image processing.

The module exports one main function:

```js
export function findSimilarRegions({
  patchFeatures,   // Float32Array, shape [numTokens, D] (CLS stripped)
  gridH,           // int, number of patch rows
  gridW,           // int, number of patch columns
  queryMask,       // Float32Array, shape [maskH, maskW], values 0 or 1
  imageSize,       // { w, h } of the 1024x1024 padded image
  scaleXY,         // [sx, sy] from original to DINO resolution
  config,          // { simQuantile, topK, minComponentPatches, ... }
}) => CandidateRegion[]
```

Sub-functions to implement:

#### 3a. `l2Normalize(vec)` -- in-place L2 normalize a Float32Array

#### 3b. `computeExemplarEmbeddings(patchFeatures, gridH, gridW, queryMask, patchSize, scaleXY, config)`

Port of `exemplar_embedding_from_mask`. Returns `{ qObj, qBg, maskFracGrid }`.

- Resize `queryMask` to DINO resolution using nearest-neighbor (write a simple `resizeNearest(src, srcW, srcH, dstW, dstH)` helper).
- Erode the mask: implement a simple binary erosion on a 2D Uint8Array (iterate pixels, check if all neighbors in kernel are set). No OpenCV needed -- the grid is small (~60x40 patches at 840px max side).
- Dilate similarly for the background ring.
- Pool features under each mask region using weighted averaging (same math as the Python, just with for-loops over Float32Arrays).

#### 3c. `computeSimilarityMap(patchFeatures, gridH, gridW, qObj, qBg, alpha)`

Port of `similarity_map`. Returns `Float32Array` of shape `[gridH * gridW]`.

```js
// For each patch i: sim[i] = dot(feat[i], qObj) - alpha * dot(feat[i], qBg)
```

This is a tight loop over `gridH * gridW` patches, each with `D=384` dimensions. On a modern browser this takes <5ms.

#### 3d. `connectedComponents(binaryGrid, gridW, gridH)`

Implement a simple flood-fill connected components on a small 2D binary grid. The grid is tiny (~60x40 = 2400 pixels), so a basic BFS/DFS per component is fine. Return label map + stats (bbox, area) per component.

No need for OpenCV. Example:

```js
function connectedComponents(binary, w, h) {
  const labels = new Int32Array(w * h);  // 0 = unlabeled
  let nextLabel = 1;
  const stats = [];  // [{ label, minX, minY, maxX, maxY, area }]

  for (let i = 0; i < w * h; i++) {
    if (binary[i] && !labels[i]) {
      // BFS flood fill from i
      const queue = [i];
      labels[i] = nextLabel;
      let area = 0, minX = w, minY = h, maxX = 0, maxY = 0;
      while (queue.length > 0) {
        const idx = queue.shift();
        const x = idx % w, y = Math.floor(idx / w);
        area++;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        // Check 8-connected neighbors
        for (const [dx, dy] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const ni = ny * w + nx;
            if (binary[ni] && !labels[ni]) {
              labels[ni] = nextLabel;
              queue.push(ni);
            }
          }
        }
      }
      stats.push({ label: nextLabel, minX, minY, maxX, maxY, area });
      nextLabel++;
    }
  }
  return { labels, stats };
}
```

#### 3e. `extractCandidates(simMap, gridH, gridW, excludeMask, config)`

Port of `connected_components_from_similarity`:
- Compute quantile threshold on `simMap` (sort a copy, pick the value at index `floor(quantile * length)`).
- Binarize and run `connectedComponents`.
- For each component: compute p90 score, find peak location.
- Sort by score, return top-K.

#### 3f. `candidateToImageCoords(candidate, patchSize, scaleXY, imageSize)`

Port of `patch_bbox_to_orig_xyxy` and `patch_rc_to_orig_xy`. Convert patch-grid coordinates back to the 1024x1024 image space that SAM2 expects.

### Step 4. Wire "Find Similar" into the SAM2 decode loop (in worker)

In `app/worker.js`, handle the `findSimilar` message:

1. Call `findSimilarRegions(...)` from `lib/similaritySearch.js` to get candidate regions.
2. For each candidate, build SAM2 decode inputs:
   - Positive point at the candidate's peak location (in 1024x1024 coords).
   - Negative point at the lowest-sim patch in the candidate bbox.
   - Box prompt from the candidate bbox (converted to 1024x1024 coords).
3. Call `sam.decode(points, prevMask)` for each candidate (reusing the existing SAM2 decoder session -- the image encoding is already cached).
4. Collect all masks, apply size prior filtering and IoU dedup.
5. Post results back to main thread.

### Step 5. Add UI elements in `app/page.jsx`

#### 5a. New state

```jsx
const [dinoReady, setDinoReady] = useState(false);
const [dinoLoading, setDinoLoading] = useState(false);
const [patchFeatures, setPatchFeatures] = useState(null);
const [similarMasks, setSimilarMasks] = useState([]);  // array of canvas elements
```

#### 5b. Trigger DINOv2 encoding

Two options for when to encode:
- **Option A (eager)**: Encode with DINOv2 right after SAM2 image encoding completes. Adds ~1-3s to the initial encoding step but makes "Find Similar" instant.
- **Option B (lazy)**: Encode with DINOv2 only when "Find Similar" is first clicked. Avoids the upfront cost if the user never uses similarity search.

Recommend **Option A** -- encode both models in sequence after "Encode image" click, since the user expects a loading step there anyway.

In `encodeImageClick`:
```jsx
const encodeImageClick = async () => {
  samWorker.current.postMessage({
    type: "encodeImage",
    data: canvasToFloat32Array(resizeCanvas(image, imageSize)),
  });
  // Also send DINO encoding request (worker handles sequencing)
  samWorker.current.postMessage({
    type: "encodeDinoImage",
    data: canvasToFloat32ArrayDINO(image),  // new helper with ImageNet normalization
  });
  setLoading(true);
  setStatus("Encoding (SAM2 + DINOv2)");
};
```

#### 5c. "Find Similar" button

Add next to the existing "Crop" button:

```jsx
<Button
  onClick={findSimilarClick}
  variant="secondary"
  disabled={!mask || !patchFeatures || loading}
>
  Find Similar
</Button>
```

```jsx
const findSimilarClick = () => {
  // Convert current mask canvas to a binary Float32Array
  const maskArray = maskCanvasToFloat32Array(resizeCanvas(mask, dinoGridSize));
  samWorker.current.postMessage({
    type: "findSimilar",
    data: {
      patchFeatures: patchFeatures,
      queryMask: maskArray,
      // ... config params
    }
  });
  setLoading(true);
  setStatus("Finding similar...");
};
```

#### 5d. Render similar masks

When `findSimilarResult` arrives, convert each mask to a colored canvas overlay (reuse `float32ArrayToCanvas` with a different color, e.g. red/orange instead of green) and composite all of them onto the display canvas:

```jsx
// In the mask drawing useEffect, after drawing the query mask:
if (similarMasks.length > 0) {
  ctx.globalAlpha = 0.5;
  for (const simMask of similarMasks) {
    ctx.drawImage(simMask, 0, 0, simMask.width, simMask.height,
                  0, 0, canvas.width, canvas.height);
  }
  ctx.globalAlpha = 1;
}
```

#### 5e. Reset similar masks

Clear `similarMasks` whenever the user clicks a new point or uploads a new image. Add to `resetState()`:
```jsx
setSimilarMasks([]);
```

### Step 6. Handle DINOv2 worker messages in `onWorkerMessage`

```jsx
} else if (type === "dinoDownloadInProgress") {
  setStatus("Downloading DINOv2...");
} else if (type === "dinoReady") {
  setDinoReady(true);
} else if (type === "dinoPatchFeatures") {
  setPatchFeatures(data);
  setStatus("Ready. Click on image");
} else if (type === "findSimilarResult") {
  const { masks, points, scores } = data;
  // Convert each mask Float32Array to a colored canvas
  const maskCanvases = masks.map(m =>
    float32ArrayToCanvas(m.data, m.width, m.height, { r: 0xFF, g: 0x64, b: 0x00 })
  );
  setSimilarMasks(maskCanvases);
  setLoading(false);
  setStatus(`Found ${masks.length} similar objects`);
}
```

---

## File changes summary

| File | Change |
|------|--------|
| `app/DINOv2.js` | **New file.** DINOv2 ONNX model loading, session creation, image encoding. Same patterns as `app/SAM2.js`. |
| `app/worker.js` | Add DINOv2 import. Handle `downloadDino`, `encodeDinoImage`, `findSimilar` messages. |
| `lib/similaritySearch.js` | **New file.** Pure JS port of the similarity search pipeline: exemplar pooling, contrastive similarity, connected components, candidate extraction, coordinate conversion. |
| `lib/imageutils.js` | Add `canvasToFloat32ArrayDINO()` with ImageNet normalization and patch-size-aligned resizing. Add color-parameterized variant of `float32ArrayToCanvas()`. |
| `app/page.jsx` | Add state for DINOv2/similarity. Add "Find Similar" button. Render similar mask overlays. Handle new worker messages. |
| `notebooks/export_dinov2_onnx.py` | **New file** (one-time offline script, not part of the web app). Exports DINOv2-small to ONNX. |

---

## Tuning constants (to expose in config or UI)

Carry these over from the Python implementation:

| Constant | Default | Description |
|----------|---------|-------------|
| `DINO_MAX_SIDE` | 518 | Max side for DINO input (keep at 518 for browser perf; 518 = 37*14) |
| `SIM_QUANTILE` | 0.90 | Quantile threshold for binarizing similarity map |
| `TOPK_CANDIDATES` | 10 | Max candidates to refine with SAM2 |
| `MIN_SIMILARITY` | 0.5 | Min p90 score to keep a candidate |
| `MIN_COMPONENT_PATCHES` | 4 | Min connected component size |
| `SIZE_RATIO_RANGE` | [0.3, 3.0] | Acceptable mask area ratio vs query |
| `DEDUP_IOU` | 0.75 | IoU threshold for deduplication |
| `EXEMPLAR_ERODE_K` | 3 | Erosion kernel (smaller than Python since grid is smaller at 518px) |
| `BG_DILATE_K` | 7 | Dilation kernel for background ring |
| `BG_SUBTRACT_ALPHA` | 0.5 | Weight for background subtraction |

---

## Performance expectations

- DINOv2-small ONNX (float16, ~43MB): download once, cache in OPFS.
- DINOv2 encoding at 518x518: ~0.5-2s on WebGPU, ~3-8s on CPU WASM.
- Similarity search (JS math on ~2400 patches x 384 dims): <10ms.
- SAM2 decode per candidate: ~50-200ms each. With 10 candidates: ~0.5-2s total.
- **Total "Find Similar" latency** (after initial encoding): ~1-4s depending on device.

---

## Testing checklist

- [ ] DINOv2 ONNX model downloads and caches correctly via OPFS
- [ ] DINOv2 encoding produces correct-shaped patch features
- [ ] Similarity search finds visually similar regions on test images
- [ ] SAM2 refinement produces clean masks for each candidate
- [ ] Similar masks render correctly as colored overlays
- [ ] "Find Similar" button is disabled until both models are ready and a mask exists
- [ ] State resets properly on new image upload or new click
- [ ] Works on Chrome (WebGPU), Firefox (CPU), Safari (CPU)
- [ ] No main-thread blocking during search (all heavy work in worker)

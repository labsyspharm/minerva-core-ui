# Minerva Core UI — Presentation Outline

Grounded in git history since `51e3bfefda077b21102001022994f0fde436187e` (merge PR #19, worker pool + early overlays, Sept 2025) and the current codebase. The diff is large on paper (~288 files, tens of thousands of lines moved/rewritten), but thematically it clusters cleanly.

---

## 1. Unified authoring + playback (single interface)

### Structural change

- **Old entry/layout:** Monolithic `src/components/index.tsx` and split concerns (`imageView`, `vivView`, channel/info panels, etc.) — largely **removed or replaced**.
- **New spine:** `src/components/main.tsx` owns exhibit/config lifecycle, loaders, and wires **one** `ImageViewer` plus chrome.
- **Mode routing:** `PlaybackRouter` chooses:
  - **Authoring:** `ChannelPanel` wrapping the same children (upload + viewer when loaded).
  - **Presentation / preview:** `Presentation` wraps `ChannelPanel` + viewer — narrative sidebar, markdown content, waypoint-driven view.
- **Flags:** `presenting` vs `authorMode: !presenting`, `enterPlaybackPreview` / `exitPlaybackPreview`, responsive behavior (`twoNavOk`, hiding channel vs waypoint panels on small widths).

### UX / product story

- Users **do not switch “apps”**; they toggle **preview** (story walkthrough) vs **edit** (channels, waypoints, annotations) within one layout.
- **Upload** moved into a **side-panel / tabbed** flow (`Upload.tsx`), with **single-file** open behavior and **back navigation** patterns (chevrons, compact chrome) per recent commits.
- **File handling:** `FileHandler` adds **IndexedDB-stored file handles**, optional **auto-restore on mount**, and **`launchQueue` / PWA “Open with”** hooks when enabled.

### Slide ideas

- Before/after architecture diagram; screenshot callouts for “same viewer, different chrome”; mention **preview ribbon** and **split grid** in `Presentation.tsx`.

---

## 2. Shared viewer and rendering stack

- **Core component:** `ImageViewer.tsx` — Deck.gl **OrthographicView**, VIV **MultiscaleImageLayer**, scale bar, loading widget, lensing integration.
- **State bridges:** Viewport size → Zustand (`viewerViewportSize`, brush bounds, SAM viewport, programmatic waypoint navigation via `targetWaypointViewState`).
- **Coordinate model:** `waypoint.ts` documents **Minerva 1.5 (OpenSeadragon Pan/Zoom) → Minerva 2.0 (deck.gl view state)**; runtime migration from **Pan/Zoom-only** waypoints to **Bounds / ViewState** when image dimensions exist (`main.tsx` effects).

### Slide ideas

- One slide on “why deck.gl + VIV” and one on **waypoint coordinate migration** (interop with older stories).

---

## 3. Image modalities and I/O

### OME-TIFF

- Loaded via **`@hms-dbmi/viv`** with optional **decode worker pool** (`Pool` + `filesystem.ts` / `main.tsx`).

### DICOM Web

- **Multiple series** in one session (e.g. Brightfield vs multiplex **Colorimetric**); `extractChannels(loader, modality, groups)` matches exhibit **group `Image.Method`** to the right pyramid.
- Demo path can auto-load IDC proxy URLs (`demo_dicom_web` in `main.tsx`).

### GeoTIFF / other

- **`decoder.worker.ts`** runs **LZW** (and related) tile decode off the main thread for GeoTIFF-style paths where used.
- **`@loaders.gl/*`** in dependencies signals room for additional tiled / 3D stacks even when the primary UI path is OME-TIFF + DICOM Web.

### Slide ideas

- Modality matrix; “one viewer, multiple loaders.”

---

## 4. Annotation system

### Data model (`stores.ts`)

- Typed annotations: **rectangle, ellipse, polygon, line, polyline, text, point**, plus **groups**, visibility, hover, drag, brush-edit targets.
- **Brush:** Raster mask in store, **viewport-aligned bounds**, integration with **hull** / **polygon clipping** (`brushHull.ts`, `polygonClipping.ts`, `brushStroke.ts`).

### Authoring UI

- **`WaypointAnnotationEditor`:** Tool strip — move, rectangle, ellipse, lasso, arrow, line, polyline, text, point, **brush**, **magic wand**; color picker; **copy/paste** of waypoint-scoped annotations (`waypointAnnotationClipboard.ts`).
- **`LayersPanel`:** Layer list, selection, ordering.
- **`DrawingOverlay`:** Interaction routing by `activeTool`, preview geometry, SAM session lifecycle hooks, brush rendering.

### Rendering

- **`annotationLayers.ts`:** Consolidated **Deck.gl layers** (polygon, text, scatter, icon for arrows) for performance.

### OME ROI import

- **`roiParser.ts`:** Parses **OME-XML-style** ROI shapes (rectangle, ellipse, line, point, polygon, polyline, label) into internal annotations.

### Slide ideas

- Tool palette screenshot; pointer → overlay store → deck layers; “import ROIs vs draw fresh.”

---

## 5. Built-in machine learning: SAM 2 vs DINO similarity

SAM 2 and (optionally) DINO share the same worker file (`sam2.worker.ts`). **SAM 2** is implemented end-to-end on the main integration branch; **DINO + similarity** is either **stubbed** there or **fully wired** on the **`similarity-search`** branch (see below).

### SAM 2 (magic wand) — how it works

1. **Load models** — `sam2.ts` fetches ONNX **vision encoder** and **prompt encoder + mask decoder** from Hugging Face (`onnx-community/sam2.1-hiera-tiny-ONNX`), with optional **OPFS cache**. Sessions prefer **WebGPU**, then **CPU** (`onnxruntime-web`).
2. **Warmup** — `useSam2` sends `ping`; worker loads sessions and replies with `pong` + device. Selecting the magic-wand tool triggers this early.
3. **Start session (expensive)** — From Deck **view state** + viewport size, `samViewport.ts` computes the **visible image rectangle** in pixel space and a fixed **SAM square** (e.g. 1024) mapping (`computeSamTransform`). `createSam2ImageFetcher` (OME-TIFF path) composites the current multichannel view into a **float NCHW tensor** matching SAM’s expected normalization; that buffer is posted to the worker as **`encodeImage`**. The encoder runs once per session; embeddings stay in the worker (`encodedTensors`).
4. **Refine (cheap)** — Each click posts **`decodeMask`** with **prompt points** mapped into SAM’s 256×256 space (foreground/background labels). The decoder returns mask logits + **IoU scores**; the client picks the best mask, **slices** it, and converts it to an **image-space polygon** (`imageUtils.ts`) for preview or final annotation.
5. **Confirm / cancel** — Session ends by writing the polygon into the annotation model or discarding state.

**Practical constraint:** The fetcher is wired for **OME-TIFF** composite tiles; **DICOM** viewing does not use the same SAM image path in the current code.

### DINO / similarity on **`annotation` / default branch** (stubs)

| Piece | What the code does |
|--------|---------------------|
| **`encodeDinoImage`** (worker) | Does **not** run a DINO model. It immediately posts **`dinoPatchFeatures`** with `dim: 0` and echoes `gridHW` so a future UI could treat “features” as ready. |
| **`findSimilar`** (worker) | **Stub:** responds with **`findSimilarResult`** and **`masks: []`**. |
| **`canvasToFloat32ArrayDINO`** (`imageUtils.ts`) | DINOv2-style preprocessing exists but **nothing imports it** on this branch. |
| **`useSam2.ts`** | **`encodeImage` / `decodeMask` / `ping`** only — no DINO or findSimilar calls. |

### DINO + similarity on the **`similarity-search`** branch — how it works

This branch adds **`dinoV2.ts`**, **`similaritySearch.ts`**, extends **`sam2.worker.ts`**, **`useSam2.ts`**, **`sam2ImageFetcher.ts`**, and **`sam2.decode`** (optional **`input_boxes`**). High-level pipeline:

**A. Shared viewport image (SAM + DINO aligned)**

- The fetcher still builds a **1024×1024** RGB canvas of the **visible viewport** (same composite as SAM).
- From that canvas it returns both:
  - SAM tensor (`canvasToFloat32Array`),
  - **`dinoTensor`** — `canvasToFloat32ArrayDINO(samCanvas)`: long side **518**, dims rounded to multiples of **patch size 14**, **ImageNet mean/std**, **NCHW** `float32`, plus **`scaleXY`** and **`gridHW`** (patch rows/cols).

**B. DINOv2 encoding (`dinoV2.ts` + worker `encodeDinoImage`)**

- Loads **`onnx-community/dinov2-base-ONNX`** (`model_fp16.onnx`), **OPFS-cached**, **WebGPU → CPU**.
- Runs the model; reads **`last_hidden_state`** shaped **`[1, numTokens, dim]`** (e.g. **768**).
- **Strips the CLS token**; remaining tokens are **patch embeddings**, flattened to **`features`** of length **`gridH * gridW * dim`**.
- Worker keeps **`lastDinoFeatures`** for the current viewport encode.

**C. When DINO runs (latency tradeoff in `useSam2`)**

- After the **first SAM decode** in `startSession`, the client posts **`encodeDinoImage`** in the **background** so interactive segmentation is not blocked by DINO.
- **`encodeViewport()`** (used for **find-similar on a layer**) sends **`encodeImage` then `encodeDinoImage`** in sequence and waits for both, and clears **`hasDinoFeatures`** until DINO finishes so **`findSimilar` cannot race stale features**.
- Worker uses a **serial promise queue** for messages so **ORT WebGPU** sessions are not hit with concurrent **`run()`** calls.

**D. Similarity map (`similaritySearch.ts` — `findSimilarRegions`)**

1. **L2-normalize** each patch vector in place (cosine similarity = dot product after normalization).
2. **Resize the SAM query mask** (256×256) to **`gridW × gridH`** (nearest neighbor).
3. Build **foreground core** = binary mask, optionally **eroded** (fallback to un-eroded if erosion wipes the object).
4. Build **background ring** = **dilated** mask minus original mask.
5. **Query vectors:** mean patch embedding over **fg core** → **`qObj`** (L2-normalized); mean over **bg ring** → **`qBg`** if non-empty (L2-normalized).
6. **Per-patch score:** `sim[i] = dot(patch_i, qObj) - alpha * dot(patch_i, qBg)` (**`bgSubtractAlpha`**, default **0.5**) — foreground-like patches go up, background-like down.
7. **Threshold** with a **quantile** of the similarity map (default **`simQuantile` 0.85**), then **8-connected connected components**.
8. Filter components by **min patch count**, and by **90th percentile** of scores inside the blob ≥ **`minSimilarity`**.
9. Sort by that p90 score, keep top **`topKCandidates`** (default **15**).

**E. SAM refinement per candidate (worker `findSimilar`)**

- For each candidate, map grid bbox + **peak** (highest-sim patch) and **negPeak** (lowest-sim patch inside bbox) to **1024 SAM coordinates** via **`candidateToSamCoords`** (patch centers × 14, scaled by **`scaleXY`**).
- Call **`sam2.decode`** with **two points** (positive at peak, negative at negPeak) and an **`input_boxes`** tensor: **one box** around the candidate region — narrows the decoder to that area.
- Take best mask by IoU output; **filter** by **foreground area ratio** vs query mask (**`sizeRatioMin` / `sizeRatioMax`**).
- **Dedupe** retained masks with **mask IoU** ≥ **`dedupIou`**.
- Post **`findSimilarResult`** with an array of **256×256** masks.

**F. Client UX (`useSam2` on that branch)**

- **`findSimilar()`** — uses **current session** mask + requires **`hasDinoFeatures`**.
- **`findSimilarForLayer(annotationId)`** — rasterizes a **polygon** annotation to 256×256 in SAM space; either reuses cached DINO or calls **`encodeViewport()`**; optional **`debug`** mode returns **`findSimilarDebugResult`** (peaks/boxes only, no SAM loop).
- Results become **`similarPolygons`**; **`applyFindSimilar`** adds new polygon annotations labeled like **“Similar *n* to …”**.

### Slide ideas

- **SAM 2:** encode once → click to decode → polygon; privacy / in-browser latency.
- **Default branch:** one honest slide — **“DINO/similarity: worker API present, inference not hooked up.”**
- **`similarity-search` branch:** **“Retrieve with DINO (patch cosine + bg suppression) → localize with SAM (box + pos/neg points).”** Optional second slide on **tunables** (`DEFAULT_SIMILARITY_CONFIG`: quantile, top-K, min similarity, erosion/dilation, dedup IoU, size ratio).

---

## 6. Waypoints, stories, and narrative

- **WaypointsList / Master-detail:** Editing **content** (`WaypointContentEditor` + ProseMirror stack in dependencies) and **annotations** per waypoint.
- **Presentation mode:** Markdown rendering, navigation, **group** context, integration with **waypoint view state** (`getWaypointViewState` in `waypoint.ts`).
- **Thumbnails / viewport capture:** Store hooks for **square viewport overlay** and **live snapshot** from Deck for waypoint assets (`ImageViewer` + store).

---

## Appendix

- **Commit themes** (from `git log`): `annotation` merge, magic-wand POC, SAM behavior + **ONNX community** builds, **copy/paste**, **story schema**, **histogram** (author-ui channel histogram class), **range slider** fixes, **image-open** merge, **preview tabs**.
- **Metrics for management:** file churn is high because **features + relocation** (`overlays/` → `shared/viewer/layers/`, `components/index` deleted) — not only greenfield lines.

### Audience tuning

If you turn this into **slide titles + speaker notes** (one paragraph per slide), tune depth and jargon for **clinical/biology**, **engineering**, or **mixed** audiences.

# Direct Imaris IMS support: implementation notes

Last updated: 2026-08-05

## Current repository state

- Active branch: `ims`
- Base: `origin/main`
- IMS open path, Viv 2D plane display, volumetric detection, and direct
  Vitessce Three.js volume viewing are implemented on this
  branch (not necessarily all committed yet — check `git status`).

## What has been done

### Slice 1 — Open local `.ims` in the 2D Viv viewer

1. **Dependencies:** `h5wasm` for HDF5, `h5wasm-plugins` for LZ4, and
   `comlink` for typed worker RPC.
2. **IMS reader** under `src/lib/imaging/ims/`:
   - `ims.worker.ts` — opens `File` via WORKERFS, reads metadata and Z-plane
     hyperslabs
   - `imsClient.ts` — small Comlink client for the worker
   - `imsLoader.ts` — Viv `Loader` adapter (`LoaderPlane` per resolution)
   - `imsMetadata.ts` / `imsTypes.ts` — attribute normalization, sizes, dtype
3. **App wiring:**
   - `.ims` accepted in filesystem / upload / hydration via
     `loadOmeLoaderForRole()` / `isImsFileName()`
   - Optional `sizeZ` / `sizeT` on persisted images
   - Viv 2D viewer shows the first Z/T plane with pyramid pan/zoom

### Slice 2 — Volumetric detection + Vitessce image wrapper

When `SizeZ > 1`, the app treats the source as a volume without rewriting IMS
bytes to disk:

| Path | Role |
| --- | --- |
| Loader OME metadata (`Pixels.SizeZ`) | Detect whether the primary loader has multiple Z planes |
| `@vitessce/image-utils` | Existing Viv loader → official Vitessce `ImageWrapper` |
| `src/lib/imaging/vitessce/vivBridge.ts` | Makes Vitessce reuse Minerva's Viv/deck.gl runtime |

`Main.tsx` swaps to the volume viewer when the primary OME source is volumetric
and not DICOM/JPEG.

### Slice 3 — Vitessce Three.js volume viewer (in-app)

`VolumeViewer` (`src/components/shared/viewer/VolumeViewer.tsx`) mounts the
standalone `@vitessce/spatial-three` `SpatialWrapper` with:

- `spatialRenderingMode: "3D"`
- Minerva-owned channel, rendering-mode, opacity, and resolution controls
- the existing Viv loader planes as the renderer's volume sources

The wrapper is lazy-loaded intentionally. The Three.js/Vitessce chunk is about
2.5 MB in the current production build, so loading it only for a multi-Z source
keeps ordinary 2D sessions on the existing lightweight path.

**Vitessce dependency integration:**

Vitessce 4's standard browser bundle includes its full deck.gl 8 spatial shell,
while Minerva's 2D viewer uses deck.gl 9 + Viv 0.20. Deck.gl rejects two major
versions in one JavaScript realm. Minerva therefore imports the packages'
shipped unbundled `dist-tsc` entries and aliases their `@vitessce/gl` use to
`vivBridge.ts`. That bridge exports Minerva's existing Viv version.

This keeps React, Three.js, React Three Fiber, and Viv shared in one normal
component tree. It does not load Vitessce's deck.gl code, use an iframe, patch
`fetch`, synthesize OME-Zarr, or maintain no-op compatibility shims. The
Vitessce version is pinned because the unbundled entry is a shipped build
artifact but is not a separately documented public export.

### Package boundaries after cleanup

- `@vitessce/image-utils` owns volume sizing, loadability, and automatic
  resolution selection through `ImageWrapper`; the former local memory helper
  was removed.
- `comlink` owns worker RPC and transferable results.
- `@vivjs/types` and `@vivjs/constants` provide the pixel-source types and
  renderer channel limit.
- `h5wasm` owns HDF5 access. `h5wasm-plugins` supplies the LZ4 binary; its
  explicit `?url` import is needed so Vite emits that binary as an asset.

The remaining custom reader code is format-specific: Imaris group traversal,
attribute normalization, logical-versus-padded dimensions, dtype mapping,
physical voxel sizes, and HDF5 hyperslab reads. There is no suitable browser
package in the dependency tree that replaces this adapter.

## Layout of key files

```text
src/lib/imaging/ims/           # HDF5 IMS → Viv Loader
src/lib/imaging/vitessce/      # Vitessce → existing Viv dependency bridge
src/components/shared/viewer/
  VolumeViewer.tsx             # Direct SpatialWrapper + local controls
  VolumeViewerLazy.tsx
vite.config.js                 # unbundled spatial-three + Viv bridge aliases
```

## How data is represented in a modern `.ims` file

Modern Imaris 5.5+ IMS files are HDF5 containers. Logical image data is
`T C Z Y X`, but time points and channels are HDF5 groups rather than dimensions
of one dataset.

```text
/DataSet
  /ResolutionLevel 0
    /TimePoint 0
      /Channel 0
        /Data          # shape [z, y, x], often chunk-padded
/DataSetInfo
  /Image               # ExtMin/ExtMax, Unit → physical voxel size
  /Channel 0           # Name, Color, …
  /TimeInfo
```

- `ResolutionLevel 0` is full resolution; higher levels are the pyramid.
- Logical sizes come from channel-group attributes `ImageSizeX/Y/Z`, not the
  padded dataset shape.
- Attribute values are often strings or arrays of strings — normalize scalars,
  one-element arrays, byte arrays, and null-terminated strings.
- Compression: DEFLATE/gzip and/or HDF5 LZ4 (`32004`), optionally with shuffle.
- `/Thumbnail/Data` and `Scene`/`Scene8` objects are out of scope for volume
  viewing.

## Verification

- Typecheck: `pnpm exec tsc --noEmit`
- Style/lint: `pnpm run lint` (Biome)
- Automated suite: `pnpm test`
- Production builds: `pnpm exec vite build` and `pnpm run build:bundle`
- Manual: restart `pnpm run dev`, open a multi-Z `.ims` → Vitessce 3D volume
  and verify channel controls, pyramid selection, and no deck.gl version error

## Known limitations / follow-ups

- Plane / time selection UI in the 2D Viv path is still default `z=0`, `t=0`.
- No OME-Zarr export to disk yet; the local viewer reads IMS directly.
- No meshes, XR productization, or Gaussian-splat training.
- Prefer a tiny synthetic IMS fixture for CI; do not commit large real `.ims`
  samples.

## Follow-up architecture (unchanged intent)

```text
IMS/HDF5 reader
  -> Viv Loader
     -> Minerva 2D deck.gl/Viv viewer
     -> Vitessce ImageWrapper -> Vitessce spatial-three
     -> (future) OME-Zarr export for remote / shareable datasets
     -> (future) splat training from a normalized 3D representation
```

Direct local IMS is for inspection and authoring. OME-Zarr remains the better
canonical form for remote, chunk-efficient production datasets.

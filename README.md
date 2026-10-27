# Minerva Core UI

First, run `pnpm install`. Then run locally or build.

## Running demo

```
pnpm demo
```

## Building demo

```
pnpm pages
```



The server will run on port `2021`.

## Build module

```
pnpm build
```

## Lint - Format

```
pnpm lint && pnpm format
```

## 3D volumes (experimental)

Stories can also be built on a 3D Imaris volume: paste an `.ims` URL (served
with CORS and HTTP `Range` support) into **Image URL**, e.g.
`https://lsp-public-data.s3.amazonaws.com/yapp-2023-3d-melanoma/LSP22408.ims`.
[kiln-render](https://github.com/simonwarchol/kiln-render) renders it with
WebGPU. Waypoints save the 3D view (camera, clip box, render mode, density,
depth fade), and exporting a 3D story can train Gaussian splats (one PLY per
channel in `splats/`) that the published story plays without streaming voxels.

kiln-render comes from [the fork](https://github.com/simonwarchol/kiln-render)
at a pinned commit, built on install. To update it, push Kiln and change the
commit in `package.json` and in `pnpm-workspace.yaml`'s
`onlyBuiltDependencies`; to work on both at once, `pnpm link ../kiln-render`.
The 3D story player isn't on npm yet, so exports copy this build's player
(`bundle/`, set by `VITE_STORY_BUNDLE_URL` in `.env`): run `pnpm run pages`
after changing the app.

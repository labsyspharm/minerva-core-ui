# Minerva Core UI

First, run `pnpm install`. Then run locally or build.

**N.b.** For co-'lensing' dev. work, place repo adjacent and install / link using `pnpm link ../lensing`.

### *Lensing Notes*
+ Better understand openseadragon.ts's `handle` and `setViewport` to better coordinated viewer event sync.

## Running demo

Run `npx serve --cors` in the same directory as `LSP10353.ome.tiff`. In a separate shell, run the development server:

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

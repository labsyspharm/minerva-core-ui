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

## Embedding a story

A published story (`document.json` from Minerva Author) can be embedded as a
React component or from the CDN bundle. Both return the same programmatic
handle.

### React

```
pnpm build:lib   # → lib/minerva.js, lib/minerva.css, lib/types
```

```tsx
import { MinervaStory, type MinervaHandle } from "minerva-core-ui/story";
import "minerva-core-ui/story.css";

const ref = useRef<MinervaHandle>(null);

<div style={{ height: 600 }}>
  <MinervaStory
    ref={ref}
    document="story/document.json" // URL, or the parsed object
    waypoint={2}                   // index, id, or title
    channelGroup="Immune Populations"
    onStateChange={(state) => console.log(state.activeWaypoint)}
  />
</div>;

await ref.current.whenReady();
await ref.current.setChannelVisibility("CD45", false);
await ref.current.setView({ bounds: { x0: 9000, y0: 9000, x1: 13000, y1: 12000 } });
```

- The component fills its parent, so give the parent a height (or pass a
  `className` / `style`).
- A new `document` loads a new story, so keep object documents referentially
  stable.
- The story is ready (`whenReady`, `onReady`) once its waypoints and channel
  groups are showing; images may still be opening, and camera moves wait for
  them.
- `waypoint`, `channelGroup` and `view` are applied when the story is ready
  and whenever they change. Readers can still navigate in between; follow along
  with `onStateChange`.
- React 18.2+ or 19 is a peer dependency. Everything else is bundled.
- Browser-only (WebGL): in Next.js, load it with
  `dynamic(() => import(…), { ssr: false })`.
- Viewer state lives in module-level stores, so use one Minerva view per page.
- It adds the DM Sans stylesheet from Google Fonts, like the CDN player.
- Like the CDN player, it omits authoring-only pieces (SAM2, palette
  optimization). Stories with feature tables (waypoint cell classes) load
  DuckDB-Wasm from jsDelivr when needed.

To work on the component, run `pnpm dev` and open `/story.html` (CRC demo
story, or `/story.html?document=<url>`). The handle is `window.minerva` in the
console.

### CDN

```js
const story = MinervaStory.play({ documentUrl: "document.json", root, waypoint: 2 });
await story.whenReady();
await story.goToWaypoint("Introduction");
story.destroy();
```

### Commands (agents / MCP)

Every state change goes through a named command with a zod input schema
(`src/api/commands.ts`). `handle.listCommands()` returns
`{ name, description, inputSchema }` with a JSON Schema, which is the MCP
`tools/list` shape. `handle.execute(name, input)` never throws; it resolves to
`{ ok, state }` or `{ ok: false, code, error }`. Commands: `getState`,
`loadDocument`, `goToWaypoint`, `nextWaypoint`, `previousWaypoint`,
`setChannelGroup`, `setChannelVisibility`, `setView`, `resetView`. Coordinates
are image pixels.

## Lint - Format

```
pnpm lint && pnpm format
```

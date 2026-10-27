/**
 * CDN story-player stub: splat training (Brush, through kiln-render) is
 * authoring-only. Aliased over `brush-js` in `vite.bundle.config.ts` so its
 * ~40 MB wasm is not inlined into `bundle/minerva.js`.
 */

function unavailable(): Error {
  return new Error(
    "Splat training isn't available in the story player; open the story in Minerva to export.",
  );
}

export default async function init(): Promise<never> {
  throw unavailable();
}

export class BrushApp {
  constructor() {
    throw unavailable();
  }
}

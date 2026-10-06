/**
 * CDN story-player DuckDB assets: fetched from jsDelivr (pinned to the
 * installed @duckdb/duckdb-wasm version) instead of inlined into `bundle/`.
 * Aliased over `@/lib/featureTable/duckdbBundles` in `vite.bundle.config.ts`.
 */

import { type DuckDBBundles, getJsDelivrBundles } from "@duckdb/duckdb-wasm";

export const duckdbBundles: DuckDBBundles = getJsDelivrBundles();

/** Workers cannot load cross-origin scripts directly; bootstrap via a same-origin blob. */
export function createDuckdbWorker(mainWorker: string): Worker {
  const url = URL.createObjectURL(
    new Blob([`importScripts(${JSON.stringify(mainWorker)});`], {
      type: "text/javascript",
    }),
  );
  try {
    return new Worker(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

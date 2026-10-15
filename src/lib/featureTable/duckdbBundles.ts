/**
 * Self-hosted DuckDB-wasm assets for the app build.
 * The CDN story player aliases this module to `cdnStubs/duckdbBundles.ts`
 * (see `vite.bundle.config.ts`) so ~100MB of wasm is not inlined into `bundle/`.
 */

import type { DuckDBBundles } from "@duckdb/duckdb-wasm";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdbWasmEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import duckdbWasmMvp from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";

export const duckdbBundles: DuckDBBundles = {
  mvp: { mainModule: duckdbWasmMvp, mainWorker: mvpWorker },
  eh: { mainModule: duckdbWasmEh, mainWorker: ehWorker },
};

export function createDuckdbWorker(mainWorker: string): Worker {
  return new Worker(mainWorker);
}

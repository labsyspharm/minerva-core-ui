import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import svgr from "vite-plugin-svgr";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import { gitSha } from "./vite.gitSha.js";

/**
 * PR previews set `VITE_STORY_BUNDLE_URL`. List emitted player files so an export
 * can copy them into the story folder (`storyBundle.ts`).
 */
function writeBundleManifest(): Plugin {
  // Also from `.env` (3D-volume builds self-host their player).
  const selfHosted =
    process.env.VITE_STORY_BUNDLE_URL ??
    loadEnv("production", __dirname).VITE_STORY_BUNDLE_URL;
  return {
    name: "minerva-bundle-manifest",
    writeBundle(options, bundle) {
      if (!selfHosted || !options.dir) return;
      const files = Object.keys(bundle);
      fs.writeFileSync(
        path.join(options.dir, "manifest.json"),
        JSON.stringify(files),
      );
    },
  };
}

/** Force `?worker` → `?worker&inline` so CDN pages do not fetch `/assets/*.js`. */
function inlineWorkersForCdn(): Plugin {
  return {
    name: "minerva-inline-workers-cdn",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!source.includes("?worker") || source.includes("inline")) return null;
      const next = source.replace("?worker", "?worker&inline");
      return this.resolve(next, importer, { ...options, skipSelf: true });
    },
  };
}

/**
 * Browsers refuse a cross-origin worker URL, and from a CDN every
 * `new Worker(new URL(..., import.meta.url))` is one (psudo's pool, geotiff's
 * decoder pool). Shadow `Worker` in those modules with SameOriginWorker; Vite
 * still bundles each worker from the unchanged call.
 */
function sameOriginWorkers(): Plugin {
  const shim = path.resolve(__dirname, "src/player/sameOriginWorker.ts");
  const workerFromUrl = /\bnew\s+Worker\s*\(\s*new\s+URL\s*\(/;
  return {
    name: "minerva-same-origin-workers",
    enforce: "pre",
    transform(code, id) {
      if (id === shim || !workerFromUrl.test(code)) return null;
      return {
        code: `import { SameOriginWorker as Worker } from ${JSON.stringify(shim)};\n${code}`,
        map: null,
      };
    },
  };
}

/**
 * Single browser build of the player and the author app for CDN import
 * (unpkg / jsDelivr), so a published story can switch to editing in place.
 * Output: bundle/minerva.js, an ES module exporting `play(...)`.
 *
 * ES, not IIFE: authoring needs top-level await (wasm) and `import.meta.url`.
 * DuckDB loads from jsDelivr; SAM2/ONNX stays stubbed.
 */
export default defineConfig({
  define: {
    // Lib builds do not auto-inject this; React / deps still reference it.
    "process.env.NODE_ENV": JSON.stringify("production"),
    __BUILD_TIME_ISO__: JSON.stringify(
      process.env.VITE_APP_BUILD_TIME ?? new Date().toISOString(),
    ),
    __BUILD_GIT_SHA__: JSON.stringify(gitSha()),
  },
  plugins: [
    writeBundleManifest(),
    inlineWorkersForCdn(),
    sameOriginWorkers(),
    wasm(),
    topLevelAwait(),
    react(),
    svgr({
      svgrOptions: {
        icon: true,
      },
    }),
  ],
  resolve: {
    alias: [
      // Story CDN player never uses magic wand — drop the ~130MB inlined ORT worker.
      {
        find: "@/lib/sam2/useSam2",
        replacement: path.resolve(
          __dirname,
          "./src/lib/sam2/cdnStubs/useSam2.ts",
        ),
      },
      // Feature-table DuckDB wasm comes from jsDelivr instead of ~100MB inlined.
      {
        find: "@/lib/featureTable/duckdbBundles",
        replacement: path.resolve(
          __dirname,
          "./src/lib/featureTable/cdnStubs/duckdbBundles.ts",
        ),
      },
      // Splat training is authoring-only — drop Brush's ~40MB wasm (kiln
      // imports it as ./brush-js/brush_js.js).
      {
        find: /(?:^|\/)brush-js(?:\/brush_js\.js)?$/,
        replacement: path.resolve(
          __dirname,
          "./src/lib/volume/cdnStubs/brushJs.ts",
        ),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
  // Do not copy `public/` (demo tiles, wasm, etc.) into the CDN artifact.
  publicDir: false,
  // Worker and asset URLs resolve beside minerva.js (a CDN folder or the
  // story's `bundle/`), not the site root. `base` stays default: the author
  // app reads BASE_URL for its router.
  experimental: {
    renderBuiltUrl: () => ({ relative: true }),
  },
  worker: {
    format: "es",
    plugins: () => [wasm(), topLevelAwait()],
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  build: {
    emptyOutDir: true,
    outDir: "bundle",
    lib: {
      entry: path.resolve(__dirname, "src/player/entry.tsx"),
      formats: ["es"],
      fileName: () => "minerva.js",
    },
    rollupOptions: {
      // minerva.js holds the code itself, not a facade re-exporting a chunk.
      preserveEntrySignatures: "allow-extension",
      output: {
        exports: "named",
        // Everything stays in minerva.js but kiln-render (~2 MB, with its
        // codecs and trainer stub), imported on demand into its own chunks.
        manualChunks: (id) =>
          /[\\/]kiln-render[\\/]|[\\/]cdnStubs[\\/]brushJs\.ts$/.test(id)
            ? undefined
            : "minerva",
        chunkFileNames: "assets/[name]-[hash].js",
        // Keep CSS as minerva.css; hash other assets (fonts, workers).
        assetFileNames: (info) => {
          const name = info.names?.[0] ?? info.name ?? "asset";
          if (name.endsWith(".css")) return "minerva[extname]";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: false,
    minify: true,
  },
});

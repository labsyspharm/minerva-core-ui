import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import svgr from "vite-plugin-svgr";
import { gitSha } from "./vite.gitSha.js";

/**
 * PR previews set `VITE_STORY_BUNDLE_URL`. List emitted player files so an export
 * can copy them into the story folder (`storyBundle.ts`).
 */
function writeBundleManifest(): Plugin {
  return {
    name: "minerva-bundle-manifest",
    writeBundle(options, bundle) {
      if (!process.env.VITE_STORY_BUNDLE_URL || !options.dir) return;
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
 * Viv's default geotiff pool builds its worker from `new URL(…, import.meta.url)`,
 * which bypasses the `?worker` hook above and is emitted as `/assets/*.js`.
 * Rewrite it to an inline worker so the default pool also works from a CDN or
 * a consumer's bundle. Fails the build if viv changes shape.
 */
function inlineVivDecoderWorker(): Plugin {
  const pattern =
    /new Worker\(new URL\("\.\/tiff\/lib\/decoder\.worker\.mjs", import\.meta\.url\), \{\s*type: "module"\s*\}\)/;
  return {
    name: "minerva-inline-viv-decoder-worker",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("@vivjs/loaders") || !code.includes("decoder.worker")) {
        return null;
      }
      if (!pattern.test(code)) {
        this.error("@vivjs/loaders: default decoder worker not found");
      }
      return `import __MinervaVivDecoderWorker from "./tiff/lib/decoder.worker.mjs?worker&inline";\n${code.replace(
        pattern,
        "new __MinervaVivDecoderWorker()",
      )}`;
    },
  };
}

/**
 * Single browser build of the app for CDN import (unpkg / jsDelivr).
 * Output: bundle/minerva.js → global `MinervaStory` with `.play(...)`.
 *
 * Omits wasm/top-level-await plugins (incompatible with lib IIFE).
 * Authoring-only pieces are stubbed: SAM2/ONNX and psudo (GMM/palette WASM).
 * Feature-table DuckDB WASM loads from jsDelivr. `vite.lib.config.ts` reuses
 * all of this.
 */
export default defineConfig({
  define: {
    // Lib IIFE does not auto-inject this; React / deps still reference it.
    "process.env.NODE_ENV": JSON.stringify("production"),
    __BUILD_TIME_ISO__: JSON.stringify(
      process.env.VITE_APP_BUILD_TIME ?? new Date().toISOString(),
    ),
    __BUILD_GIT_SHA__: JSON.stringify(gitSha()),
  },
  plugins: [
    writeBundleManifest(),
    inlineWorkersForCdn(),
    inlineVivDecoderWorker(),
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
      {
        find: /^psudo$/,
        replacement: path.resolve(
          __dirname,
          "./src/lib/imaging/cdnStubs/psudo.ts",
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
  worker: {
    format: "es",
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
      name: "MinervaStory",
      formats: ["iife"],
      fileName: () => "minerva.js",
    },
    rollupOptions: {
      output: {
        exports: "named",
        inlineDynamicImports: true,
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

import { createRequire } from "node:module";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import svgr from "vite-plugin-svgr";

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require("./package.json") as {
  version: string;
};

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
 * Single browser build of the app for CDN import (unpkg / jsDelivr).
 * Output: bundle/minerva.js → global `MinervaStory` with `.play(...)`.
 *
 * Omits wasm/top-level-await plugins (incompatible with lib IIFE).
 * Story playback does not need ONNX/psudo WASM.
 */
export default defineConfig({
  define: {
    // Lib IIFE does not auto-inject this; React / deps still reference it.
    "process.env.NODE_ENV": JSON.stringify("production"),
    __BUILD_TIME_ISO__: JSON.stringify(
      process.env.VITE_APP_BUILD_TIME ?? new Date().toISOString(),
    ),
    __MINERVA_PACKAGE_VERSION__: JSON.stringify(PACKAGE_VERSION),
  },
  plugins: [
    inlineWorkersForCdn(),
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
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
      {
        find: "psudo",
        replacement: path.resolve(__dirname, "./node_modules/psudo/index.js"),
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
      entry: path.resolve(__dirname, "src/app/entry.tsx"),
      name: "MinervaStory",
      formats: ["iife"],
      fileName: () => "minerva.js",
    },
    rollupOptions: {
      output: {
        exports: "named",
        inlineDynamicImports: true,
        // Keep CSS as minerva.css; hash other assets (Lato faces, workers).
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

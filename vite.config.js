import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import { standardCssModules } from "vite-plugin-standard-css-modules";
import { viteStaticCopy } from "vite-plugin-static-copy";
import svgr from "vite-plugin-svgr";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

/** ISO UTC time baked into each bundle; override in CI with `VITE_APP_BUILD_TIME` (ISO-8601). */
const BUILD_TIME_ISO =
  process.env.VITE_APP_BUILD_TIME ?? new Date().toISOString();

export default defineConfig({
  define: {
    __BUILD_TIME_ISO__: JSON.stringify(BUILD_TIME_ISO),
  },
  assetsInclude: ["**/*.wasm"],
  worker: {
    format: "es",
    plugins: () => [wasm(), topLevelAwait()],
  },
  server: {
    https: true,
    hmr: {
      overlay: true,
    },
  },
  base: process.env.BASE_PATH ?? "",
  plugins: [
    wasm(),
    topLevelAwait(),
    react(),
    mkcert(),
    svgr({
      svgrOptions: {
        icon: true,
      },
    }),
    viteStaticCopy({
      targets: [
        {
          src: "src/components/shared/icons/*.svg",
          dest: "icons",
        },
      ],
    }),
    standardCssModules({
      include: ["/**/minerva-author-ui/**/*.css"],
    }),
  ],
  optimizeDeps: {
    exclude: ["minerva-author-ui", "onnxruntime-web", "psudo"],
    include: [
      "@luma.gl/core",
      "@luma.gl/constants",
      "@luma.gl/engine",
      "@luma.gl/shadertools",
      "@luma.gl/webgl",
      "@luma.gl/gltf",
      "@deck.gl/core",
      "@deck.gl/layers",
      "@deck.gl/react",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "geotiff",
      "@luma.gl/core",
      "@luma.gl/constants",
      "@luma.gl/engine",
      "@luma.gl/shadertools",
      "@luma.gl/webgl",
      "@luma.gl/gltf",
      "@deck.gl/core",
      "@deck.gl/layers",
      "@deck.gl/extensions",
      "@deck.gl/geo-layers",
      "@deck.gl/mesh-layers",
      "@deck.gl/react",
      "@deck.gl/widgets",
    ],
  },
  build: {
    minify: false,
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
          return;
        }
        warn(warning);
      },
      output: {
        format: "es",
      },
    },
  },
});

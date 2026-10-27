import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import mkcert from "vite-plugin-mkcert";
import svgr from "vite-plugin-svgr";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";
import { gitSha } from "./vite.gitSha.js";

/** ISO UTC time baked into each bundle; override in CI with `VITE_APP_BUILD_TIME` (ISO-8601). */
const BUILD_TIME_ISO =
  process.env.VITE_APP_BUILD_TIME ?? new Date().toISOString();

/**
 * kiln-render (3D volumes) may be linked from a sibling checkout; the dev
 * server must be allowed to serve its real path outside this workspace.
 */
const kilnRealPath = (() => {
  try {
    return fs.realpathSync(path.resolve(__dirname, "node_modules/kiln-render"));
  } catch {
    return null;
  }
})();

/**
 * Dev only: serve the built story player (`bundle/`) as plain files. Through
 * Vite's module pipeline its JS comes back rewritten for the dev server, and
 * exports copy those bytes into the story folder (storyBundle.ts).
 */
function serveBuiltPlayer() {
  const dir = path.resolve(__dirname, "bundle");
  const types = {
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
  };
  return {
    name: "minerva-serve-built-player",
    configureServer(server) {
      server.middlewares.use("/bundle", (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
        const file = path.resolve(dir, `.${rel}`);
        if (!file.startsWith(`${dir}${path.sep}`) || !fs.existsSync(file)) {
          next();
          return;
        }
        res.setHeader(
          "Content-Type",
          types[path.extname(file)] ?? "application/octet-stream",
        );
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const useMkcert =
    command === "serve" &&
    process.env.CI !== "true" &&
    !process.argv.includes("build");

  return {
    define: {
      __BUILD_TIME_ISO__: JSON.stringify(BUILD_TIME_ISO),
      __BUILD_GIT_SHA__: JSON.stringify(gitSha()),
    },
    assetsInclude: ["**/*.wasm"],
    worker: {
      format: "es",
      plugins: () => [wasm(), topLevelAwait()],
    },
    server: {
      https: true,
      fs: {
        allow: [
          searchForWorkspaceRoot(process.cwd()),
          ...(kilnRealPath ? [kilnRealPath] : []),
        ],
      },
      hmr: {
        overlay: true,
      },
    },
    base: process.env.BASE_PATH ?? "",
    plugins: [
      serveBuiltPlayer(),
      wasm(),
      topLevelAwait(),
      react(),
      useMkcert && mkcert(),
      svgr({
        svgrOptions: {
          icon: true,
        },
      }),
    ].filter(Boolean),
    optimizeDeps: {
      exclude: [
        "onnxruntime-web",
        "psudo",
        "@jsquash/jpeg",
        "@duckdb/duckdb-wasm",
        // kiln-render ships Brush (wasm-bindgen), which finds its .wasm via
        // import.meta.url; pre-bundling would move it.
        "kiln-render",
      ],
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
        "geotiff",
        "lzw-tiff-decoder",
      ],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        psudo: path.resolve(__dirname, "./node_modules/psudo/index.js"),
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
  };
});

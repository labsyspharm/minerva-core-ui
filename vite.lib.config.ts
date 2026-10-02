import path from "node:path";
import { defineConfig } from "vite";
import bundle from "./vite.bundle.config";

/**
 * React component library build of the story player (`<MinervaStory>`):
 * lib/minerva.js (ES module) + lib/minerva.css. Same graph, plugins and stubs
 * as the CDN bundle, but React stays external so the host app's React renders
 * it. Other dependencies are bundled: the viv fork is pinned via pnpm
 * overrides, which do not apply to consumers.
 */
export default defineConfig({
  ...bundle,
  build: {
    ...bundle.build,
    outDir: "lib",
    lib: {
      entry: path.resolve(__dirname, "src/embed/index.ts"),
      formats: ["es"],
      fileName: () => "minerva.js",
    },
    rollupOptions: {
      ...bundle.build?.rollupOptions,
      external: [/^react($|\/)/, /^react-dom($|\/)/],
    },
  },
});

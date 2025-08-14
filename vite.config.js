import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  server: { 
    https: true,
    hmr: {
      overlay: true
    }
  },
  plugins: [
    react(),
    mkcert(), 
  ],
  optimizeDeps: {
    exclude: [ "minerva-author-ui" ]
  },
  build: {
    optimizeDeps: {
      exclude: [ "minerva-author-ui" ]
    },
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
    }
  }
})

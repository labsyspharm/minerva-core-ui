import { defineConfig } from 'vite'
import { standardCssModules } from 'vite-plugin-standard-css-modules';
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import svgr from 'vite-plugin-svgr'
import path from 'path'

export default defineConfig({
  worker: {
    format: "es"
  },
  server: { 
    https: true,
    hmr: {
      overlay: true
    }
  },
  base: '',
  plugins: [
    react(),
    mkcert(),
    svgr({
      svgrOptions: {
        icon: true,
      },
    }),
		standardCssModules({
			include: ["/**/minerva-author-ui/**/*.css"],
    })
  ],
  optimizeDeps: {
    exclude: [ "minerva-author-ui" ],
    include: [
      '@luma.gl/core',
      '@luma.gl/constants',
      '@luma.gl/engine',
      '@luma.gl/shadertools',
      '@luma.gl/webgl',
      '@luma.gl/gltf',
      '@deck.gl/core',
      '@deck.gl/layers',
      '@deck.gl/react'
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    dedupe: [
      '@luma.gl/core',
      '@luma.gl/constants', 
      '@luma.gl/engine',
      '@luma.gl/shadertools',
      '@luma.gl/webgl',
      '@luma.gl/gltf',
      '@deck.gl/core',
      '@deck.gl/layers',
      '@deck.gl/extensions',
      '@deck.gl/geo-layers',
      '@deck.gl/mesh-layers',
      '@deck.gl/react',
      '@deck.gl/widgets'
    ]
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
        format: "es"
      }
    }
  }
})

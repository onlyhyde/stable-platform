import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { build, defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// Plugin to copy manifest and assets
function copyManifestPlugin() {
  return {
    name: 'copy-manifest',
    closeBundle() {
      // Ensure dist directory exists
      const distDir = resolve(__dirname, 'dist')
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true })
      }
      // Copy manifest.json with version synced from package.json
      const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
      const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'))
      manifest.version = pkg.version
      writeFileSync(resolve(__dirname, 'dist/manifest.json'), JSON.stringify(manifest, null, 2))
      // Copy networks.json
      const networksJson = resolve(__dirname, 'public/networks.json')
      if (existsSync(networksJson)) {
        copyFileSync(networksJson, resolve(__dirname, 'dist/networks.json'))
      }
      // Create icons directory if not exists
      const iconsDir = resolve(__dirname, 'dist/icons')
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true })
      }
      // Copy all icons (including state variants)
      const iconSizes = ['16', '32', '48', '128']
      const iconStates = ['', '-locked', '-gray', '-pending']
      for (const size of iconSizes) {
        for (const state of iconStates) {
          const srcIcon = resolve(__dirname, `public/icons/icon-${size}${state}.png`)
          const destIcon = resolve(__dirname, `dist/icons/icon-${size}${state}.png`)
          if (existsSync(srcIcon)) {
            copyFileSync(srcIcon, destIcon)
          }
        }
      }
    },
  }
}

// Plugin to build standalone scripts (content script, inpage, background service worker)
function buildStandaloneScripts() {
  return {
    name: 'build-standalone-scripts',
    async closeBundle() {
      // Build background service worker as a standalone ES module (no code splitting)
      // This ensures the Buffer polyfill is inlined before any code that uses it,
      // avoiding the ESM import hoisting issue with shared chunks.
      await build({
        configFile: false,
        plugins: [
          nodePolyfills({
            include: ['buffer'],
            globals: { Buffer: true },
          }),
        ],
        define: {
          'process.env': '{}',
          'process.env.NODE_ENV': JSON.stringify('production'),
        },
        build: {
          emptyOutDir: false,
          outDir: 'dist',
          rollupOptions: {
            input: resolve(__dirname, 'src/background/index.ts'),
            output: {
              format: 'es',
              entryFileNames: 'background.js',
              inlineDynamicImports: true,
            },
          },
          chunkSizeWarningLimit: 1200,
          minify: true,
          sourcemap: false,
        },
        resolve: {
          alias: {
            '@': resolve(__dirname, 'src'),
          },
        },
      })

      // Build content script as IIFE
      await build({
        configFile: false,
        define: {
          'process.env': '{}',
          'process.env.NODE_ENV': JSON.stringify('production'),
        },
        build: {
          emptyOutDir: false,
          outDir: 'dist',
          lib: {
            entry: resolve(__dirname, 'src/contentscript/index.ts'),
            name: 'contentscript',
            formats: ['iife'],
            fileName: () => 'contentscript.js',
          },
          rollupOptions: {
            output: {
              extend: true,
            },
          },
          minify: true,
          sourcemap: false,
        },
      })

      // Build inpage script as IIFE
      await build({
        configFile: false,
        define: {
          'process.env': '{}',
          'process.env.NODE_ENV': JSON.stringify('production'),
        },
        build: {
          emptyOutDir: false,
          outDir: 'dist',
          lib: {
            entry: resolve(__dirname, 'src/inpage/index.ts'),
            name: 'inpage',
            formats: ['iife'],
            fileName: () => 'inpage.js',
          },
          rollupOptions: {
            output: {
              extend: true,
            },
          },
          minify: true,
          sourcemap: false,
        },
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), copyManifestPlugin(), buildStandaloneScripts()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/ui/popup.html'),
        sidepanel: resolve(__dirname, 'src/ui/sidepanel.html'),
        approval: resolve(__dirname, 'src/approval/approval.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})

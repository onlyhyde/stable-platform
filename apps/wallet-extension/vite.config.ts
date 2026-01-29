import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { build } from 'vite'

// Plugin to copy manifest and assets
function copyManifestPlugin() {
  return {
    name: 'copy-manifest',
    closeBundle() {
      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
      )
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

// Plugin to build content script and inpage as IIFE
function buildIIFEScripts() {
  return {
    name: 'build-iife-scripts',
    async closeBundle() {
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
  plugins: [react(), copyManifestPlugin(), buildIIFEScripts()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/ui/popup.html'),
        approval: resolve(__dirname, 'src/approval/approval.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
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

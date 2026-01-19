import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

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
      // Copy icons if they exist
      const iconSizes = ['16', '32', '48', '128']
      for (const size of iconSizes) {
        const srcIcon = resolve(__dirname, `public/icons/icon-${size}.png`)
        const destIcon = resolve(__dirname, `dist/icons/icon-${size}.png`)
        if (existsSync(srcIcon)) {
          copyFileSync(srcIcon, destIcon)
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), copyManifestPlugin()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/ui/popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        contentscript: resolve(__dirname, 'src/contentscript/index.ts'),
        inpage: resolve(__dirname, 'src/inpage/index.ts'),
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

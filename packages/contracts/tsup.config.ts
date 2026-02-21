import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/addresses.ts', 'src/watcher.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  external: ['chokidar'],
})

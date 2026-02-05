import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/interfaces.ts', 'src/viem-adapter.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: ['viem'],
})

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
    wagmi: 'src/wagmi.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'viem', '@wagmi/core', '@stablenet/core', '@stablenet/sdk-types'],
  treeshake: true,
})

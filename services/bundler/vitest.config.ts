import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@stablenet/core': resolve(__dirname, '../../packages/sdk-ts/core/src'),
      '@stablenet/types': resolve(__dirname, '../../packages/types/src'),
      '@stablenet/contracts': resolve(__dirname, '../../packages/contracts/src'),
    },
  },
})

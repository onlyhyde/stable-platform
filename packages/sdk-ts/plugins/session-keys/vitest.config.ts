import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@stablenet/sdk-types': resolve(__dirname, '../../../types/src'),
      '@stablenet/core': resolve(__dirname, '../../packages/core/src'),
    },
  },
})

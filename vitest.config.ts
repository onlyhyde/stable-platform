import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 60000,
    hookTimeout: 30000,
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@stablenet/core': './packages/sdk/packages/core/src',
      '@stablenet/accounts': './packages/sdk/packages/accounts/src',
      '@stablenet/types': './packages/sdk/packages/types/src',
    },
  },
})

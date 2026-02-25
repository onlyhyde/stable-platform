import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')

export default defineConfig({
  resolve: {
    alias: {
      '@stablenet/core': resolve(root, 'packages/sdk-ts/core/dist/index.js'),
      '@stablenet/contracts': resolve(root, 'packages/contracts/dist/index.js'),
      '@stablenet/types': resolve(root, 'packages/types/dist/index.js'),
      '@stablenet/sdk-types': resolve(root, 'packages/sdk-ts/types/dist/index.js'),
      '@stablenet/config': resolve(root, 'packages/config/dist/index.js'),
      '@stablenet/sdk-crypto': resolve(root, 'packages/sdk-ts/crypto/dist/index.js'),
      '@stablenet/accounts': resolve(root, 'packages/sdk-ts/accounts/dist/index.js'),
      '@stablenet/sdk-addresses': resolve(root, 'packages/sdk-ts/addresses/dist/index.js'),
    },
  },
  test: {
    globals: false,
  },
})

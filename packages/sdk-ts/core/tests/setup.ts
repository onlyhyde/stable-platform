/**
 * Vitest Test Setup
 *
 * Global test configuration and setup for the core package.
 */

import { afterAll, beforeAll, vi } from 'vitest'

// Mock crypto for environments that don't have it
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = await import('node:crypto')
  globalThis.crypto = webcrypto as Crypto
}

// Mock fetch if not available
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn()
}

// Global test timeout
beforeAll(() => {
  vi.setConfig({ testTimeout: 30000 })
})

// Cleanup after all tests
afterAll(() => {
  vi.restoreAllMocks()
})

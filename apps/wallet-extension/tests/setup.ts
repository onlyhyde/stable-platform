import '@testing-library/jest-dom'
import * as crypto from 'crypto'
import { TextDecoder, TextEncoder } from 'util'
import { mockChrome } from './utils/mockChrome'

// Mock @stablenet/core module - use real exports with specific mocks
// Note: jest.mock is hoisted, so mock objects must be defined inside the factory function
jest.mock('@stablenet/core', () => {
  const actual = jest.requireActual('@stablenet/core')

  // Mock rate limiter instance (defined inside factory to avoid hoisting issues)
  const mockRateLimiter = {
    checkLimit: jest.fn().mockReturnValue({
      allowed: true,
      remaining: 100,
      resetAt: Date.now() + 60000,
    }),
    getStatus: jest.fn().mockReturnValue({
      allowed: true,
      remaining: 100,
      resetAt: Date.now() + 60000,
    }),
    reset: jest.fn(),
    resetAll: jest.fn(),
    destroy: jest.fn(),
    getLimitConfig: jest.fn().mockReturnValue({ maxRequests: 100, windowMs: 60000 }),
    setLimits: jest.fn(),
    getStats: jest
      .fn()
      .mockReturnValue({ totalOrigins: 0, blockedOrigins: 0, requestsByCategory: {} }),
  }

  // Mock typed data validator instance (defined inside factory to avoid hoisting issues)
  const mockTypedDataValidator = {
    validateTypedData: jest.fn().mockReturnValue({
      isValid: true,
      warnings: [],
      errors: [],
    }),
    getRiskLevel: jest.fn().mockReturnValue('low'),
    formatWarningsForDisplay: jest.fn().mockReturnValue([]),
  }

  return {
    ...actual,
    // Override specific EIP-7702 functions with mocks for handler tests
    createAuthorizationHash: jest.fn().mockReturnValue(`0x${'00'.repeat(32)}`),
    createAuthorization: jest.fn().mockReturnValue({
      chainId: 1n,
      address: `0x${'00'.repeat(20)}`,
      nonce: 0n,
    }),
    createRevocationAuthorization: jest.fn().mockReturnValue({
      chainId: 1n,
      address: `0x${'00'.repeat(20)}`,
      nonce: 0n,
    }),
    parseSignature: jest.fn().mockReturnValue({
      r: `0x${'00'.repeat(32)}`,
      s: `0x${'00'.repeat(32)}`,
      v: 27n,
    }),
    createSignedAuthorization: jest.fn().mockReturnValue({
      chainId: 1n,
      address: `0x${'00'.repeat(20)}`,
      nonce: 0n,
      r: `0x${'00'.repeat(32)}`,
      s: `0x${'00'.repeat(32)}`,
      v: 27n,
    }),
    isDelegatedAccount: jest.fn().mockReturnValue(false),
    extractDelegateAddress: jest.fn().mockReturnValue(null),
    getDelegationStatus: jest.fn().mockReturnValue({ isDelegated: false, delegate: null }),
    getDelegatePresets: jest.fn().mockReturnValue([]),
    isRevocationAuthorization: jest.fn().mockReturnValue(false),
    formatAuthorization: jest.fn().mockReturnValue(''),
    // Rate limiter - use mock for tests
    createRateLimiter: jest.fn().mockReturnValue(mockRateLimiter),
    // Typed data validator - use mock for tests
    createTypedDataValidator: jest.fn().mockReturnValue(mockTypedDataValidator),
  }
})

// Mock @stablenet/plugin-stealth module
jest.mock('@stablenet/plugin-stealth', () => ({
  createStealthPlugin: jest.fn(),
  generateStealthAddress: jest.fn(),
  deriveStealthKeys: jest.fn(),
}))

// Polyfill TextEncoder/TextDecoder for Node.js environment
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder as typeof global.TextDecoder

// Polyfill Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => crypto.randomFillSync(arr),
    subtle: crypto.webcrypto.subtle,
    randomUUID: () => crypto.randomUUID(),
  },
  writable: true,
})

// Setup global Chrome API mock
beforeAll(() => {
  global.chrome = mockChrome
})

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})

// Reset Chrome storage mocks between tests
beforeEach(() => {
  mockChrome.storage.local.clear()
  mockChrome.storage.session.clear()
})

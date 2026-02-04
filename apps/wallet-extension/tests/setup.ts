import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import * as crypto from 'crypto'
import { mockChrome } from './utils/mockChrome'

// Mock @stablenet/core module (ESM module that Jest has trouble with)
jest.mock('@stablenet/core', () => ({
  createAuthorizationHash: jest.fn().mockReturnValue('0x' + '00'.repeat(32)),
  createAuthorization: jest.fn().mockReturnValue({
    chainId: 1n,
    address: '0x' + '00'.repeat(20),
    nonce: 0n,
  }),
  createRevocationAuthorization: jest.fn().mockReturnValue({
    chainId: 1n,
    address: '0x' + '00'.repeat(20),
    nonce: 0n,
  }),
  parseSignature: jest.fn().mockReturnValue({
    r: '0x' + '00'.repeat(32),
    s: '0x' + '00'.repeat(32),
    v: 27n,
  }),
  createSignedAuthorization: jest.fn().mockReturnValue({
    chainId: 1n,
    address: '0x' + '00'.repeat(20),
    nonce: 0n,
    r: '0x' + '00'.repeat(32),
    s: '0x' + '00'.repeat(32),
    v: 27n,
  }),
  isDelegatedAccount: jest.fn().mockReturnValue(false),
  extractDelegateAddress: jest.fn().mockReturnValue(null),
  getDelegationStatus: jest.fn().mockReturnValue({ isDelegated: false, delegate: null }),
  isValidAddress: jest.fn().mockReturnValue(true),
  getDelegatePresets: jest.fn().mockReturnValue([]),
  isRevocationAuthorization: jest.fn().mockReturnValue(false),
  formatAuthorization: jest.fn().mockReturnValue(''),
  EIP7702_MAGIC: 5,
  SETCODE_TX_TYPE: '0x04',
  DELEGATION_PREFIX: '0xef0100',
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  DELEGATE_PRESETS: [],
}))

// Mock @stablenet/plugin-stealth module
jest.mock('@stablenet/plugin-stealth', () => ({
  createStealthPlugin: jest.fn(),
  generateStealthAddress: jest.fn(),
  deriveStealthKeys: jest.fn(),
}))

// Mock rate limiter to always allow requests in tests
jest.mock('../src/shared/security/rateLimiter', () => ({
  rateLimiter: {
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
  },
  RateLimiter: jest.fn().mockImplementation(() => ({
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
    getStats: jest.fn().mockReturnValue({ totalOrigins: 0, blockedOrigins: 0, requestsByCategory: {} }),
  })),
  DEFAULT_LIMITS: {
    sensitive: { maxRequests: 5, windowMs: 60000 },
    signing: { maxRequests: 10, windowMs: 60000 },
    connection: { maxRequests: 10, windowMs: 60000 },
    read: { maxRequests: 100, windowMs: 60000 },
    default: { maxRequests: 60, windowMs: 60000 },
  },
  METHOD_CATEGORIES: {},
}))

// Mock typed data validator to return valid by default in tests
jest.mock('../src/shared/security/typedDataValidator', () => ({
  typedDataValidator: {
    validateTypedData: jest.fn().mockReturnValue({
      isValid: true,
      warnings: [],
      errors: [],
    }),
    getRiskLevel: jest.fn().mockReturnValue('low'),
    formatWarningsForDisplay: jest.fn().mockReturnValue([]),
  },
  TypedDataValidator: jest.fn().mockImplementation(() => ({
    validateTypedData: jest.fn().mockReturnValue({
      isValid: true,
      warnings: [],
      errors: [],
    }),
    getRiskLevel: jest.fn().mockReturnValue('low'),
    formatWarningsForDisplay: jest.fn().mockReturnValue([]),
  })),
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

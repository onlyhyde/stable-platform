import '@testing-library/jest-dom'
import * as crypto from 'crypto'
import type React from 'react'
import { TextDecoder, TextEncoder } from 'util'
// Import English locale files for i18n mock
import enActivity from '../src/i18n/locales/en/activity.json'
import enApproval from '../src/i18n/locales/en/approval.json'
import enBuy from '../src/i18n/locales/en/buy.json'
import enCommon from '../src/i18n/locales/en/common.json'
import enHome from '../src/i18n/locales/en/home.json'
import enLock from '../src/i18n/locales/en/lock.json'
import enModules from '../src/i18n/locales/en/modules.json'
import enOnboarding from '../src/i18n/locales/en/onboarding.json'
import enSend from '../src/i18n/locales/en/send.json'
import enSettings from '../src/i18n/locales/en/settings.json'
import enSwap from '../src/i18n/locales/en/swap.json'
import enTx from '../src/i18n/locales/en/tx.json'
import { mockChrome } from './utils/mockChrome'

// Mock react-i18next - return English translations so existing tests work
const enResources: Record<string, Record<string, string>> = {
  common: enCommon,
  home: enHome,
  lock: enLock,
  onboarding: enOnboarding,
  send: enSend,
  activity: enActivity,
  settings: enSettings,
  approval: enApproval,
  modules: enModules,
  swap: enSwap,
  buy: enBuy,
  tx: enTx,
}

function createTFunction(ns: string) {
  return (key: string, params?: Record<string, unknown>) => {
    const resource = enResources[ns] ?? enResources.common
    let value = resource[key] ?? enResources.common[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
      }
    }
    return value
  }
}

jest.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: createTFunction(ns ?? 'common'),
    i18n: {
      language: 'en',
      changeLanguage: jest.fn().mockResolvedValue(undefined),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: jest.fn() },
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

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

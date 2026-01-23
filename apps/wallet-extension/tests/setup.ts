import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import * as crypto from 'crypto'
import { mockChrome } from './utils/mockChrome'

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

/**
 * Test setup for @stablenet/plugin-defi
 */

import { expect, vi } from 'vitest'

// Extend Vitest with custom matchers if needed
declare module 'vitest' {
  interface Assertion<T> {
    toBeBigInt(): void
    toBeValidAddress(): void
  }
}

// Custom matcher for BigInt
expect.extend({
  toBeBigInt(received: unknown) {
    const pass = typeof received === 'bigint'
    return {
      pass,
      message: () =>
        pass ? `expected ${received} not to be a BigInt` : `expected ${received} to be a BigInt`,
    }
  },
  toBeValidAddress(received: unknown) {
    const pass = typeof received === 'string' && /^0x[a-fA-F0-9]{40}$/.test(received)
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid Ethereum address`
          : `expected ${received} to be a valid Ethereum address`,
    }
  },
})

// Mock viem if needed for unit tests
vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    // Add any mocks needed
  }
})

// Global test utilities
export const TEST_ADDRESSES = {
  ZERO: '0x0000000000000000000000000000000000000000' as const,
  USER: '0x1234567890123456789012345678901234567890' as const,
  SMART_ACCOUNT: '0xabcdef0123456789abcdef0123456789abcdef01' as const,
  EXECUTOR: '0x2345678901234567890123456789012345678901' as const,
  HOOK: '0x3456789012345678901234567890123456789012' as const,
  TOKEN_A: '0x4567890123456789012345678901234567890123' as const,
  TOKEN_B: '0x5678901234567890123456789012345678901234' as const,
  POOL: '0x6789012345678901234567890123456789012345' as const,
  ROUTER: '0x7890123456789012345678901234567890123456' as const,
  MERCHANT: '0x8901234567890123456789012345678901234567' as const,
} as const

export const TEST_VALUES = {
  ONE_ETH: BigInt('1000000000000000000'),
  TEN_ETH: BigInt('10000000000000000000'),
  HUNDRED_ETH: BigInt('100000000000000000000'),
  ONE_THOUSAND_USDC: BigInt('1000000000'), // 6 decimals
  HEALTH_FACTOR_1_2: BigInt('1200000000000000000'),
  HEALTH_FACTOR_1_5: BigInt('1500000000000000000'),
  HEALTH_FACTOR_2_0: BigInt('2000000000000000000'),
  MAX_UINT256: BigInt(
    '115792089237316195423570985008687907853269984665640564039457584007913129639935'
  ),
} as const

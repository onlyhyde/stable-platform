/**
 * Test setup for @stablenet/plugin-modules
 */

import { vi } from 'vitest'

// Test addresses
export const TEST_ADDRESSES = {
  ZERO: '0x0000000000000000000000000000000000000000' as const,
  SMART_ACCOUNT: '0x1234567890123456789012345678901234567890' as const,
  OWNER: '0xabcdef0123456789abcdef0123456789abcdef01' as const,
  VALIDATOR: '0x2345678901234567890123456789012345678901' as const,
  EXECUTOR: '0x3456789012345678901234567890123456789012' as const,
  HOOK: '0x4567890123456789012345678901234567890123' as const,
  FALLBACK: '0x5678901234567890123456789012345678901234' as const,
  TOKEN: '0x6789012345678901234567890123456789012345' as const,
  SESSION_KEY: '0x7890123456789012345678901234567890123456' as const,
  TARGET: '0x8901234567890123456789012345678901234567' as const,
} as const

// Test values
export const TEST_VALUES = {
  ONE_ETH: BigInt('1000000000000000000'),
  TEN_ETH: BigInt('10000000000000000000'),
  HEALTH_FACTOR_1_2: BigInt('1200000000000000000'),
  HEALTH_FACTOR_1_5: BigInt('1500000000000000000'),
  ONE_DAY: BigInt(86400),
  ONE_WEEK: BigInt(604800),
} as const

// Mock viem client for testing
export function createMockPublicClient() {
  return {
    readContract: vi.fn(),
    simulateContract: vi.fn(),
    getCode: vi.fn(),
    getBlockNumber: vi.fn(),
    getChainId: vi.fn().mockResolvedValue(1n),
  }
}

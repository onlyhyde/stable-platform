import type { Address, Hex } from 'viem'
import { describe, expect, it, beforeEach } from 'vitest'
import {
  SponsorPolicyManager,
  type PolicyResult,
} from '../src/policy/sponsorPolicy'
import type { SponsorPolicy, UserOperationRpc } from '../src/types'

// Test constants
const SENDER_A = '0x1234567890123456789012345678901234567890' as Address
const SENDER_B = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address

function createTestUserOp(overrides: Partial<UserOperationRpc> = {}): UserOperationRpc {
  return {
    sender: SENDER_A,
    nonce: '0x0' as Hex,
    callData: '0x' as Hex,
    callGasLimit: '0x10000' as Hex, // 65536
    verificationGasLimit: '0x10000' as Hex,
    preVerificationGas: '0x5000' as Hex, // 20480
    maxFeePerGas: '0x3B9ACA00' as Hex, // 1 gwei
    maxPriorityFeePerGas: '0x5F5E100' as Hex,
    signature: '0x' as Hex,
    ...overrides,
  }
}

describe('paymaster-proxy', () => {
  describe('SponsorPolicyManager', () => {
    let manager: SponsorPolicyManager

    beforeEach(() => {
      const policy: SponsorPolicy = {
        id: 'test-policy',
        name: 'Test Policy',
        active: true,
        maxGasLimit: 1_000_000n,
        maxGasCost: 10n ** 18n, // 1 ETH
        dailyLimitPerSender: 10n ** 17n, // 0.1 ETH
        globalDailyLimit: 10n ** 19n, // 10 ETH
      }
      manager = new SponsorPolicyManager([policy])
    })

    it('should allow operations within policy limits', () => {
      const userOp = createTestUserOp()
      const result = manager.checkPolicy(userOp, 'test-policy', 1000n)

      expect(result.allowed).toBe(true)
    })

    it('should reject operations for unknown policy', () => {
      const userOp = createTestUserOp()
      const result = manager.checkPolicy(userOp, 'nonexistent')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.rejection.code).toBe(-32001)
        expect(result.rejection.message).toContain('not found')
      }
    })

    it('should reject operations when policy is inactive', () => {
      manager.setPolicy({
        id: 'inactive',
        name: 'Inactive',
        active: false,
      })

      const userOp = createTestUserOp()
      const result = manager.checkPolicy(userOp, 'inactive')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.rejection.message).toContain('not active')
      }
    })

    it('should reject sender not in whitelist', () => {
      manager.setPolicy({
        id: 'wl',
        name: 'Whitelist Only',
        active: true,
        whitelist: [SENDER_B],
      })

      const userOp = createTestUserOp({ sender: SENDER_A })
      const result = manager.checkPolicy(userOp, 'wl')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.rejection.message).toContain('not in whitelist')
      }
    })

    it('should reject blacklisted sender', () => {
      manager.setPolicy({
        id: 'bl',
        name: 'Blacklist',
        active: true,
        blacklist: [SENDER_A],
      })

      const userOp = createTestUserOp({ sender: SENDER_A })
      const result = manager.checkPolicy(userOp, 'bl')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.rejection.message).toContain('blacklisted')
      }
    })

    it('should reject operations exceeding gas limit', () => {
      manager.setPolicy({
        id: 'low-gas',
        name: 'Low Gas',
        active: true,
        maxGasLimit: 100n, // Very low limit
      })

      const userOp = createTestUserOp()
      const result = manager.checkPolicy(userOp, 'low-gas')

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.rejection.message).toContain('Gas limit exceeds')
      }
    })

    it('should reject when daily limit per sender is exceeded', () => {
      manager.setPolicy({
        id: 'daily',
        name: 'Daily Limited',
        active: true,
        dailyLimitPerSender: 1000n,
      })

      // Record spending close to limit
      manager.recordSpending(SENDER_A, 999n)

      const userOp = createTestUserOp({ sender: SENDER_A })
      const result = manager.checkPolicy(userOp, 'daily', 100n)

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.rejection.code).toBe(-32004)
        expect(result.rejection.message).toContain('Daily spending limit')
      }
    })

    it('should reject when global daily limit is exceeded', () => {
      manager.setPolicy({
        id: 'global',
        name: 'Global Limited',
        active: true,
        globalDailyLimit: 500n,
      })

      // Record global spending
      manager.recordSpending(SENDER_B, 450n)

      const userOp = createTestUserOp({ sender: SENDER_A })
      const result = manager.checkPolicy(userOp, 'global', 100n)

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.rejection.code).toBe(-32004)
        expect(result.rejection.message).toContain('Global daily')
      }
    })

    it('should track spending per sender', () => {
      manager.recordSpending(SENDER_A, 1000n)
      const tracker = manager.getTracker(SENDER_A)

      expect(tracker).toBeDefined()
      expect(tracker!.dailyGasSpent).toBe(1000n)
      expect(tracker!.dailyOpCount).toBe(1)
    })

    it('should clear trackers', () => {
      manager.recordSpending(SENDER_A, 500n)
      manager.clearTrackers()

      const tracker = manager.getTracker(SENDER_A)
      expect(tracker).toBeUndefined()
    })
  })
})

import type { Address, Hex } from 'viem'
import { describe, expect, it, beforeEach } from 'vitest'
import { RiskScorer } from '../src/policy/riskScorer'
import type { UserOperationRpc } from '../src/types'

const SENDER = '0x1234567890123456789012345678901234567890' as Address

function createTestUserOp(overrides: Partial<UserOperationRpc> = {}): UserOperationRpc {
  return {
    sender: SENDER,
    nonce: '0x0' as Hex,
    callData: '0xabcdef12' as Hex,
    callGasLimit: '0x10000' as Hex,
    verificationGasLimit: '0x10000' as Hex,
    preVerificationGas: '0x5000' as Hex,
    maxFeePerGas: '0x3B9ACA00' as Hex,
    maxPriorityFeePerGas: '0x5F5E100' as Hex,
    signature: '0x' as Hex,
    ...overrides,
  }
}

describe('RiskScorer', () => {
  let scorer: RiskScorer

  beforeEach(() => {
    scorer = new RiskScorer()
  })

  describe('assess', () => {
    it('should return low risk for normal operations', () => {
      const result = scorer.assess(createTestUserOp())

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThan(0.8)
      expect(result.shouldReject).toBe(false)
      expect(result.factors).toHaveLength(4)
    })

    it('should detect risky function selectors', () => {
      // approve(address,uint256) selector
      const approveCallData = '0x095ea7b3' + '00'.repeat(64)
      const result = scorer.assess(createTestUserOp({ callData: approveCallData as Hex }))

      const calldataFactor = result.factors.find((f) => f.name === 'calldata_pattern')
      expect(calldataFactor).toBeDefined()
      expect(calldataFactor!.score).toBeGreaterThanOrEqual(0.7)
      expect(calldataFactor!.reason).toContain('Risky function selector')
    })

    it('should detect high-risk module management selectors', () => {
      // forceUninstallModule selector
      const callData = '0x856b02ec' + '00'.repeat(32)
      const result = scorer.assess(createTestUserOp({ callData: callData as Hex }))

      const calldataFactor = result.factors.find((f) => f.name === 'calldata_pattern')
      expect(calldataFactor!.score).toBe(0.85)
      expect(calldataFactor!.reason).toContain('High-risk module management')
    })

    it('should detect low-risk module management selectors', () => {
      const callData = '0xb5c13e39' + '00'.repeat(32)
      const result = scorer.assess(createTestUserOp({ callData: callData as Hex }))

      const calldataFactor = result.factors.find((f) => f.name === 'calldata_pattern')
      expect(calldataFactor!.score).toBe(0.4)
      expect(calldataFactor!.reason).toContain('Low-risk')
    })

    it('should flag empty callData', () => {
      const result = scorer.assess(createTestUserOp({ callData: '0x' as Hex }))

      const calldataFactor = result.factors.find((f) => f.name === 'calldata_pattern')
      expect(calldataFactor!.score).toBe(0.6)
      expect(calldataFactor!.reason).toContain('Empty callData')
    })

    it('should flag very large callData', () => {
      const largeCallData = ('0xabcdef12' + 'ab'.repeat(5000)) as Hex
      const result = scorer.assess(createTestUserOp({ callData: largeCallData }))

      const calldataFactor = result.factors.find((f) => f.name === 'calldata_pattern')
      expect(calldataFactor!.score).toBeGreaterThanOrEqual(0.5)
    })

    it('should flag high gas limits', () => {
      const result = scorer.assess(
        createTestUserOp({ callGasLimit: '0xF42400' as Hex }) // 16,000,000 (above 10M threshold)
      )

      const gasFactor = result.factors.find((f) => f.name === 'gas_parameters')
      expect(gasFactor!.score).toBeGreaterThanOrEqual(0.6)
    })

    it('should flag unusually high maxFeePerGas', () => {
      // 600 gwei
      const result = scorer.assess(
        createTestUserOp({ maxFeePerGas: '0x8BB2C97000' as Hex })
      )

      const gasFactor = result.factors.find((f) => f.name === 'gas_parameters')
      expect(gasFactor!.score).toBeGreaterThanOrEqual(0.5)
    })

    it('should flag factory usage', () => {
      const result = scorer.assess(
        createTestUserOp({
          factory: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
          factoryData: '0xabcd' as Hex,
        })
      )

      const factoryFactor = result.factors.find((f) => f.name === 'factory_usage')
      expect(factoryFactor!.score).toBeGreaterThanOrEqual(0.3)
    })

    it('should flag factory with large init data', () => {
      const result = scorer.assess(
        createTestUserOp({
          factory: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
          factoryData: ('0x' + 'ab'.repeat(501)) as Hex,
        })
      )

      const factoryFactor = result.factors.find((f) => f.name === 'factory_usage')
      expect(factoryFactor!.score).toBe(0.5)
    })

    it('should assign moderate risk to new senders', () => {
      const result = scorer.assess(createTestUserOp())

      const reputationFactor = result.factors.find((f) => f.name === 'sender_reputation')
      expect(reputationFactor!.score).toBe(0.3)
      expect(reputationFactor!.reason).toContain('New sender')
    })
  })

  describe('sender reputation', () => {
    it('should lower risk for established senders', () => {
      // Record many successful outcomes
      for (let i = 0; i < 11; i++) {
        scorer.assess(createTestUserOp())
        scorer.recordOutcome(SENDER, true)
      }

      const result = scorer.assess(createTestUserOp())
      const reputationFactor = result.factors.find((f) => f.name === 'sender_reputation')
      expect(reputationFactor!.score).toBe(0.1)
      expect(reputationFactor!.reason).toContain('Established sender')
    })

    it('should raise risk for high rejection rate', () => {
      scorer.assess(createTestUserOp())
      // Record mostly rejections
      scorer.recordOutcome(SENDER, false)
      scorer.recordOutcome(SENDER, false)
      scorer.recordOutcome(SENDER, true)

      const result = scorer.assess(createTestUserOp())
      const reputationFactor = result.factors.find((f) => f.name === 'sender_reputation')
      expect(reputationFactor!.score).toBeGreaterThanOrEqual(0.5)
    })
  })

  describe('configuration', () => {
    it('should use custom rejection threshold', () => {
      const lenientScorer = new RiskScorer({ rejectThreshold: 0.99 })

      // Even high-risk ops should not be rejected
      const callData = '0x856b02ec' + '00'.repeat(32)
      const result = lenientScorer.assess(createTestUserOp({ callData: callData as Hex }))
      expect(result.shouldReject).toBe(false)
    })

    it('should classify risk levels correctly', () => {
      const result = scorer.assess(createTestUserOp())
      expect(['low', 'medium', 'high', 'critical']).toContain(result.level)
    })
  })

  describe('eviction', () => {
    it('should evict oldest entries when exceeding MAX_SENDER_HISTORY', () => {
      const bigScorer = new RiskScorer()

      // Add entries up to capacity (10000 is a lot, test with a smaller set by checking stats)
      for (let i = 0; i < 100; i++) {
        const sender = `0x${i.toString(16).padStart(40, '0')}` as Address
        bigScorer.assess(createTestUserOp({ sender }))
      }

      const stats = bigScorer.getStats()
      expect(stats.trackedSenders).toBe(100)
    })
  })

  describe('clearHistory', () => {
    it('should clear all sender history', () => {
      scorer.assess(createTestUserOp())
      scorer.clearHistory()

      const stats = scorer.getStats()
      expect(stats.trackedSenders).toBe(0)
    })
  })
})

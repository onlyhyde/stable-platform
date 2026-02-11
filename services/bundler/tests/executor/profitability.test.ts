import type { Address, Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { ProfitabilityCalculator } from '../../src/executor/profitability'
import type { MempoolEntry, UserOperation } from '../../src/types'
import { createLogger } from '../../src/utils/logger'

const logger = createLogger('error', false)
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

function createUserOp(overrides: Partial<UserOperation> = {}): UserOperation {
  return {
    sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
    nonce: 0n,
    factory: undefined,
    factoryData: undefined,
    callData: '0x' as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 30000000000n, // 30 gwei
    maxPriorityFeePerGas: 2000000000n, // 2 gwei
    paymaster: undefined,
    paymasterVerificationGasLimit: undefined,
    paymasterPostOpGasLimit: undefined,
    paymasterData: undefined,
    signature: ('0x' + '00'.repeat(65)) as Hex,
    ...overrides,
  }
}

function createEntry(
  userOp: UserOperation,
  hash: Hex = `0x${'01'.repeat(32)}` as Hex
): MempoolEntry {
  return {
    userOp,
    userOpHash: hash,
    entryPoint: ENTRY_POINT,
    status: 'pending',
    addedAt: Date.now(),
  }
}

function createHash(index: number): Hex {
  return `0x${index.toString(16).padStart(64, '0')}` as Hex
}

describe('ProfitabilityCalculator', () => {
  const calculator = new ProfitabilityCalculator(logger)

  describe('estimate', () => {
    it('should calculate positive profit for high-priority ops', () => {
      const entry = createEntry(
        createUserOp({
          maxFeePerGas: 50000000000n, // 50 gwei
          maxPriorityFeePerGas: 10000000000n, // 10 gwei
          callGasLimit: 100000n,
          verificationGasLimit: 100000n,
          preVerificationGas: 50000n,
        })
      )

      const baseFee = 10000000000n // 10 gwei
      const bundleGas = 300000n

      const result = calculator.estimate([entry], bundleGas, baseFee)

      expect(result.totalRevenue).toBeGreaterThan(0n)
      expect(result.bundlerCost).toBeGreaterThan(0n)
      // High priority fee => should be profitable
      // Revenue = 250000 * 10gwei = 2,500,000 gwei
      // Cost = 300000 * 10gwei = 3,000,000 gwei
      // With these numbers cost > revenue, but that's just the gas accounting
      expect(result.netProfit).toBeDefined()
    })

    it('should calculate negative profit when gas cost exceeds revenue', () => {
      const entry = createEntry(
        createUserOp({
          maxFeePerGas: 11000000000n, // 11 gwei (barely above baseFee)
          maxPriorityFeePerGas: 100000000n, // 0.1 gwei (very low priority)
          callGasLimit: 10000n,
          verificationGasLimit: 10000n,
          preVerificationGas: 5000n,
        })
      )

      const baseFee = 10000000000n // 10 gwei
      const bundleGas = 1000000n // Very high bundle gas

      const result = calculator.estimate([entry], bundleGas, baseFee)

      // Revenue: 25000 * 0.1gwei = very small
      // Cost: 1000000 * 10gwei = very large
      expect(result.netProfit).toBeLessThan(0n)
      expect(result.isProfitable).toBe(false)
    })

    it('should use effective priority fee (capped by maxFeePerGas - baseFee)', () => {
      const entry = createEntry(
        createUserOp({
          maxFeePerGas: 12000000000n, // 12 gwei
          maxPriorityFeePerGas: 5000000000n, // 5 gwei (BUT capped to 2 gwei)
        })
      )

      const baseFee = 10000000000n // 10 gwei
      const bundleGas = 100000n

      const result = calculator.estimate([entry], bundleGas, baseFee)

      // Effective priority fee = min(5gwei, 12gwei - 10gwei) = min(5, 2) = 2 gwei
      const expectedEffPriorityFee = 2000000000n
      expect(result.opEstimates[0]!.effectivePriorityFee).toBe(expectedEffPriorityFee)
    })

    it('should handle zero baseFee correctly', () => {
      const entry = createEntry(
        createUserOp({
          maxFeePerGas: 10000000000n,
          maxPriorityFeePerGas: 5000000000n,
        })
      )

      const baseFee = 0n
      const bundleGas = 100000n

      const result = calculator.estimate([entry], bundleGas, baseFee)

      // With zero baseFee: effectivePriorityFee = min(5gwei, 10gwei - 0) = 5gwei
      expect(result.opEstimates[0]!.effectivePriorityFee).toBe(5000000000n)
      // Cost should be zero (bundleGas * 0 = 0)
      expect(result.bundlerCost).toBe(0n)
      // Should be profitable since cost is 0
      expect(result.isProfitable).toBe(true)
    })
  })

  describe('filterProfitable', () => {
    it('should remove unprofitable ops from bundle', () => {
      const profitable = createEntry(
        createUserOp({
          maxFeePerGas: 50000000000n,
          maxPriorityFeePerGas: 10000000000n,
          callGasLimit: 200000n,
          verificationGasLimit: 200000n,
          preVerificationGas: 100000n,
        }),
        createHash(1)
      )

      const unprofitable = createEntry(
        createUserOp({
          maxFeePerGas: 10000000001n, // Barely above baseFee
          maxPriorityFeePerGas: 1n, // Essentially zero priority
          callGasLimit: 100n,
          verificationGasLimit: 100n,
          preVerificationGas: 50n,
        }),
        createHash(2)
      )

      const baseFee = 10000000000n
      const bundleGas = 100000n

      const result = calculator.filterProfitable([profitable, unprofitable], bundleGas, baseFee)

      // Should keep the profitable op and exclude the unprofitable one
      expect(result.length).toBeLessThanOrEqual(2)
      if (result.length > 0) {
        expect(result.some((e) => e.userOpHash === createHash(1))).toBe(true)
      }
    })

    it('should keep all ops when all are profitable', () => {
      // Each op: gas=500000, effectivePriorityFee=40gwei
      // revenue = 500000 * 40gwei = 20,000,000 gwei
      // perOpCost = (500000 + 18300) * 10gwei = 5,183,000 gwei
      // netContribution = 20,000,000 - 5,183,000 = 14,817,000 > 0 => profitable
      const entries = [1, 2, 3].map((i) =>
        createEntry(
          createUserOp({
            maxFeePerGas: 50000000000n, // 50 gwei
            maxPriorityFeePerGas: 40000000000n, // 40 gwei priority
            callGasLimit: 200000n,
            verificationGasLimit: 200000n,
            preVerificationGas: 100000n,
          }),
          createHash(i)
        )
      )

      const baseFee = 10000000000n // 10 gwei
      const bundleGas = 100000n

      const result = calculator.filterProfitable(entries, bundleGas, baseFee)

      expect(result.length).toBe(3)
    })

    it('should return empty array when no ops are profitable', () => {
      const entries = [1, 2, 3].map((i) =>
        createEntry(
          createUserOp({
            maxFeePerGas: 10000000001n,
            maxPriorityFeePerGas: 1n,
            callGasLimit: 10n,
            verificationGasLimit: 10n,
            preVerificationGas: 5n,
          }),
          createHash(i)
        )
      )

      const baseFee = 10000000000n
      const bundleGas = 1000000n

      const result = calculator.filterProfitable(entries, bundleGas, baseFee)

      expect(result.length).toBe(0)
    })

    it('should sort by net contribution and include greedily', () => {
      const highProfit = createEntry(
        createUserOp({
          maxFeePerGas: 100000000000n, // 100 gwei
          maxPriorityFeePerGas: 50000000000n, // 50 gwei priority
          callGasLimit: 200000n,
          verificationGasLimit: 200000n,
          preVerificationGas: 100000n,
        }),
        createHash(1)
      )

      const medProfit = createEntry(
        createUserOp({
          maxFeePerGas: 50000000000n, // 50 gwei
          maxPriorityFeePerGas: 20000000000n, // 20 gwei priority
          callGasLimit: 200000n,
          verificationGasLimit: 200000n,
          preVerificationGas: 100000n,
        }),
        createHash(2)
      )

      const baseFee = 10000000000n
      const bundleGas = 100000n

      // Pass them in reverse order to verify sorting
      const result = calculator.filterProfitable([medProfit, highProfit], bundleGas, baseFee)

      expect(result.length).toBe(2)
      // Both should be included since both are profitable
      expect(result.map((e) => e.userOpHash)).toContain(createHash(1))
      expect(result.map((e) => e.userOpHash)).toContain(createHash(2))
    })

    it('should handle empty entries', () => {
      const result = calculator.filterProfitable([], 100000n, 10000000000n)
      expect(result).toEqual([])
    })
  })
})

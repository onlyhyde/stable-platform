import type { Address, Hex } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Mempool, type MempoolConfig } from '../../src/mempool/mempool'
import type { UserOperation } from '../../src/types'
import { createLogger } from '../../src/utils/logger'

// Mock logger
const mockLogger = createLogger('error', false)

// Test constants
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const TEST_SENDER_1 = '0x1111111111111111111111111111111111111111' as Address
const TEST_SENDER_2 = '0x2222222222222222222222222222222222222222' as Address

// Helper to create a UserOperation
function createTestUserOp(
  sender: Address,
  nonce: bigint,
  maxFeePerGas = 1000000000n
): UserOperation {
  return {
    sender,
    nonce,
    factory: undefined,
    factoryData: undefined,
    callData: '0x' as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas,
    maxPriorityFeePerGas: maxFeePerGas,
    paymaster: undefined,
    paymasterVerificationGasLimit: undefined,
    paymasterPostOpGasLimit: undefined,
    paymasterData: undefined,
    signature: ('0x' + '00'.repeat(65)) as Hex,
  }
}

// Helper to create a hash
function createHash(index: number): Hex {
  return `0x${index.toString(16).padStart(64, '0')}` as Hex
}

describe('Mempool', () => {
  let mempool: Mempool

  beforeEach(() => {
    vi.useFakeTimers()
    mempool = new Mempool(mockLogger)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic operations', () => {
    it('should add and retrieve UserOperations', () => {
      const userOp = createTestUserOp(TEST_SENDER_1, 0n)
      const hash = createHash(1)

      mempool.add(userOp, hash, ENTRY_POINT)

      const entry = mempool.get(hash)
      expect(entry).toBeDefined()
      expect(entry?.userOp.sender).toBe(TEST_SENDER_1)
    })

    it('should return pending operations sorted by gas price', () => {
      const lowGas = createTestUserOp(TEST_SENDER_1, 0n, 1000000000n)
      const highGas = createTestUserOp(TEST_SENDER_2, 0n, 2000000000n)

      mempool.add(lowGas, createHash(1), ENTRY_POINT)
      mempool.add(highGas, createHash(2), ENTRY_POINT)

      const pending = mempool.getPending(ENTRY_POINT)

      expect(pending.length).toBe(2)
      expect(pending[0].userOp.maxFeePerGas).toBe(2000000000n)
    })
  })

  describe('TTL-based eviction', () => {
    it('should evict entries after TTL expires', async () => {
      const config: MempoolConfig = {
        ttlMs: 30 * 60 * 1000, // 30 minutes
      }
      mempool = new Mempool(mockLogger, config)

      const userOp = createTestUserOp(TEST_SENDER_1, 0n)
      mempool.add(userOp, createHash(1), ENTRY_POINT)

      expect(mempool.size).toBe(1)

      // Advance time by 31 minutes
      vi.advanceTimersByTime(31 * 60 * 1000)

      // Run eviction
      mempool.evictExpired()

      expect(mempool.size).toBe(0)
    })

    it('should not evict entries before TTL expires', () => {
      const config: MempoolConfig = {
        ttlMs: 30 * 60 * 1000,
      }
      mempool = new Mempool(mockLogger, config)

      const userOp = createTestUserOp(TEST_SENDER_1, 0n)
      mempool.add(userOp, createHash(1), ENTRY_POINT)

      // Advance time by 29 minutes
      vi.advanceTimersByTime(29 * 60 * 1000)

      mempool.evictExpired()

      expect(mempool.size).toBe(1)
    })

    it('should keep non-pending entries regardless of TTL', () => {
      const config: MempoolConfig = {
        ttlMs: 30 * 60 * 1000,
      }
      mempool = new Mempool(mockLogger, config)

      const userOp = createTestUserOp(TEST_SENDER_1, 0n)
      const hash = createHash(1)
      mempool.add(userOp, hash, ENTRY_POINT)

      // Mark as submitted (should not be evicted by TTL)
      mempool.updateStatus(hash, 'submitted', '0x123' as Hex)

      vi.advanceTimersByTime(31 * 60 * 1000)
      mempool.evictExpired()

      // Should still exist because it's submitted, not pending
      expect(mempool.size).toBe(1)
    })
  })

  describe('max size eviction', () => {
    it('should evict lowest gas price entries when max size is reached', () => {
      const config: MempoolConfig = {
        maxSize: 3,
      }
      mempool = new Mempool(mockLogger, config)

      // Add 3 entries
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n, 1000n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n, 2000n), createHash(2), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 2n, 3000n), createHash(3), ENTRY_POINT)

      expect(mempool.size).toBe(3)

      // Add 4th entry with higher gas price
      mempool.add(createTestUserOp(TEST_SENDER_2, 0n, 4000n), createHash(4), ENTRY_POINT)

      // Should have evicted the lowest gas price entry (1000n)
      expect(mempool.size).toBe(3)
      expect(mempool.get(createHash(1))).toBeUndefined()
      expect(mempool.get(createHash(4))).toBeDefined()
    })

    it('should reject new entry if its gas price is lower than all existing', () => {
      const config: MempoolConfig = {
        maxSize: 2,
      }
      mempool = new Mempool(mockLogger, config)

      mempool.add(createTestUserOp(TEST_SENDER_1, 0n, 2000n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n, 3000n), createHash(2), ENTRY_POINT)

      // Try to add entry with lowest gas price
      expect(() => {
        mempool.add(createTestUserOp(TEST_SENDER_2, 0n, 1000n), createHash(3), ENTRY_POINT)
      }).toThrow('mempool full')

      expect(mempool.size).toBe(2)
    })
  })

  describe('per-sender limits', () => {
    it('should limit operations per sender', () => {
      const config: MempoolConfig = {
        maxOpsPerSender: 4,
      }
      mempool = new Mempool(mockLogger, config)

      // Add 4 operations from same sender
      for (let i = 0; i < 4; i++) {
        mempool.add(createTestUserOp(TEST_SENDER_1, BigInt(i)), createHash(i), ENTRY_POINT)
      }

      expect(mempool.getBySender(TEST_SENDER_1).length).toBe(4)

      // 5th should fail
      expect(() => {
        mempool.add(createTestUserOp(TEST_SENDER_1, 4n), createHash(5), ENTRY_POINT)
      }).toThrow('sender has too many pending operations')
    })

    it('should allow different senders to have their own limits', () => {
      const config: MempoolConfig = {
        maxOpsPerSender: 2,
      }
      mempool = new Mempool(mockLogger, config)

      // Add 2 from sender 1
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n), createHash(2), ENTRY_POINT)

      // Add 2 from sender 2
      mempool.add(createTestUserOp(TEST_SENDER_2, 0n), createHash(3), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_2, 1n), createHash(4), ENTRY_POINT)

      expect(mempool.size).toBe(4)
      expect(mempool.getBySender(TEST_SENDER_1).length).toBe(2)
      expect(mempool.getBySender(TEST_SENDER_2).length).toBe(2)
    })
  })

  describe('replacement rules', () => {
    it('should allow replacing operation with 10% higher gas price', () => {
      const config: MempoolConfig = {
        minGasPriceIncrease: 10, // 10%
      }
      mempool = new Mempool(mockLogger, config)

      const originalGas = 1000000000n
      const hash = createHash(1)

      mempool.add(createTestUserOp(TEST_SENDER_1, 0n, originalGas), hash, ENTRY_POINT)

      // Replace with 10% higher gas
      const newGas = (originalGas * 110n) / 100n
      const success = mempool.replace(
        hash,
        createTestUserOp(TEST_SENDER_1, 0n, newGas),
        hash // same hash for replacement
      )

      expect(success).toBe(true)
      expect(mempool.get(hash)?.userOp.maxFeePerGas).toBe(newGas)
    })

    it('should reject replacement with less than 10% higher gas price', () => {
      const config: MempoolConfig = {
        minGasPriceIncrease: 10,
      }
      mempool = new Mempool(mockLogger, config)

      const originalGas = 1000000000n
      const hash = createHash(1)

      mempool.add(createTestUserOp(TEST_SENDER_1, 0n, originalGas), hash, ENTRY_POINT)

      // Try to replace with only 5% higher
      const newGas = (originalGas * 105n) / 100n
      const success = mempool.replace(hash, createTestUserOp(TEST_SENDER_1, 0n, newGas), hash)

      expect(success).toBe(false)
      expect(mempool.get(hash)?.userOp.maxFeePerGas).toBe(originalGas)
    })
  })

  describe('automatic eviction', () => {
    it('should run periodic eviction when enabled', () => {
      const config: MempoolConfig = {
        ttlMs: 1000, // 1 second
        evictionIntervalMs: 500, // check every 500ms
      }
      mempool = new Mempool(mockLogger, config)

      const userOp = createTestUserOp(TEST_SENDER_1, 0n)
      mempool.add(userOp, createHash(1), ENTRY_POINT)

      // Start auto eviction
      mempool.startAutoEviction()

      expect(mempool.size).toBe(1)

      // Advance past TTL and eviction interval
      vi.advanceTimersByTime(1500)

      expect(mempool.size).toBe(0)

      // Stop auto eviction
      mempool.stopAutoEviction()
    })
  })

  describe('configuration', () => {
    it('should use default configuration when not provided', () => {
      mempool = new Mempool(mockLogger)

      // Default maxOpsPerSender is 4, so we can only add 4 from same sender
      for (let i = 0; i < 4; i++) {
        mempool.add(createTestUserOp(TEST_SENDER_1, BigInt(i)), createHash(i), ENTRY_POINT)
      }

      expect(mempool.size).toBe(4)

      // But we can add from different senders
      for (let i = 4; i < 8; i++) {
        mempool.add(createTestUserOp(TEST_SENDER_2, BigInt(i - 4)), createHash(i), ENTRY_POINT)
      }

      expect(mempool.size).toBe(8)
    })

    it('should accept custom configuration', () => {
      const config: MempoolConfig = {
        maxSize: 5000,
        maxOpsPerSender: 8,
        ttlMs: 60 * 60 * 1000, // 1 hour
        minGasPriceIncrease: 15,
      }

      mempool = new Mempool(mockLogger, config)
      expect(mempool).toBeDefined()
    })
  })

  describe('nonce ordering', () => {
    it('should return operations in nonce order for same sender', () => {
      mempool = new Mempool(mockLogger)

      // Add out of order
      mempool.add(createTestUserOp(TEST_SENDER_1, 2n), createHash(3), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n), createHash(2), ENTRY_POINT)

      const ops = mempool.getBySender(TEST_SENDER_1)

      // Should be sorted by nonce
      const nonces = ops.map((op) => op.userOp.nonce)
      expect(nonces).toEqual([0n, 1n, 2n])
    })
  })

  describe('nonce continuity validation', () => {
    it('should accept first operation from a sender', () => {
      const config: MempoolConfig = {
        validateNonceContinuity: true,
      }
      mempool = new Mempool(mockLogger, config)

      const userOp = createTestUserOp(TEST_SENDER_1, 0n)
      mempool.add(userOp, createHash(1), ENTRY_POINT)

      expect(mempool.size).toBe(1)
    })

    it('should accept sequential nonces from same sender', () => {
      const config: MempoolConfig = {
        validateNonceContinuity: true,
      }
      mempool = new Mempool(mockLogger, config)

      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n), createHash(2), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 2n), createHash(3), ENTRY_POINT)

      expect(mempool.size).toBe(3)
      expect(mempool.getBySender(TEST_SENDER_1).length).toBe(3)
    })

    it('should reject nonce with gap larger than allowed', () => {
      const config: MempoolConfig = {
        validateNonceContinuity: true,
        maxNonceGap: 0, // No gaps allowed
      }
      mempool = new Mempool(mockLogger, config)

      // Add nonce 0
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(1), ENTRY_POINT)

      // Try to add nonce 2 (skipping 1) - should fail
      expect(() => {
        mempool.add(createTestUserOp(TEST_SENDER_1, 2n), createHash(3), ENTRY_POINT)
      }).toThrow('nonce gap too large')
    })

    it('should allow nonce gap within configured limit', () => {
      const config: MempoolConfig = {
        validateNonceContinuity: true,
        maxNonceGap: 2, // Allow up to 2 gaps
      }
      mempool = new Mempool(mockLogger, config)

      // Add nonce 0
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(1), ENTRY_POINT)

      // Add nonce 2 (gap of 1) - should succeed
      mempool.add(createTestUserOp(TEST_SENDER_1, 2n), createHash(2), ENTRY_POINT)

      expect(mempool.size).toBe(2)
    })

    it('should reject nonce gap exceeding configured limit', () => {
      const config: MempoolConfig = {
        validateNonceContinuity: true,
        maxNonceGap: 1, // Allow only 1 gap
      }
      mempool = new Mempool(mockLogger, config)

      // Add nonce 0
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(1), ENTRY_POINT)

      // Try to add nonce 3 (gap of 2) - should fail
      expect(() => {
        mempool.add(createTestUserOp(TEST_SENDER_1, 3n), createHash(3), ENTRY_POINT)
      }).toThrow('nonce gap too large')
    })

    it('should allow filling gaps in nonces', () => {
      const config: MempoolConfig = {
        validateNonceContinuity: true,
        maxNonceGap: 2,
      }
      mempool = new Mempool(mockLogger, config)

      // Add nonces 0 and 2
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 2n), createHash(3), ENTRY_POINT)

      // Fill the gap with nonce 1
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n), createHash(2), ENTRY_POINT)

      expect(mempool.size).toBe(3)
      const nonces = mempool.getBySender(TEST_SENDER_1).map((e) => e.userOp.nonce)
      expect(nonces).toEqual([0n, 1n, 2n])
    })

    it('should reject duplicate nonce without replacement', () => {
      const config: MempoolConfig = {
        validateNonceContinuity: true,
      }
      mempool = new Mempool(mockLogger, config)

      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(1), ENTRY_POINT)

      // Try to add another operation with same nonce but different hash
      expect(() => {
        mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(2), ENTRY_POINT)
      }).toThrow('nonce already exists')
    })

    it('should allow operations from different senders independently', () => {
      const config: MempoolConfig = {
        validateNonceContinuity: true,
        maxNonceGap: 0,
      }
      mempool = new Mempool(mockLogger, config)

      // Sender 1: nonce 0, 1
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n), createHash(2), ENTRY_POINT)

      // Sender 2: nonce 5 (first op, no constraint on starting nonce)
      mempool.add(createTestUserOp(TEST_SENDER_2, 5n), createHash(3), ENTRY_POINT)

      // Sender 2: nonce 6 (sequential)
      mempool.add(createTestUserOp(TEST_SENDER_2, 6n), createHash(4), ENTRY_POINT)

      expect(mempool.size).toBe(4)
      expect(mempool.getBySender(TEST_SENDER_1).length).toBe(2)
      expect(mempool.getBySender(TEST_SENDER_2).length).toBe(2)
    })

    it('should handle nonce continuity after removal', () => {
      const config: MempoolConfig = {
        validateNonceContinuity: true,
        maxNonceGap: 0,
      }
      mempool = new Mempool(mockLogger, config)

      // Add nonces 0, 1, 2
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n), createHash(2), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 2n), createHash(3), ENTRY_POINT)

      // Remove nonce 1
      mempool.remove(createHash(2))

      // Should be able to add nonce 1 again
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n), createHash(4), ENTRY_POINT)

      expect(mempool.size).toBe(3)
    })

    it('should be disabled by default for backward compatibility', () => {
      // Default config - no nonce validation
      mempool = new Mempool(mockLogger)

      // Add nonces out of order with gaps - should work
      mempool.add(createTestUserOp(TEST_SENDER_1, 5n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(2), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 10n), createHash(3), ENTRY_POINT)

      expect(mempool.size).toBe(3)
    })

    it('should track expected next nonce correctly', () => {
      const config: MempoolConfig = {
        validateNonceContinuity: true,
        maxNonceGap: 0,
      }
      mempool = new Mempool(mockLogger, config)

      // Add nonce 0
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n), createHash(1), ENTRY_POINT)

      // Next expected nonce is 1
      expect(mempool.getNextExpectedNonce(TEST_SENDER_1)).toBe(1n)

      // Add nonce 1
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n), createHash(2), ENTRY_POINT)

      // Next expected nonce is 2
      expect(mempool.getNextExpectedNonce(TEST_SENDER_1)).toBe(2n)
    })

    it('should return undefined for unknown sender next nonce', () => {
      const config: MempoolConfig = {
        validateNonceContinuity: true,
      }
      mempool = new Mempool(mockLogger, config)

      expect(mempool.getNextExpectedNonce(TEST_SENDER_1)).toBeUndefined()
    })
  })

  // ============================================================================
  // Task 3.1: Bundle Priority Optimization
  // ============================================================================

  describe('priority strategies', () => {
    // Helper to create UserOp with specific gas values
    function createUserOpWithGas(
      sender: Address,
      nonce: bigint,
      maxFeePerGas: bigint,
      maxPriorityFeePerGas: bigint
    ): UserOperation {
      return {
        sender,
        nonce,
        factory: undefined,
        factoryData: undefined,
        callData: '0x' as Hex,
        callGasLimit: 100000n,
        verificationGasLimit: 100000n,
        preVerificationGas: 50000n,
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymaster: undefined,
        paymasterVerificationGasLimit: undefined,
        paymasterPostOpGasLimit: undefined,
        paymasterData: undefined,
        signature: ('0x' + '00'.repeat(65)) as Hex,
      }
    }

    describe('gas_price strategy (default)', () => {
      it('should sort by maxFeePerGas descending', () => {
        mempool = new Mempool(mockLogger, { priorityStrategy: 'gas_price' })

        // Add ops with different gas prices
        mempool.add(createUserOpWithGas(TEST_SENDER_1, 0n, 1000n, 500n), createHash(1), ENTRY_POINT)
        mempool.add(
          createUserOpWithGas(TEST_SENDER_2, 0n, 3000n, 1500n),
          createHash(2),
          ENTRY_POINT
        )
        const sender3 = '0x3333333333333333333333333333333333333333' as Address
        mempool.add(createUserOpWithGas(sender3, 0n, 2000n, 1000n), createHash(3), ENTRY_POINT)

        const pending = mempool.getPending(ENTRY_POINT)

        expect(pending[0].userOp.maxFeePerGas).toBe(3000n)
        expect(pending[1].userOp.maxFeePerGas).toBe(2000n)
        expect(pending[2].userOp.maxFeePerGas).toBe(1000n)
      })
    })

    describe('priority_fee strategy', () => {
      it('should sort by maxPriorityFeePerGas descending', () => {
        mempool = new Mempool(mockLogger, { priorityStrategy: 'priority_fee' })

        // Add ops with different priority fees (but same maxFeePerGas)
        mempool.add(createUserOpWithGas(TEST_SENDER_1, 0n, 5000n, 500n), createHash(1), ENTRY_POINT)
        mempool.add(
          createUserOpWithGas(TEST_SENDER_2, 0n, 5000n, 1500n),
          createHash(2),
          ENTRY_POINT
        )
        const sender3 = '0x3333333333333333333333333333333333333333' as Address
        mempool.add(createUserOpWithGas(sender3, 0n, 5000n, 1000n), createHash(3), ENTRY_POINT)

        const pending = mempool.getPending(ENTRY_POINT)

        expect(pending[0].userOp.maxPriorityFeePerGas).toBe(1500n)
        expect(pending[1].userOp.maxPriorityFeePerGas).toBe(1000n)
        expect(pending[2].userOp.maxPriorityFeePerGas).toBe(500n)
      })
    })

    describe('fifo strategy', () => {
      it('should sort by addedAt ascending (first-in-first-out)', () => {
        mempool = new Mempool(mockLogger, { priorityStrategy: 'fifo' })

        // Add ops at different times
        mempool.add(
          createUserOpWithGas(TEST_SENDER_1, 0n, 3000n, 1500n),
          createHash(1),
          ENTRY_POINT
        )
        vi.advanceTimersByTime(1000)
        mempool.add(
          createUserOpWithGas(TEST_SENDER_2, 0n, 5000n, 2500n),
          createHash(2),
          ENTRY_POINT
        )
        vi.advanceTimersByTime(1000)
        const sender3 = '0x3333333333333333333333333333333333333333' as Address
        mempool.add(createUserOpWithGas(sender3, 0n, 1000n, 500n), createHash(3), ENTRY_POINT)

        const pending = mempool.getPending(ENTRY_POINT)

        // First added should be first (regardless of gas price)
        expect(pending[0].userOpHash).toBe(createHash(1))
        expect(pending[1].userOpHash).toBe(createHash(2))
        expect(pending[2].userOpHash).toBe(createHash(3))
      })
    })

    describe('age_weighted strategy', () => {
      it('should boost priority of older operations', () => {
        mempool = new Mempool(mockLogger, {
          priorityStrategy: 'age_weighted',
          ageWeightFactor: 100, // 100 wei boost per second
        })

        // Add a low-gas op first
        mempool.add(createUserOpWithGas(TEST_SENDER_1, 0n, 1000n, 500n), createHash(1), ENTRY_POINT)

        // Wait 30 seconds
        vi.advanceTimersByTime(30000)

        // Add a high-gas op
        mempool.add(
          createUserOpWithGas(TEST_SENDER_2, 0n, 2000n, 1000n),
          createHash(2),
          ENTRY_POINT
        )

        const pending = mempool.getPending(ENTRY_POINT)

        // Old low-gas op (1000 + 30*100 = 4000 effective) should beat new high-gas (2000)
        expect(pending[0].userOpHash).toBe(createHash(1))
        expect(pending[1].userOpHash).toBe(createHash(2))
      })

      it('should not let very old ops dominate forever with max age cap', () => {
        mempool = new Mempool(mockLogger, {
          priorityStrategy: 'age_weighted',
          ageWeightFactor: 100,
          maxAgeBoostMs: 60000, // Max 1 minute boost
        })

        // Add a very low-gas op
        mempool.add(createUserOpWithGas(TEST_SENDER_1, 0n, 100n, 50n), createHash(1), ENTRY_POINT)

        // Wait 10 minutes
        vi.advanceTimersByTime(10 * 60 * 1000)

        // Add a high-gas op
        mempool.add(
          createUserOpWithGas(TEST_SENDER_2, 0n, 10000n, 5000n),
          createHash(2),
          ENTRY_POINT
        )

        const pending = mempool.getPending(ENTRY_POINT)

        // Old op: 100 + (60 * 100) = 6100 (capped at 60s)
        // New op: 10000
        // New high-gas op should still win
        expect(pending[0].userOpHash).toBe(createHash(2))
      })
    })

    describe('profit strategy', () => {
      it('should sort by estimated profit (gas * priorityFee) descending', () => {
        mempool = new Mempool(mockLogger, { priorityStrategy: 'profit' })

        // Op1: total gas = 250000, priority = 500 → profit = 125,000,000
        mempool.add(createUserOpWithGas(TEST_SENDER_1, 0n, 2000n, 500n), createHash(1), ENTRY_POINT)

        // Op2: total gas = 250000, priority = 1000 → profit = 250,000,000
        mempool.add(
          createUserOpWithGas(TEST_SENDER_2, 0n, 2000n, 1000n),
          createHash(2),
          ENTRY_POINT
        )

        const pending = mempool.getPending(ENTRY_POINT)

        // Higher profit first
        expect(pending[0].userOpHash).toBe(createHash(2))
        expect(pending[1].userOpHash).toBe(createHash(1))
      })
    })
  })

  describe('nonce ordering within sender', () => {
    it('should ensure same-sender ops are ordered by nonce in bundle', () => {
      mempool = new Mempool(mockLogger, { priorityStrategy: 'gas_price' })

      // Add ops from same sender with different nonces (out of order by gas)
      mempool.add(createTestUserOp(TEST_SENDER_1, 2n, 3000n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n, 1000n), createHash(2), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n, 2000n), createHash(3), ENTRY_POINT)

      const pending = mempool.getPendingForBundle(ENTRY_POINT)

      // Should be ordered by nonce for same sender
      expect(pending[0].userOp.nonce).toBe(0n)
      expect(pending[1].userOp.nonce).toBe(1n)
      expect(pending[2].userOp.nonce).toBe(2n)
    })

    it('should interleave different senders by priority while maintaining nonce order', () => {
      mempool = new Mempool(mockLogger, { priorityStrategy: 'gas_price' })

      // Sender 1: nonces 0, 1 with high gas
      mempool.add(createTestUserOp(TEST_SENDER_1, 0n, 3000n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n, 2500n), createHash(2), ENTRY_POINT)

      // Sender 2: nonces 0, 1 with medium gas
      mempool.add(createTestUserOp(TEST_SENDER_2, 0n, 2000n), createHash(3), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_2, 1n, 1500n), createHash(4), ENTRY_POINT)

      const pending = mempool.getPendingForBundle(ENTRY_POINT)

      // Sender 1's ops should come before Sender 2's (higher total gas)
      // But within each sender, nonce order is maintained
      const sender1Ops = pending.filter((e) => e.userOp.sender === TEST_SENDER_1)
      const sender2Ops = pending.filter((e) => e.userOp.sender === TEST_SENDER_2)

      // Sender 1: nonce 0 before nonce 1
      expect(sender1Ops[0].userOp.nonce).toBe(0n)
      expect(sender1Ops[1].userOp.nonce).toBe(1n)

      // Sender 2: nonce 0 before nonce 1
      expect(sender2Ops[0].userOp.nonce).toBe(0n)
      expect(sender2Ops[1].userOp.nonce).toBe(1n)
    })

    it('should only include consecutive nonces starting from minimum', () => {
      mempool = new Mempool(mockLogger, { priorityStrategy: 'gas_price' })

      // Sender 1: nonces 1, 3 (gap at 2)
      mempool.add(createTestUserOp(TEST_SENDER_1, 1n, 5000n), createHash(1), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_1, 3n, 5000n), createHash(2), ENTRY_POINT)

      // Sender 2: nonces 0, 1, 2 (consecutive)
      mempool.add(createTestUserOp(TEST_SENDER_2, 0n, 1000n), createHash(3), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_2, 1n, 1000n), createHash(4), ENTRY_POINT)
      mempool.add(createTestUserOp(TEST_SENDER_2, 2n, 1000n), createHash(5), ENTRY_POINT)

      const pending = mempool.getPendingForBundle(ENTRY_POINT)

      // Sender 1: only nonce 1 (nonce 3 skipped due to gap)
      // Sender 2: all 3 nonces (consecutive)
      const sender1Ops = pending.filter((e) => e.userOp.sender === TEST_SENDER_1)
      const sender2Ops = pending.filter((e) => e.userOp.sender === TEST_SENDER_2)

      expect(sender1Ops.length).toBe(1)
      expect(sender1Ops[0].userOp.nonce).toBe(1n)

      expect(sender2Ops.length).toBe(3)
      expect(sender2Ops.map((e) => e.userOp.nonce)).toEqual([0n, 1n, 2n])
    })
  })

  describe('priority configuration', () => {
    it('should use default gas_price strategy when not specified', () => {
      mempool = new Mempool(mockLogger)
      const config = mempool.getConfig()
      expect(config.priorityStrategy).toBe('gas_price')
    })

    it('should allow updating priority strategy at runtime', () => {
      mempool = new Mempool(mockLogger, { priorityStrategy: 'gas_price' })

      mempool.updateConfig({ priorityStrategy: 'priority_fee' })

      const config = mempool.getConfig()
      expect(config.priorityStrategy).toBe('priority_fee')
    })

    it('should allow configuring age weight factor', () => {
      mempool = new Mempool(mockLogger, {
        priorityStrategy: 'age_weighted',
        ageWeightFactor: 200,
      })

      const config = mempool.getConfig()
      expect(config.ageWeightFactor).toBe(200)
    })
  })
})

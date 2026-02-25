import type { Address, Hex } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SponsorPolicyManager } from '../src/policy/sponsorPolicy'
import { ReservationTracker } from '../src/settlement/reservationTracker'
import { SettlementWorker } from '../src/settlement/settlementWorker'
import type { BundlerClient, UserOperationReceipt } from '../src/settlement/bundlerClient'
import type { SponsorPolicy, UserOperationRpc } from '../src/types'
import { validateEntryPoint } from '../src/utils/validation'

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

    describe('Reservation-based accounting', () => {
      it('should create a reservation and return an ID', () => {
        const id = manager.reserveSpending(SENDER_A, 500n)
        expect(id).toBeTruthy()
        expect(typeof id).toBe('string')

        const tracker = manager.getTracker(SENDER_A)
        expect(tracker).toBeDefined()
        expect(tracker!.pendingReservations).toHaveLength(1)
        expect(tracker!.pendingReservations[0].amount).toBe(500n)
        // Confirmed spending should still be 0
        expect(tracker!.dailyGasSpent).toBe(0n)
      })

      it('should count pending reservations toward daily limit', () => {
        manager.setPolicy({
          id: 'res-daily',
          name: 'Reservation Daily',
          active: true,
          dailyLimitPerSender: 1000n,
        })

        // Reserve 900n (pending, not confirmed)
        manager.reserveSpending(SENDER_A, 900n)

        const userOp = createTestUserOp({ sender: SENDER_A })
        const result = manager.checkPolicy(userOp, 'res-daily', 200n)

        expect(result.allowed).toBe(false)
        if (!result.allowed) {
          expect(result.rejection.code).toBe(-32004)
        }
      })

      it('should allow operations when pending + new is within limit', () => {
        manager.setPolicy({
          id: 'res-daily',
          name: 'Reservation Daily',
          active: true,
          dailyLimitPerSender: 1000n,
        })

        manager.reserveSpending(SENDER_A, 400n)

        const userOp = createTestUserOp({ sender: SENDER_A })
        const result = manager.checkPolicy(userOp, 'res-daily', 500n)

        expect(result.allowed).toBe(true)
      })

      it('should settle a reservation into confirmed spending', () => {
        const id = manager.reserveSpending(SENDER_A, 500n)

        const settled = manager.settleReservation(SENDER_A, id)
        expect(settled).toBe(true)

        const tracker = manager.getTracker(SENDER_A)
        expect(tracker!.dailyGasSpent).toBe(500n)
        expect(tracker!.dailyOpCount).toBe(1)
        expect(tracker!.pendingReservations).toHaveLength(0)
      })

      it('should settle with actualAmount when provided', () => {
        const id = manager.reserveSpending(SENDER_A, 500n)

        const settled = manager.settleReservation(SENDER_A, id, 300n)
        expect(settled).toBe(true)

        const tracker = manager.getTracker(SENDER_A)
        // Should use actualAmount (300n), not estimated (500n)
        expect(tracker!.dailyGasSpent).toBe(300n)
        expect(tracker!.dailyOpCount).toBe(1)
        expect(tracker!.pendingReservations).toHaveLength(0)
      })

      it('should cancel a reservation without confirming spending', () => {
        const id = manager.reserveSpending(SENDER_A, 500n)

        const cancelled = manager.cancelReservation(SENDER_A, id)
        expect(cancelled).toBe(true)

        const tracker = manager.getTracker(SENDER_A)
        expect(tracker!.dailyGasSpent).toBe(0n)
        expect(tracker!.dailyOpCount).toBe(0)
        expect(tracker!.pendingReservations).toHaveLength(0)
      })

      it('should return false when cancelling unknown reservation', () => {
        manager.reserveSpending(SENDER_A, 500n)
        const cancelled = manager.cancelReservation(SENDER_A, 'nonexistent')
        expect(cancelled).toBe(false)
      })

      it('should return false when cancelling for unknown sender', () => {
        const cancelled = manager.cancelReservation(SENDER_A, 'any-id')
        expect(cancelled).toBe(false)
      })

      it('should return false when settling unknown reservation', () => {
        manager.reserveSpending(SENDER_A, 500n)

        const settled = manager.settleReservation(SENDER_A, 'nonexistent-id')
        expect(settled).toBe(false)
      })

      it('should return false when settling for unknown sender', () => {
        const settled = manager.settleReservation(SENDER_A, 'any-id')
        expect(settled).toBe(false)
      })

      it('should expire old reservations', () => {
        // Create a reservation
        manager.reserveSpending(SENDER_A, 500n)

        // Manually backdate the reservation to exceed TTL
        const tracker = manager.getTracker(SENDER_A)!
        tracker.pendingReservations[0].createdAt = Date.now() - 6 * 60 * 1000 // 6 minutes ago

        const expired = manager.expireReservations()
        expect(expired).toBe(1)
        expect(tracker.pendingReservations).toHaveLength(0)
      })

      it('should not expire fresh reservations', () => {
        manager.reserveSpending(SENDER_A, 500n)

        const expired = manager.expireReservations()
        expect(expired).toBe(0)

        const tracker = manager.getTracker(SENDER_A)!
        expect(tracker.pendingReservations).toHaveLength(1)
      })

      it('should count pending reservations toward global daily limit', () => {
        manager.setPolicy({
          id: 'res-global',
          name: 'Reservation Global',
          active: true,
          globalDailyLimit: 500n,
        })

        // Reserve from SENDER_B
        manager.reserveSpending(SENDER_B, 450n)

        // Try from SENDER_A
        const userOp = createTestUserOp({ sender: SENDER_A })
        const result = manager.checkPolicy(userOp, 'res-global', 100n)

        expect(result.allowed).toBe(false)
        if (!result.allowed) {
          expect(result.rejection.message).toContain('Global daily')
        }
      })
    })
  })

  describe('ReservationTracker', () => {
    let tracker: ReservationTracker

    beforeEach(() => {
      tracker = new ReservationTracker()
    })

    it('should track a reservation by userOpHash', () => {
      const hash = '0xabc123' as Hex
      tracker.track(hash, SENDER_A, 'res-1', 500n)

      const reservation = tracker.getByUserOpHash(hash)
      expect(reservation).toBeDefined()
      expect(reservation!.reservationId).toBe('res-1')
      expect(reservation!.sender).toBe(SENDER_A)
      expect(reservation!.estimatedAmount).toBe(500n)
      expect(reservation!.userOpHash).toBe(hash)
    })

    it('should look up by reservationId', () => {
      const hash = '0xabc123' as Hex
      tracker.track(hash, SENDER_A, 'res-1', 500n)

      const reservation = tracker.getByReservationId('res-1')
      expect(reservation).toBeDefined()
      expect(reservation!.userOpHash).toBe(hash)
    })

    it('should return undefined for unknown lookups', () => {
      expect(tracker.getByUserOpHash('0xunknown' as Hex)).toBeUndefined()
      expect(tracker.getByReservationId('unknown')).toBeUndefined()
    })

    it('should remove a reservation', () => {
      const hash = '0xabc123' as Hex
      tracker.track(hash, SENDER_A, 'res-1', 500n)

      const removed = tracker.remove(hash)
      expect(removed).toBe(true)
      expect(tracker.getByUserOpHash(hash)).toBeUndefined()
      expect(tracker.getByReservationId('res-1')).toBeUndefined()
    })

    it('should return false when removing unknown hash', () => {
      expect(tracker.remove('0xunknown' as Hex)).toBe(false)
    })

    it('should list pending hashes', () => {
      tracker.track('0x1' as Hex, SENDER_A, 'r1', 100n)
      tracker.track('0x2' as Hex, SENDER_B, 'r2', 200n)

      const pending = tracker.getPendingHashes()
      expect(pending).toHaveLength(2)
      expect(pending).toContain('0x1')
      expect(pending).toContain('0x2')
    })

    it('should report stats', () => {
      expect(tracker.getStats()).toEqual({ total: 0, oldest: null })

      tracker.track('0x1' as Hex, SENDER_A, 'r1', 100n)
      const stats = tracker.getStats()
      expect(stats.total).toBe(1)
      expect(stats.oldest).toBeTypeOf('number')
    })

    it('should expire old reservations', () => {
      tracker.track('0x1' as Hex, SENDER_A, 'r1', 100n)
      tracker.track('0x2' as Hex, SENDER_B, 'r2', 200n)

      // Backdate first reservation
      const reservation = tracker.getByUserOpHash('0x1' as Hex)!
      ;(reservation as { createdAt: number }).createdAt = Date.now() - 10 * 60 * 1000

      const expired = tracker.expireOlderThan(5 * 60 * 1000)
      expect(expired).toBe(1)
      expect(tracker.getByUserOpHash('0x1' as Hex)).toBeUndefined()
      expect(tracker.getByUserOpHash('0x2' as Hex)).toBeDefined()
    })

    it('should clear all reservations', () => {
      tracker.track('0x1' as Hex, SENDER_A, 'r1', 100n)
      tracker.clear()
      expect(tracker.getStats().total).toBe(0)
    })
  })

  describe('SettlementWorker', () => {
    let tracker: ReservationTracker
    let policyManager: SponsorPolicyManager
    let mockBundlerClient: BundlerClient

    beforeEach(() => {
      tracker = new ReservationTracker()
      policyManager = new SponsorPolicyManager()
      mockBundlerClient = {
        getUserOperationReceipt: vi.fn(),
        isAvailable: vi.fn().mockResolvedValue(true),
      } as unknown as BundlerClient
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should settle successful operations', async () => {
      // Set up a reservation
      const reservationId = policyManager.reserveSpending(SENDER_A, 500n)
      tracker.track('0xhash1' as Hex, SENDER_A, reservationId, 500n)

      // Mock bundler returns success receipt
      const mockReceipt: UserOperationReceipt = {
        userOpHash: '0xhash1' as Hex,
        success: true,
        actualGasCost: 300n,
        actualGasUsed: 21000n,
        receipt: { transactionHash: '0xtx1' as Hex, blockNumber: 100n },
      }
      vi.mocked(mockBundlerClient.getUserOperationReceipt).mockResolvedValue(mockReceipt)

      const worker = new SettlementWorker(tracker, policyManager, mockBundlerClient, {
        pollIntervalMs: 100_000, // Won't auto-poll in test
      })

      // Manually trigger a poll
      await (worker as unknown as { poll: () => Promise<void> }).poll()

      // Reservation should be settled with actual gas cost
      const senderTracker = policyManager.getTracker(SENDER_A)
      expect(senderTracker!.dailyGasSpent).toBe(300n)
      expect(senderTracker!.pendingReservations).toHaveLength(0)
      expect(tracker.getStats().total).toBe(0)

      const stats = worker.getStats()
      expect(stats.settled).toBe(1)
      expect(stats.cancelled).toBe(0)
    })

    it('should cancel failed operations', async () => {
      const reservationId = policyManager.reserveSpending(SENDER_A, 500n)
      tracker.track('0xhash2' as Hex, SENDER_A, reservationId, 500n)

      const mockReceipt: UserOperationReceipt = {
        userOpHash: '0xhash2' as Hex,
        success: false,
        actualGasCost: 0n,
        actualGasUsed: 0n,
        receipt: { transactionHash: '0xtx2' as Hex, blockNumber: 101n },
      }
      vi.mocked(mockBundlerClient.getUserOperationReceipt).mockResolvedValue(mockReceipt)

      const worker = new SettlementWorker(tracker, policyManager, mockBundlerClient)
      await (worker as unknown as { poll: () => Promise<void> }).poll()

      // Reservation should be cancelled (no confirmed spending)
      const senderTracker = policyManager.getTracker(SENDER_A)
      expect(senderTracker!.dailyGasSpent).toBe(0n)
      expect(senderTracker!.pendingReservations).toHaveLength(0)
      expect(tracker.getStats().total).toBe(0)

      const stats = worker.getStats()
      expect(stats.settled).toBe(0)
      expect(stats.cancelled).toBe(1)
    })

    it('should skip operations without receipt yet', async () => {
      const reservationId = policyManager.reserveSpending(SENDER_A, 500n)
      tracker.track('0xhash3' as Hex, SENDER_A, reservationId, 500n)

      vi.mocked(mockBundlerClient.getUserOperationReceipt).mockResolvedValue(null)

      const worker = new SettlementWorker(tracker, policyManager, mockBundlerClient)
      await (worker as unknown as { poll: () => Promise<void> }).poll()

      // Should still be pending
      expect(tracker.getStats().total).toBe(1)
      expect(policyManager.getTracker(SENDER_A)!.pendingReservations).toHaveLength(1)
    })

    it('should handle bundler errors gracefully', async () => {
      const reservationId = policyManager.reserveSpending(SENDER_A, 500n)
      tracker.track('0xhash4' as Hex, SENDER_A, reservationId, 500n)

      vi.mocked(mockBundlerClient.getUserOperationReceipt).mockRejectedValue(
        new Error('Connection refused')
      )

      const worker = new SettlementWorker(tracker, policyManager, mockBundlerClient)
      // Should not throw
      await (worker as unknown as { poll: () => Promise<void> }).poll()

      // Still pending, error counted
      expect(tracker.getStats().total).toBe(1)
      expect(worker.getStats().errors).toBe(1)
    })

    it('should start and stop polling', () => {
      const worker = new SettlementWorker(tracker, policyManager, mockBundlerClient, {
        pollIntervalMs: 60_000,
      })

      worker.start()
      worker.start() // Duplicate start should be no-op

      worker.stop()
      worker.stop() // Duplicate stop should be no-op
    })
  })

  describe('validateEntryPoint', () => {
    const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
    const UNKNOWN_ENTRY_POINT = '0x1111111111111111111111111111111111111111' as Address

    it('should return null for supported entry point', () => {
      const result = validateEntryPoint(ENTRY_POINT_V07, [ENTRY_POINT_V07])
      expect(result).toBeNull()
    })

    it('should reject unsupported entry point', () => {
      const result = validateEntryPoint(UNKNOWN_ENTRY_POINT, [ENTRY_POINT_V07])
      expect(result).not.toBeNull()
      expect(result!.code).toBe(-32003)
      expect(result!.message).toBe('EntryPoint not supported')
    })

    it('should be case-insensitive', () => {
      const lowercase = ENTRY_POINT_V07.toLowerCase() as Address
      const result = validateEntryPoint(lowercase, [ENTRY_POINT_V07])
      expect(result).toBeNull()
    })

    it('should return error when no entry points configured', () => {
      const result = validateEntryPoint(ENTRY_POINT_V07, [])
      expect(result).not.toBeNull()
      expect(result!.code).toBe(-32003)
      expect(result!.message).toBe('No supported EntryPoints configured')
    })
  })
})

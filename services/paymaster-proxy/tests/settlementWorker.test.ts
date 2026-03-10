import type { Address, Hex } from 'viem'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ReservationTracker } from '../src/settlement/reservationTracker'
import { SettlementWorker } from '../src/settlement/settlementWorker'
import type { BundlerClient, UserOperationReceipt } from '../src/settlement/bundlerClient'
import { SponsorPolicyManager } from '../src/policy/sponsorPolicy'

// Mock logger
vi.mock('../src/utils/logger', () => ({
  getGlobalLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

// Mock config/constants
vi.mock('../src/config/constants', () => ({
  getDefaultPolicyConfig: vi.fn(() => ({
    maxGasLimit: 5_000_000n,
    maxGasCost: 10n ** 18n,
    dailyLimitPerSender: 10n ** 17n,
    globalDailyLimit: 10n ** 19n,
  })),
}))

const SENDER = '0x1234567890123456789012345678901234567890' as Address
const HASH_1 = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex

function createMockBundlerClient(
  receiptFn: (hash: Hex) => Promise<UserOperationReceipt | null>
): BundlerClient {
  return {
    getUserOperationReceipt: receiptFn,
    isAvailable: vi.fn(async () => true),
  } as unknown as BundlerClient
}

describe('SettlementWorker', () => {
  let tracker: ReservationTracker
  let policyManager: SponsorPolicyManager

  beforeEach(() => {
    tracker = new ReservationTracker()
    policyManager = new SponsorPolicyManager()
  })

  it('should settle successful receipts', async () => {
    const reservationId = policyManager.reserveSpending(SENDER, 5000n)
    tracker.track(HASH_1, SENDER, reservationId, 5000n)

    const bundler = createMockBundlerClient(async () => ({
      userOpHash: HASH_1,
      success: true,
      actualGasCost: 3000n,
      actualGasUsed: 1500n,
      receipt: {
        transactionHash: '0xabc' as Hex,
        blockNumber: 100n,
      },
    }))

    const worker = new SettlementWorker(tracker, policyManager, bundler, {
      pollIntervalMs: 100_000,
    })

    // Trigger a single poll manually (poll is private, call via start/stop or access directly)
    // We access the private poll method via casting
    await (worker as unknown as { poll: () => Promise<void> }).poll()

    expect(tracker.getByUserOpHash(HASH_1)).toBeUndefined()
    const stats = worker.getStats()
    expect(stats.settled).toBe(1)
    expect(stats.cancelled).toBe(0)
  })

  it('should cancel failed receipts', async () => {
    const reservationId = policyManager.reserveSpending(SENDER, 5000n)
    tracker.track(HASH_1, SENDER, reservationId, 5000n)

    const bundler = createMockBundlerClient(async () => ({
      userOpHash: HASH_1,
      success: false,
      actualGasCost: 0n,
      actualGasUsed: 0n,
      receipt: {
        transactionHash: '0xabc' as Hex,
        blockNumber: 100n,
      },
    }))

    const worker = new SettlementWorker(tracker, policyManager, bundler, {
      pollIntervalMs: 100_000,
    })
    await (worker as unknown as { poll: () => Promise<void> }).poll()

    expect(tracker.getByUserOpHash(HASH_1)).toBeUndefined()
    const stats = worker.getStats()
    expect(stats.settled).toBe(0)
    expect(stats.cancelled).toBe(1)
  })

  it('should skip hashes with no receipt yet', async () => {
    const reservationId = policyManager.reserveSpending(SENDER, 5000n)
    tracker.track(HASH_1, SENDER, reservationId, 5000n)

    const bundler = createMockBundlerClient(async () => null)

    const worker = new SettlementWorker(tracker, policyManager, bundler, {
      pollIntervalMs: 100_000,
    })
    await (worker as unknown as { poll: () => Promise<void> }).poll()

    // Should still be tracked
    expect(tracker.getByUserOpHash(HASH_1)).toBeDefined()
    const stats = worker.getStats()
    expect(stats.settled).toBe(0)
    expect(stats.cancelled).toBe(0)
  })

  it('should handle receipt fetch errors with retry counting', async () => {
    const reservationId = policyManager.reserveSpending(SENDER, 5000n)
    tracker.track(HASH_1, SENDER, reservationId, 5000n)

    const bundler = createMockBundlerClient(async () => {
      throw new Error('Network timeout')
    })

    const worker = new SettlementWorker(tracker, policyManager, bundler, {
      pollIntervalMs: 100_000,
      maxRetries: 3,
    })

    // Poll 3 times to hit maxRetries
    for (let i = 0; i < 3; i++) {
      await (worker as unknown as { poll: () => Promise<void> }).poll()
    }

    const stats = worker.getStats()
    expect(stats.errors).toBe(3)
    // Reservation should still exist (left to TTL expiry)
    expect(tracker.getByUserOpHash(HASH_1)).toBeDefined()
  })

  it('should classify module_deinit_failed reason', async () => {
    const reservationId = policyManager.reserveSpending(SENDER, 5000n)
    tracker.track(HASH_1, SENDER, reservationId, 5000n)

    const bundler = createMockBundlerClient(async () => ({
      userOpHash: HASH_1,
      success: false,
      actualGasCost: 0n,
      actualGasUsed: 0n,
      reason: ('0x45b4a14f' + '00'.repeat(32)) as Hex, // ModuleOnUninstallFailed
      receipt: {
        transactionHash: '0xabc' as Hex,
        blockNumber: 100n,
      },
    }))

    const worker = new SettlementWorker(tracker, policyManager, bundler, {
      pollIntervalMs: 100_000,
    })
    await (worker as unknown as { poll: () => Promise<void> }).poll()

    expect(worker.getStats().cancelled).toBe(1)
  })

  it('should start and stop polling', () => {
    const bundler = createMockBundlerClient(async () => null)
    const worker = new SettlementWorker(tracker, policyManager, bundler, {
      pollIntervalMs: 100_000,
    })

    worker.start()
    // Starting again should be no-op
    worker.start()
    worker.stop()

    const stats = worker.getStats()
    expect(stats.lastPollAt).toBeNull()
  })

  it('should return immutable stats', () => {
    const bundler = createMockBundlerClient(async () => null)
    const worker = new SettlementWorker(tracker, policyManager, bundler)

    const stats1 = worker.getStats()
    const stats2 = worker.getStats()
    expect(stats1).not.toBe(stats2) // Different references
    expect(stats1).toEqual(stats2) // Same values
  })
})

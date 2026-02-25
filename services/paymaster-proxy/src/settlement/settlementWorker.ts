import type { BundlerClient } from './bundlerClient'
import type { ReservationTracker } from './reservationTracker'
import type { SponsorPolicyManager } from '../policy/sponsorPolicy'

/**
 * Settlement worker statistics
 */
export interface SettlementStats {
  settled: number
  cancelled: number
  errors: number
  lastPollAt: number | null
}

/**
 * Settlement worker options
 */
interface SettlementWorkerOptions {
  /** Polling interval in ms (default: 15000) */
  pollIntervalMs?: number
  /** Maximum retry errors per hash before giving up (default: 10) */
  maxRetries?: number
}

/**
 * Periodically polls the bundler for UserOperation receipts and settles
 * or cancels reservations accordingly.
 *
 * Graceful degradation:
 * - If bundler is unreachable, logs error and continues polling
 * - TTL expiration in SponsorPolicyManager acts as ultimate fallback
 */
export class SettlementWorker {
  private readonly tracker: ReservationTracker
  private readonly policyManager: SponsorPolicyManager
  private readonly bundlerClient: BundlerClient
  private readonly pollIntervalMs: number
  private readonly maxRetries: number

  private interval: ReturnType<typeof setInterval> | null = null
  private retryCount = new Map<string, number>()

  private stats: SettlementStats = {
    settled: 0,
    cancelled: 0,
    errors: 0,
    lastPollAt: null,
  }

  constructor(
    tracker: ReservationTracker,
    policyManager: SponsorPolicyManager,
    bundlerClient: BundlerClient,
    options?: SettlementWorkerOptions
  ) {
    this.tracker = tracker
    this.policyManager = policyManager
    this.bundlerClient = bundlerClient
    this.pollIntervalMs = options?.pollIntervalMs ?? 15_000
    this.maxRetries = options?.maxRetries ?? 10
  }

  /**
   * Start the settlement polling loop
   */
  start(): void {
    if (this.interval) return

    this.interval = setInterval(() => {
      this.poll().catch((err) => {
        console.error('[settlement-worker] Unexpected poll error:', err)
        this.stats.errors++
      })
    }, this.pollIntervalMs)

    // Allow process to exit without waiting
    if (this.interval.unref) {
      this.interval.unref()
    }
  }

  /**
   * Stop the settlement polling loop
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  /**
   * Get current settlement statistics
   */
  getStats(): SettlementStats {
    return { ...this.stats }
  }

  /**
   * Single poll cycle — iterate pending hashes and query receipts
   */
  private async poll(): Promise<void> {
    this.stats.lastPollAt = Date.now()
    const pendingHashes = this.tracker.getPendingHashes()

    for (const hash of pendingHashes) {
      const reservation = this.tracker.getByUserOpHash(hash)
      if (!reservation) continue

      try {
        const receipt = await this.bundlerClient.getUserOperationReceipt(hash)

        if (!receipt) {
          // Not yet included — skip, will retry next poll
          continue
        }

        if (receipt.success) {
          // Settle with actual gas cost
          this.policyManager.settleReservation(
            reservation.sender,
            reservation.reservationId,
            receipt.actualGasCost
          )
          this.stats.settled++
        } else {
          // UserOp failed — cancel the reservation (release budget)
          this.policyManager.cancelReservation(
            reservation.sender,
            reservation.reservationId
          )
          this.stats.cancelled++
        }

        this.tracker.remove(hash)
        this.retryCount.delete(hash)
      } catch (err) {
        this.stats.errors++
        const retries = (this.retryCount.get(hash) ?? 0) + 1
        this.retryCount.set(hash, retries)

        if (retries >= this.maxRetries) {
          console.error(
            `[settlement-worker] Max retries reached for ${hash}, leaving to TTL expiry`
          )
          this.retryCount.delete(hash)
        } else {
          console.warn(
            `[settlement-worker] Error querying receipt for ${hash} (retry ${retries}):`,
            err instanceof Error ? err.message : err
          )
        }
      }
    }
  }
}

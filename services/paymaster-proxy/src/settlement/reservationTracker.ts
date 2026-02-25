import type { Address, Hex } from 'viem'

/**
 * A tracked reservation mapping userOpHash to reservation details
 */
export interface TrackedReservation {
  /** Reservation ID from SponsorPolicyManager */
  reservationId: string
  /** Smart account sender address */
  sender: Address
  /** Estimated gas cost (wei) */
  estimatedAmount: bigint
  /** UserOperation hash (ERC-4337 standard) */
  userOpHash: Hex
  /** Creation timestamp (ms) */
  createdAt: number
}

/**
 * Tracks userOpHash ↔ reservation mappings for receipt-based settlement.
 *
 * Phase 1: Records reservations with their userOpHash for later lookup.
 * Phase 2: Provides pending hashes for SettlementWorker polling.
 */
export class ReservationTracker {
  private readonly reservations = new Map<Hex, TrackedReservation>()
  private readonly reservationIdIndex = new Map<string, Hex>()

  /**
   * Track a new reservation with its userOpHash
   */
  track(
    userOpHash: Hex,
    sender: Address,
    reservationId: string,
    estimatedAmount: bigint
  ): void {
    const reservation: TrackedReservation = {
      reservationId,
      sender,
      estimatedAmount,
      userOpHash,
      createdAt: Date.now(),
    }
    this.reservations.set(userOpHash, reservation)
    this.reservationIdIndex.set(reservationId, userOpHash)
  }

  /**
   * Look up a reservation by userOpHash
   */
  getByUserOpHash(userOpHash: Hex): TrackedReservation | undefined {
    return this.reservations.get(userOpHash)
  }

  /**
   * Look up a reservation by reservationId
   */
  getByReservationId(reservationId: string): TrackedReservation | undefined {
    const hash = this.reservationIdIndex.get(reservationId)
    if (!hash) return undefined
    return this.reservations.get(hash)
  }

  /**
   * Remove a reservation (after settlement or cancellation)
   */
  remove(userOpHash: Hex): boolean {
    const reservation = this.reservations.get(userOpHash)
    if (!reservation) return false
    this.reservations.delete(userOpHash)
    this.reservationIdIndex.delete(reservation.reservationId)
    return true
  }

  /**
   * Get all pending userOpHashes for polling
   */
  getPendingHashes(): Hex[] {
    return Array.from(this.reservations.keys())
  }

  /**
   * Get tracker statistics for health endpoint
   */
  getStats(): { total: number; oldest: number | null } {
    if (this.reservations.size === 0) {
      return { total: 0, oldest: null }
    }
    let oldest = Date.now()
    for (const r of this.reservations.values()) {
      if (r.createdAt < oldest) {
        oldest = r.createdAt
      }
    }
    return { total: this.reservations.size, oldest }
  }

  /**
   * Expire reservations older than the given duration.
   * Returns the number of expired entries.
   */
  expireOlderThan(ms: number): number {
    const cutoff = Date.now() - ms
    let expired = 0
    for (const [hash, reservation] of this.reservations) {
      if (reservation.createdAt < cutoff) {
        this.reservations.delete(hash)
        this.reservationIdIndex.delete(reservation.reservationId)
        expired++
      }
    }
    return expired
  }

  /**
   * Clear all tracked reservations (for testing)
   */
  clear(): void {
    this.reservations.clear()
    this.reservationIdIndex.clear()
  }
}

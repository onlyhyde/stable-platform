import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Address, Hex } from 'viem'
import type { TrackedReservation } from './reservationTracker'

/**
 * Serializable reservation (bigint → string for JSON)
 */
interface SerializedReservation {
  reservationId: string
  sender: Address
  estimatedAmount: string
  userOpHash: Hex
  createdAt: number
}

/**
 * JSON-file-based persistence layer for ReservationTracker.
 *
 * - `load()`: reads from disk → TrackedReservation[]
 * - `scheduleSave()`: debounced async write (500ms)
 * - `flush()`: immediate sync write (for graceful shutdown)
 *
 * Disabled when dataDir is not provided.
 */
export class ReservationPersistence {
  private readonly filePath: string
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingData: TrackedReservation[] | null = null

  constructor(dataDir: string) {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }
    this.filePath = join(dataDir, 'reservations.json')
  }

  /**
   * Load reservations from disk.
   * Returns empty array if file doesn't exist or is corrupted.
   */
  load(): TrackedReservation[] {
    if (!existsSync(this.filePath)) {
      return []
    }

    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed: SerializedReservation[] = JSON.parse(raw)

      return parsed.map((s) => ({
        reservationId: s.reservationId,
        sender: s.sender,
        estimatedAmount: BigInt(s.estimatedAmount),
        userOpHash: s.userOpHash,
        createdAt: s.createdAt,
      }))
    } catch (err) {
      console.error('[reservation-persistence] Failed to load reservations:', err)
      return []
    }
  }

  /**
   * Schedule a debounced save (500ms). Coalesces rapid mutations.
   */
  scheduleSave(reservations: TrackedReservation[]): void {
    this.pendingData = reservations

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.writeToDisk()
    }, 500)

    if (this.debounceTimer.unref) {
      this.debounceTimer.unref()
    }
  }

  /**
   * Immediately write pending data to disk (for shutdown).
   */
  flush(reservations?: TrackedReservation[]): void {
    if (reservations) {
      this.pendingData = reservations
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    this.writeToDisk()
  }

  private writeToDisk(): void {
    if (!this.pendingData) return

    const serialized: SerializedReservation[] = this.pendingData.map((r) => ({
      reservationId: r.reservationId,
      sender: r.sender,
      estimatedAmount: r.estimatedAmount.toString(),
      userOpHash: r.userOpHash,
      createdAt: r.createdAt,
    }))

    try {
      writeFileSync(this.filePath, JSON.stringify(serialized, null, 2), 'utf-8')
    } catch (err) {
      console.error('[reservation-persistence] Failed to save reservations:', err)
    }

    this.pendingData = null
  }
}

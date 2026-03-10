import type { Address, Hex } from 'viem'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ReservationTracker } from '../src/settlement/reservationTracker'
import type { ReservationPersistence } from '../src/settlement/reservationPersistence'

const SENDER = '0x1234567890123456789012345678901234567890' as Address
const HASH_1 = '0xaaaa' as Hex
const HASH_2 = '0xbbbb' as Hex

describe('ReservationTracker', () => {
  let tracker: ReservationTracker

  beforeEach(() => {
    tracker = new ReservationTracker()
  })

  describe('track and lookup', () => {
    it('should track a reservation by userOpHash', () => {
      tracker.track(HASH_1, SENDER, 'res-1', 1000n)

      const found = tracker.getByUserOpHash(HASH_1)
      expect(found).toBeDefined()
      expect(found!.reservationId).toBe('res-1')
      expect(found!.sender).toBe(SENDER)
      expect(found!.estimatedAmount).toBe(1000n)
    })

    it('should look up by reservationId', () => {
      tracker.track(HASH_1, SENDER, 'res-1', 500n)

      const found = tracker.getByReservationId('res-1')
      expect(found).toBeDefined()
      expect(found!.userOpHash).toBe(HASH_1)
    })

    it('should return undefined for unknown hash', () => {
      expect(tracker.getByUserOpHash('0xdead' as Hex)).toBeUndefined()
    })

    it('should return undefined for unknown reservationId', () => {
      expect(tracker.getByReservationId('nonexistent')).toBeUndefined()
    })
  })

  describe('remove', () => {
    it('should remove a tracked reservation', () => {
      tracker.track(HASH_1, SENDER, 'res-1', 1000n)

      expect(tracker.remove(HASH_1)).toBe(true)
      expect(tracker.getByUserOpHash(HASH_1)).toBeUndefined()
      expect(tracker.getByReservationId('res-1')).toBeUndefined()
    })

    it('should return false for unknown hash', () => {
      expect(tracker.remove('0xdead' as Hex)).toBe(false)
    })
  })

  describe('getPendingHashes', () => {
    it('should return all pending hashes', () => {
      tracker.track(HASH_1, SENDER, 'res-1', 100n)
      tracker.track(HASH_2, SENDER, 'res-2', 200n)

      const hashes = tracker.getPendingHashes()
      expect(hashes).toHaveLength(2)
      expect(hashes).toContain(HASH_1)
      expect(hashes).toContain(HASH_2)
    })

    it('should return empty array when no reservations', () => {
      expect(tracker.getPendingHashes()).toEqual([])
    })
  })

  describe('getStats', () => {
    it('should return zero stats when empty', () => {
      const stats = tracker.getStats()
      expect(stats.total).toBe(0)
      expect(stats.oldest).toBeNull()
    })

    it('should return correct stats with reservations', () => {
      tracker.track(HASH_1, SENDER, 'res-1', 100n)
      tracker.track(HASH_2, SENDER, 'res-2', 200n)

      const stats = tracker.getStats()
      expect(stats.total).toBe(2)
      expect(stats.oldest).toBeDefined()
      expect(stats.oldest).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('expireOlderThan', () => {
    it('should expire old reservations', () => {
      vi.useFakeTimers()

      tracker.track(HASH_1, SENDER, 'res-1', 100n)

      vi.advanceTimersByTime(10_000)

      tracker.track(HASH_2, SENDER, 'res-2', 200n)

      // Expire entries older than 5 seconds
      const expired = tracker.expireOlderThan(5_000)
      expect(expired).toBe(1)
      expect(tracker.getByUserOpHash(HASH_1)).toBeUndefined()
      expect(tracker.getByUserOpHash(HASH_2)).toBeDefined()

      vi.useRealTimers()
    })

    it('should return 0 when nothing to expire', () => {
      tracker.track(HASH_1, SENDER, 'res-1', 100n)
      expect(tracker.expireOlderThan(60_000)).toBe(0)
    })
  })

  describe('clear', () => {
    it('should clear all reservations', () => {
      tracker.track(HASH_1, SENDER, 'res-1', 100n)
      tracker.track(HASH_2, SENDER, 'res-2', 200n)

      tracker.clear()
      expect(tracker.getStats().total).toBe(0)
      expect(tracker.getPendingHashes()).toEqual([])
    })
  })

  describe('persistence integration', () => {
    it('should call scheduleSave on track', () => {
      const mockPersistence = {
        load: vi.fn(() => []),
        scheduleSave: vi.fn(),
        flush: vi.fn(),
      } as unknown as ReservationPersistence

      const persistentTracker = new ReservationTracker(mockPersistence)
      persistentTracker.track(HASH_1, SENDER, 'res-1', 100n)

      expect(mockPersistence.scheduleSave).toHaveBeenCalledTimes(1)
    })

    it('should call scheduleSave on remove', () => {
      const mockPersistence = {
        load: vi.fn(() => []),
        scheduleSave: vi.fn(),
        flush: vi.fn(),
      } as unknown as ReservationPersistence

      const persistentTracker = new ReservationTracker(mockPersistence)
      persistentTracker.track(HASH_1, SENDER, 'res-1', 100n)
      persistentTracker.remove(HASH_1)

      expect(mockPersistence.scheduleSave).toHaveBeenCalledTimes(2)
    })

    it('should load from disk', () => {
      const mockPersistence = {
        load: vi.fn(() => [
          {
            reservationId: 'res-disk',
            sender: SENDER,
            estimatedAmount: 999n,
            userOpHash: HASH_1,
            createdAt: Date.now(),
          },
        ]),
        scheduleSave: vi.fn(),
        flush: vi.fn(),
      } as unknown as ReservationPersistence

      const persistentTracker = new ReservationTracker(mockPersistence)
      persistentTracker.loadFromDisk()

      expect(persistentTracker.getByUserOpHash(HASH_1)).toBeDefined()
      expect(persistentTracker.getByReservationId('res-disk')).toBeDefined()
    })

    it('should flush to disk', () => {
      const mockPersistence = {
        load: vi.fn(() => []),
        scheduleSave: vi.fn(),
        flush: vi.fn(),
      } as unknown as ReservationPersistence

      const persistentTracker = new ReservationTracker(mockPersistence)
      persistentTracker.track(HASH_1, SENDER, 'res-1', 100n)
      persistentTracker.flushToDisk()

      expect(mockPersistence.flush).toHaveBeenCalledTimes(1)
    })

    it('should no-op loadFromDisk without persistence', () => {
      const noPersistTracker = new ReservationTracker()
      noPersistTracker.loadFromDisk()
      expect(noPersistTracker.getStats().total).toBe(0)
    })
  })
})

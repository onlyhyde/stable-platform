/**
 * Circuit Breaker Tests
 *
 * Tests for CLOSED -> OPEN -> HALF_OPEN state transitions,
 * failure thresholds, reset timeouts, and recovery behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CircuitBreaker } from '../../src/rpc/circuitBreaker'

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker

  beforeEach(() => {
    vi.useFakeTimers()
    cb = new CircuitBreaker()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should start in CLOSED state', () => {
      expect(cb.getState()).toBe('CLOSED')
    })

    it('should allow execution in initial state', () => {
      expect(cb.canExecute()).toBe(true)
    })

    it('should use default config values', () => {
      // 5 failures should trip the default threshold
      for (let i = 0; i < 4; i++) cb.onFailure()
      expect(cb.getState()).toBe('CLOSED')
      cb.onFailure()
      expect(cb.getState()).toBe('OPEN')
    })

    it('should accept custom config', () => {
      const custom = new CircuitBreaker({ failureThreshold: 2 })
      custom.onFailure()
      expect(custom.getState()).toBe('CLOSED')
      custom.onFailure()
      expect(custom.getState()).toBe('OPEN')
    })
  })

  describe('CLOSED state', () => {
    it('should allow execution', () => {
      expect(cb.canExecute()).toBe(true)
    })

    it('should reset failure count on success', () => {
      cb.onFailure()
      cb.onFailure()
      cb.onSuccess()
      // After success, failure count resets. Need full threshold again
      for (let i = 0; i < 4; i++) cb.onFailure()
      expect(cb.getState()).toBe('CLOSED')
      cb.onFailure()
      expect(cb.getState()).toBe('OPEN')
    })

    it('should transition to OPEN after threshold failures', () => {
      for (let i = 0; i < 5; i++) cb.onFailure()
      expect(cb.getState()).toBe('OPEN')
      expect(cb.canExecute()).toBe(false)
    })

    it('should not transition with fewer than threshold failures', () => {
      for (let i = 0; i < 4; i++) cb.onFailure()
      expect(cb.getState()).toBe('CLOSED')
      expect(cb.canExecute()).toBe(true)
    })
  })

  describe('OPEN state', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) cb.onFailure()
    })

    it('should block execution', () => {
      expect(cb.canExecute()).toBe(false)
    })

    it('should report OPEN state via getState()', () => {
      expect(cb.getState()).toBe('OPEN')
    })

    it('should transition to HALF_OPEN after reset timeout via getState()', () => {
      vi.advanceTimersByTime(30_000)
      expect(cb.getState()).toBe('HALF_OPEN')
    })

    it('should remain OPEN before reset timeout', () => {
      vi.advanceTimersByTime(29_999)
      expect(cb.getState()).toBe('OPEN')
    })

    it('should transition to HALF_OPEN on canExecute() after timeout', () => {
      vi.advanceTimersByTime(30_000)
      expect(cb.canExecute()).toBe(true)
    })

    it('should respect custom reset timeout', () => {
      const custom = new CircuitBreaker({ resetTimeout: 10_000 })
      for (let i = 0; i < 5; i++) custom.onFailure()
      expect(custom.canExecute()).toBe(false)
      vi.advanceTimersByTime(10_000)
      expect(custom.canExecute()).toBe(true)
    })
  })

  describe('HALF_OPEN state', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) cb.onFailure()
      vi.advanceTimersByTime(30_000)
      cb.canExecute() // triggers HALF_OPEN transition
    })

    it('should allow execution', () => {
      expect(cb.canExecute()).toBe(true)
    })

    it('should transition to CLOSED after success threshold', () => {
      cb.onSuccess()
      expect(cb.getState()).toBe('HALF_OPEN')
      cb.onSuccess()
      expect(cb.getState()).toBe('CLOSED')
    })

    it('should transition back to OPEN on any failure', () => {
      cb.onFailure()
      expect(cb.getState()).toBe('OPEN')
      expect(cb.canExecute()).toBe(false)
    })

    it('should reset success count on failure', () => {
      cb.onSuccess() // 1 success
      cb.onFailure() // back to OPEN
      vi.advanceTimersByTime(30_000)
      cb.canExecute() // HALF_OPEN again
      // Need full 2 successes again
      cb.onSuccess()
      expect(cb.getState()).toBe('HALF_OPEN')
      cb.onSuccess()
      expect(cb.getState()).toBe('CLOSED')
    })

    it('should respect custom halfOpenSuccessThreshold', () => {
      const custom = new CircuitBreaker({ halfOpenSuccessThreshold: 3 })
      for (let i = 0; i < 5; i++) custom.onFailure()
      vi.advanceTimersByTime(30_000)
      custom.canExecute()

      custom.onSuccess()
      custom.onSuccess()
      expect(custom.getState()).toBe('HALF_OPEN')
      custom.onSuccess()
      expect(custom.getState()).toBe('CLOSED')
    })
  })

  describe('reset()', () => {
    it('should reset from OPEN to CLOSED', () => {
      for (let i = 0; i < 5; i++) cb.onFailure()
      expect(cb.getState()).toBe('OPEN')
      cb.reset()
      expect(cb.getState()).toBe('CLOSED')
      expect(cb.canExecute()).toBe(true)
    })

    it('should reset from HALF_OPEN to CLOSED', () => {
      for (let i = 0; i < 5; i++) cb.onFailure()
      vi.advanceTimersByTime(30_000)
      cb.canExecute()
      cb.reset()
      expect(cb.getState()).toBe('CLOSED')
    })

    it('should clear all counters', () => {
      for (let i = 0; i < 3; i++) cb.onFailure()
      cb.reset()
      // Should need full 5 failures again
      for (let i = 0; i < 4; i++) cb.onFailure()
      expect(cb.getState()).toBe('CLOSED')
    })
  })

  describe('full lifecycle', () => {
    it('should handle CLOSED -> OPEN -> HALF_OPEN -> CLOSED cycle', () => {
      expect(cb.getState()).toBe('CLOSED')

      // Trip the breaker
      for (let i = 0; i < 5; i++) cb.onFailure()
      expect(cb.getState()).toBe('OPEN')

      // Wait for recovery window
      vi.advanceTimersByTime(30_000)
      cb.canExecute()
      expect(cb.getState()).toBe('HALF_OPEN')

      // Recover
      cb.onSuccess()
      cb.onSuccess()
      expect(cb.getState()).toBe('CLOSED')
      expect(cb.canExecute()).toBe(true)
    })

    it('should handle CLOSED -> OPEN -> HALF_OPEN -> OPEN -> HALF_OPEN -> CLOSED', () => {
      // Trip
      for (let i = 0; i < 5; i++) cb.onFailure()

      // First recovery attempt fails
      vi.advanceTimersByTime(30_000)
      cb.canExecute()
      cb.onFailure() // back to OPEN

      // Second recovery attempt succeeds
      vi.advanceTimersByTime(30_000)
      cb.canExecute()
      cb.onSuccess()
      cb.onSuccess()
      expect(cb.getState()).toBe('CLOSED')
    })
  })
})

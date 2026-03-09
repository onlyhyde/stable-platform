/**
 * RateLimiter Tests
 *
 * T1: Security module coverage - sliding window rate limiting
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRateLimiter,
  DEFAULT_LIMITS,
  METHOD_CATEGORIES,
  RateLimiter,
} from '../../src/security/rateLimiter'

describe('RateLimiter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ========================================================================
  // Construction
  // ========================================================================

  describe('constructor', () => {
    it('should create with default limits', () => {
      const limiter = new RateLimiter()
      const config = limiter.getLimitConfig('eth_chainId')

      expect(config.maxRequests).toBe(DEFAULT_LIMITS.read!.maxRequests)
      expect(config.windowMs).toBe(DEFAULT_LIMITS.read!.windowMs)
      limiter.destroy()
    })

    it('should accept custom limits', () => {
      const limiter = new RateLimiter({
        read: { maxRequests: 200, windowMs: 30_000 },
      })
      const config = limiter.getLimitConfig('eth_chainId')

      expect(config.maxRequests).toBe(200)
      expect(config.windowMs).toBe(30_000)
      limiter.destroy()
    })

    it('should not start cleanup timer on construction (lazy start)', () => {
      const spy = vi.spyOn(global, 'setInterval')
      const limiter = new RateLimiter()

      // No interval should be set until first checkLimit call
      expect(spy).not.toHaveBeenCalled()
      limiter.destroy()
    })
  })

  // ========================================================================
  // Factory
  // ========================================================================

  describe('createRateLimiter', () => {
    it('should create an instance', () => {
      const limiter = createRateLimiter()
      expect(limiter).toBeInstanceOf(RateLimiter)
      limiter.destroy()
    })
  })

  // ========================================================================
  // checkLimit
  // ========================================================================

  describe('checkLimit', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter({ default: { maxRequests: 3, windowMs: 60_000 } })

      const result1 = limiter.checkLimit('origin1', 'unknown_method')
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(2)

      const result2 = limiter.checkLimit('origin1', 'unknown_method')
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(1)

      limiter.destroy()
    })

    it('should deny requests when limit exceeded', () => {
      const limiter = new RateLimiter({ default: { maxRequests: 2, windowMs: 60_000 } })

      limiter.checkLimit('origin1', 'unknown_method')
      limiter.checkLimit('origin1', 'unknown_method')
      const result = limiter.checkLimit('origin1', 'unknown_method')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeDefined()

      limiter.destroy()
    })

    it('should track limits per origin independently', () => {
      const limiter = new RateLimiter({ default: { maxRequests: 1, windowMs: 60_000 } })

      const r1 = limiter.checkLimit('origin1', 'unknown_method')
      const r2 = limiter.checkLimit('origin2', 'unknown_method')

      expect(r1.allowed).toBe(true)
      expect(r2.allowed).toBe(true)

      limiter.destroy()
    })

    it('should track limits per category independently', () => {
      const limiter = new RateLimiter({
        read: { maxRequests: 1, windowMs: 60_000 },
        sensitive: { maxRequests: 1, windowMs: 60_000 },
      })

      const r1 = limiter.checkLimit('origin1', 'eth_chainId') // read
      const r2 = limiter.checkLimit('origin1', 'eth_sendTransaction') // sensitive

      expect(r1.allowed).toBe(true)
      expect(r2.allowed).toBe(true)

      limiter.destroy()
    })

    it('should start cleanup timer on first call', () => {
      const spy = vi.spyOn(global, 'setInterval')
      const limiter = new RateLimiter()

      limiter.checkLimit('origin1', 'eth_chainId')
      expect(spy).toHaveBeenCalledOnce()

      limiter.destroy()
    })

    it('should block origin after repeated abuse', () => {
      const limiter = new RateLimiter({ default: { maxRequests: 2, windowMs: 60_000 } })

      // Fill limit
      limiter.checkLimit('abuser', 'unknown_method')
      limiter.checkLimit('abuser', 'unknown_method')

      // Exceed limit repeatedly (abuseCount increments)
      for (let i = 0; i < 2; i++) {
        limiter.checkLimit('abuser', 'unknown_method')
      }

      // Should now be blocked for longer
      const result = limiter.checkLimit('abuser', 'unknown_method')
      expect(result.allowed).toBe(false)

      limiter.destroy()
    })
  })

  // ========================================================================
  // getStatus
  // ========================================================================

  describe('getStatus', () => {
    it('should return full capacity for new origin', () => {
      const limiter = new RateLimiter({ default: { maxRequests: 10, windowMs: 60_000 } })
      const status = limiter.getStatus('new-origin', 'unknown_method')

      expect(status.allowed).toBe(true)
      expect(status.remaining).toBe(10)

      limiter.destroy()
    })

    it('should reflect consumed requests without consuming', () => {
      const limiter = new RateLimiter({ default: { maxRequests: 5, windowMs: 60_000 } })

      limiter.checkLimit('origin1', 'unknown_method')
      limiter.checkLimit('origin1', 'unknown_method')

      const status = limiter.getStatus('origin1', 'unknown_method')
      expect(status.remaining).toBe(3)

      // Calling getStatus again should not change remaining
      const status2 = limiter.getStatus('origin1', 'unknown_method')
      expect(status2.remaining).toBe(3)

      limiter.destroy()
    })
  })

  // ========================================================================
  // reset
  // ========================================================================

  describe('reset', () => {
    it('should reset limits for a specific category', () => {
      const limiter = new RateLimiter({ default: { maxRequests: 1, windowMs: 60_000 } })

      limiter.checkLimit('origin1', 'unknown_method')
      expect(limiter.checkLimit('origin1', 'unknown_method').allowed).toBe(false)

      limiter.reset('origin1', 'default')
      expect(limiter.checkLimit('origin1', 'unknown_method').allowed).toBe(true)

      limiter.destroy()
    })

    it('should reset all categories for origin when no category specified', () => {
      const limiter = new RateLimiter({
        read: { maxRequests: 1, windowMs: 60_000 },
        sensitive: { maxRequests: 1, windowMs: 60_000 },
      })

      limiter.checkLimit('origin1', 'eth_chainId')
      limiter.checkLimit('origin1', 'eth_sendTransaction')

      limiter.reset('origin1')

      expect(limiter.checkLimit('origin1', 'eth_chainId').allowed).toBe(true)
      expect(limiter.checkLimit('origin1', 'eth_sendTransaction').allowed).toBe(true)

      limiter.destroy()
    })
  })

  // ========================================================================
  // resetAll
  // ========================================================================

  describe('resetAll', () => {
    it('should reset all origins and categories', () => {
      const limiter = new RateLimiter({ default: { maxRequests: 1, windowMs: 60_000 } })

      limiter.checkLimit('origin1', 'unknown_method')
      limiter.checkLimit('origin2', 'unknown_method')

      limiter.resetAll()

      expect(limiter.checkLimit('origin1', 'unknown_method').allowed).toBe(true)
      expect(limiter.checkLimit('origin2', 'unknown_method').allowed).toBe(true)

      limiter.destroy()
    })
  })

  // ========================================================================
  // getLimitConfig
  // ========================================================================

  describe('getLimitConfig', () => {
    it('should return correct config for categorized method', () => {
      const limiter = new RateLimiter()

      expect(limiter.getLimitConfig('eth_sendTransaction')).toEqual(DEFAULT_LIMITS.sensitive)
      expect(limiter.getLimitConfig('personal_sign')).toEqual(DEFAULT_LIMITS.signing)
      expect(limiter.getLimitConfig('eth_chainId')).toEqual(DEFAULT_LIMITS.read)
      expect(limiter.getLimitConfig('eth_requestAccounts')).toEqual(DEFAULT_LIMITS.connection)

      limiter.destroy()
    })

    it('should return default config for unknown method', () => {
      const limiter = new RateLimiter()
      expect(limiter.getLimitConfig('unknown_method')).toEqual(DEFAULT_LIMITS.default)
      limiter.destroy()
    })
  })

  // ========================================================================
  // setLimits
  // ========================================================================

  describe('setLimits', () => {
    it('should update limits dynamically', () => {
      const limiter = new RateLimiter()

      limiter.setLimits({ read: { maxRequests: 999, windowMs: 1000 } })

      const config = limiter.getLimitConfig('eth_chainId')
      expect(config.maxRequests).toBe(999)

      limiter.destroy()
    })
  })

  // ========================================================================
  // getStats
  // ========================================================================

  describe('getStats', () => {
    it('should return stats', () => {
      const limiter = new RateLimiter()

      limiter.checkLimit('origin1', 'eth_chainId')
      limiter.checkLimit('origin1', 'eth_sendTransaction')
      limiter.checkLimit('origin2', 'eth_chainId')

      const stats = limiter.getStats()
      expect(stats.totalOrigins).toBe(3) // 3 keys: origin1:read, origin1:sensitive, origin2:read
      expect(stats.blockedOrigins).toBe(0)
      expect(stats.requestsByCategory.read).toBe(2)
      expect(stats.requestsByCategory.sensitive).toBe(1)

      limiter.destroy()
    })
  })

  // ========================================================================
  // destroy
  // ========================================================================

  describe('destroy', () => {
    it('should clear interval and records', () => {
      const limiter = new RateLimiter()
      limiter.checkLimit('origin1', 'eth_chainId')

      limiter.destroy()

      // After destroy, stats should be empty
      const stats = limiter.getStats()
      expect(stats.totalOrigins).toBe(0)
    })
  })

  // ========================================================================
  // METHOD_CATEGORIES
  // ========================================================================

  describe('METHOD_CATEGORIES', () => {
    it('should have categories for all common Ethereum methods', () => {
      expect(METHOD_CATEGORIES.eth_sendTransaction).toBe('sensitive')
      expect(METHOD_CATEGORIES.personal_sign).toBe('signing')
      expect(METHOD_CATEGORIES.eth_accounts).toBe('read')
      expect(METHOD_CATEGORIES.eth_requestAccounts).toBe('connection')
    })

    it('should have StableNet custom methods', () => {
      expect(METHOD_CATEGORIES.stablenet_installModule).toBe('sensitive')
      expect(METHOD_CATEGORIES.stablenet_getSmartAccountInfo).toBe('read')
    })
  })
})

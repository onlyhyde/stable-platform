// Unmock to test real implementation
jest.unmock('@stablenet/core')

import { DEFAULT_LIMITS, METHOD_CATEGORIES, RateLimiter } from '@stablenet/core'

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter

  beforeEach(() => {
    rateLimiter = new RateLimiter()
    jest.useFakeTimers()
  })

  afterEach(() => {
    rateLimiter.destroy()
    jest.useRealTimers()
  })

  describe('checkLimit', () => {
    it('should allow requests within limit', () => {
      const origin = 'https://example.com'
      const method = 'eth_chainId' // read category: 100/min

      const result = rateLimiter.checkLimit(origin, method)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(99) // 100 - 1
    })

    it('should track requests across multiple calls', () => {
      const origin = 'https://example.com'
      const method = 'eth_chainId'

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(origin, method)
      }

      const result = rateLimiter.checkLimit(origin, method)
      expect(result.remaining).toBe(94) // 100 - 6
    })

    it('should reject requests exceeding limit', () => {
      const origin = 'https://example.com'
      const method = 'eth_sendTransaction' // sensitive: 5/min

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkLimit(origin, method)
        expect(result.allowed).toBe(true)
      }

      // Next request should be rejected
      const result = rateLimiter.checkLimit(origin, method)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it('should apply different limits based on method category', () => {
      const origin = 'https://example.com'

      // Sensitive operations: 5/min
      const sensitiveLimiter = new RateLimiter()
      for (let i = 0; i < 5; i++) {
        sensitiveLimiter.checkLimit(origin, 'eth_sendTransaction')
      }
      expect(sensitiveLimiter.checkLimit(origin, 'eth_sendTransaction').allowed).toBe(false)

      // Signing operations: 10/min
      const signingLimiter = new RateLimiter()
      for (let i = 0; i < 10; i++) {
        signingLimiter.checkLimit(origin, 'personal_sign')
      }
      expect(signingLimiter.checkLimit(origin, 'personal_sign').allowed).toBe(false)

      // Read operations: 100/min
      const readLimiter = new RateLimiter()
      for (let i = 0; i < 100; i++) {
        readLimiter.checkLimit(origin, 'eth_chainId')
      }
      expect(readLimiter.checkLimit(origin, 'eth_chainId').allowed).toBe(false)

      sensitiveLimiter.destroy()
      signingLimiter.destroy()
      readLimiter.destroy()
    })

    it('should reset after window expires', () => {
      const origin = 'https://example.com'
      const method = 'eth_sendTransaction'

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(origin, method)
      }

      expect(rateLimiter.checkLimit(origin, method).allowed).toBe(false)

      // Advance time past the window
      jest.advanceTimersByTime(60_001)

      const result = rateLimiter.checkLimit(origin, method)
      expect(result.allowed).toBe(true)
    })

    it('should track different origins separately', () => {
      const origin1 = 'https://example1.com'
      const origin2 = 'https://example2.com'
      const method = 'eth_sendTransaction'

      // Exhaust limit for origin1
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(origin1, method)
      }

      // origin1 should be blocked
      expect(rateLimiter.checkLimit(origin1, method).allowed).toBe(false)

      // origin2 should still be allowed
      expect(rateLimiter.checkLimit(origin2, method).allowed).toBe(true)
    })

    it('should track different method categories separately', () => {
      const origin = 'https://example.com'

      // Exhaust sensitive limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(origin, 'eth_sendTransaction')
      }

      // Sensitive should be blocked
      expect(rateLimiter.checkLimit(origin, 'eth_sendTransaction').allowed).toBe(false)

      // Read operations should still work
      expect(rateLimiter.checkLimit(origin, 'eth_chainId').allowed).toBe(true)
    })

    it('should block origin for extended abuse', () => {
      const origin = 'https://malicious.com'
      const method = 'eth_sendTransaction' // 5/min

      // Exceed limit by 2x (10 attempts)
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit(origin, method)
      }

      const result = rateLimiter.checkLimit(origin, method)
      expect(result.allowed).toBe(false)
      expect(result.retryAfter).toBeGreaterThan(60) // Should be blocked for 5 minutes
    })

    it('should use default category for unknown methods', () => {
      const origin = 'https://example.com'
      const method = 'unknown_method'

      const result = rateLimiter.checkLimit(origin, method)
      expect(result.allowed).toBe(true)

      // Default: 60/min
      for (let i = 0; i < 59; i++) {
        rateLimiter.checkLimit(origin, method)
      }

      expect(rateLimiter.checkLimit(origin, method).allowed).toBe(false)
    })
  })

  describe('getStatus', () => {
    it('should return status without consuming a request', () => {
      const origin = 'https://example.com'
      const method = 'eth_chainId'

      // Get status first
      const status1 = rateLimiter.getStatus(origin, method)
      expect(status1.remaining).toBe(100)

      // Get status again - should still be 100
      const status2 = rateLimiter.getStatus(origin, method)
      expect(status2.remaining).toBe(100)

      // Now consume a request
      rateLimiter.checkLimit(origin, method)

      // Status should show 99
      const status3 = rateLimiter.getStatus(origin, method)
      expect(status3.remaining).toBe(99)
    })

    it('should return blocked status when blocked', () => {
      const origin = 'https://example.com'
      const method = 'eth_sendTransaction'

      // Trigger block (2x limit)
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit(origin, method)
      }

      const status = rateLimiter.getStatus(origin, method)
      expect(status.allowed).toBe(false)
      expect(status.retryAfter).toBeGreaterThan(0)
    })
  })

  describe('reset', () => {
    it('should reset limits for specific category', () => {
      const origin = 'https://example.com'
      const method = 'eth_sendTransaction'

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(origin, method)
      }

      expect(rateLimiter.checkLimit(origin, method).allowed).toBe(false)

      // Reset sensitive category
      rateLimiter.reset(origin, 'sensitive')

      // Should be allowed again
      expect(rateLimiter.checkLimit(origin, method).allowed).toBe(true)
    })

    it('should reset all categories for origin', () => {
      const origin = 'https://example.com'

      // Consume some limits
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(origin, 'eth_sendTransaction')
        rateLimiter.checkLimit(origin, 'personal_sign')
      }

      // Reset all for origin
      rateLimiter.reset(origin)

      // Both should be fully available
      expect(rateLimiter.getStatus(origin, 'eth_sendTransaction').remaining).toBe(5)
      expect(rateLimiter.getStatus(origin, 'personal_sign').remaining).toBe(10)
    })
  })

  describe('resetAll', () => {
    it('should clear all rate limit records', () => {
      const origins = ['https://a.com', 'https://b.com', 'https://c.com']

      // Create records for multiple origins
      origins.forEach((origin) => {
        rateLimiter.checkLimit(origin, 'eth_chainId')
      })

      // Reset all
      rateLimiter.resetAll()

      // All should be fresh
      origins.forEach((origin) => {
        expect(rateLimiter.getStatus(origin, 'eth_chainId').remaining).toBe(100)
      })
    })
  })

  describe('getLimitConfig', () => {
    it('should return correct config for each category', () => {
      expect(rateLimiter.getLimitConfig('eth_sendTransaction')).toEqual(DEFAULT_LIMITS.sensitive)
      expect(rateLimiter.getLimitConfig('personal_sign')).toEqual(DEFAULT_LIMITS.signing)
      expect(rateLimiter.getLimitConfig('eth_requestAccounts')).toEqual(DEFAULT_LIMITS.connection)
      expect(rateLimiter.getLimitConfig('eth_chainId')).toEqual(DEFAULT_LIMITS.read)
      expect(rateLimiter.getLimitConfig('unknown_method')).toEqual(DEFAULT_LIMITS.default)
    })
  })

  describe('setLimits', () => {
    it('should update limits dynamically', () => {
      const origin = 'https://example.com'
      const method = 'eth_sendTransaction'

      // Default sensitive: 5/min
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(origin, method)
      }
      expect(rateLimiter.checkLimit(origin, method).allowed).toBe(false)

      // Update to 10/min
      rateLimiter.setLimits({
        sensitive: { maxRequests: 10, windowMs: 60_000 },
      })

      // Should now allow more
      rateLimiter.reset(origin, 'sensitive')
      for (let i = 0; i < 10; i++) {
        expect(rateLimiter.checkLimit(origin, method).allowed).toBe(true)
      }
      expect(rateLimiter.checkLimit(origin, method).allowed).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      // Create some activity
      rateLimiter.checkLimit('https://a.com', 'eth_chainId')
      rateLimiter.checkLimit('https://a.com', 'eth_chainId')
      rateLimiter.checkLimit('https://b.com', 'eth_sendTransaction')

      // Block one origin
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit('https://malicious.com', 'eth_sendTransaction')
      }

      const stats = rateLimiter.getStats()

      expect(stats.totalOrigins).toBeGreaterThan(0)
      expect(stats.blockedOrigins).toBe(1)
      expect(stats.requestsByCategory.read).toBe(2)
      expect(stats.requestsByCategory.sensitive).toBeGreaterThan(0)
    })
  })

  describe('custom limits', () => {
    it('should accept custom limits on construction', () => {
      const customLimiter = new RateLimiter({
        sensitive: { maxRequests: 1, windowMs: 60_000 },
      })

      const origin = 'https://example.com'

      // First request allowed
      expect(customLimiter.checkLimit(origin, 'eth_sendTransaction').allowed).toBe(true)

      // Second request blocked
      expect(customLimiter.checkLimit(origin, 'eth_sendTransaction').allowed).toBe(false)

      customLimiter.destroy()
    })
  })

  describe('cleanup', () => {
    it('should clean up old records', () => {
      const origin = 'https://example.com'
      rateLimiter.checkLimit(origin, 'eth_chainId')

      // Advance past cleanup threshold (5x cleanup interval = 5 minutes)
      jest.advanceTimersByTime(5 * 60_000 + 1)

      // Trigger cleanup by advancing time to next cleanup interval
      jest.advanceTimersByTime(60_000)

      // Record should be cleaned up
      const status = rateLimiter.getStatus(origin, 'eth_chainId')
      expect(status.remaining).toBe(100) // Fresh state
    })
  })

  describe('METHOD_CATEGORIES', () => {
    it('should categorize common methods correctly', () => {
      // Sensitive
      expect(METHOD_CATEGORIES.eth_sendTransaction).toBe('sensitive')
      expect(METHOD_CATEGORIES.eth_sendUserOperation).toBe('sensitive')
      expect(METHOD_CATEGORIES.wallet_addEthereumChain).toBe('sensitive')

      // Signing
      expect(METHOD_CATEGORIES.personal_sign).toBe('signing')
      expect(METHOD_CATEGORIES.eth_signTypedData_v4).toBe('signing')

      // Connection
      expect(METHOD_CATEGORIES.eth_requestAccounts).toBe('connection')

      // Read
      expect(METHOD_CATEGORIES.eth_accounts).toBe('read')
      expect(METHOD_CATEGORIES.eth_chainId).toBe('read')
      expect(METHOD_CATEGORIES.eth_getBalance).toBe('read')
    })
  })

  describe('sliding window behavior', () => {
    it('should allow new requests as old ones expire', () => {
      const origin = 'https://example.com'
      const method = 'eth_sendTransaction' // 5 per minute

      // Make 5 requests at t=0
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(origin, method)
      }

      // Should be blocked
      expect(rateLimiter.checkLimit(origin, method).allowed).toBe(false)

      // Advance 30 seconds - still blocked
      jest.advanceTimersByTime(30_000)
      expect(rateLimiter.checkLimit(origin, method).allowed).toBe(false)

      // Advance to 61 seconds total - original requests should expire
      jest.advanceTimersByTime(31_001)
      expect(rateLimiter.checkLimit(origin, method).allowed).toBe(true)
    })
  })
})

describe('DEFAULT_LIMITS', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_LIMITS.sensitive.maxRequests).toBe(5)
    expect(DEFAULT_LIMITS.signing.maxRequests).toBe(10)
    expect(DEFAULT_LIMITS.connection.maxRequests).toBe(10)
    expect(DEFAULT_LIMITS.read.maxRequests).toBe(100)
    expect(DEFAULT_LIMITS.default.maxRequests).toBe(60)

    // All should use 60 second windows
    Object.values(DEFAULT_LIMITS).forEach((config) => {
      expect(config.windowMs).toBe(60_000)
    })
  })
})

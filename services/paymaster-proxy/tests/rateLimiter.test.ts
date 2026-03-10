import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RateLimiter } from '../src/middleware/rateLimiter'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  afterEach(() => {
    limiter?.stop()
  })

  describe('middleware', () => {
    let app: Hono

    beforeEach(() => {
      limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 })
      app = new Hono()
      app.use('*', limiter.middleware())
      app.post('/', (c) => c.json({ ok: true }))
    })

    it('should allow requests within limit', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
        body: '{}',
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('3')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('2')
    })

    it('should reject requests exceeding limit', async () => {
      for (let i = 0; i < 3; i++) {
        await app.request('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
          body: '{}',
        })
      }

      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
        body: '{}',
      })
      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error.code).toBe(-32005)
      expect(body.error.message).toContain('Rate limit')
      expect(res.headers.get('Retry-After')).toBeDefined()
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    })

    it('should track IPs independently', async () => {
      // Exhaust limit for IP 1
      for (let i = 0; i < 3; i++) {
        await app.request('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.1.1.1' },
          body: '{}',
        })
      }

      // IP 2 should still be allowed
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '2.2.2.2' },
        body: '{}',
      })
      expect(res.status).toBe(200)
    })

    it('should reset after window expires', async () => {
      vi.useFakeTimers()

      for (let i = 0; i < 3; i++) {
        await app.request('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
          body: '{}',
        })
      }

      // Should be rate limited
      let res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
        body: '{}',
      })
      expect(res.status).toBe(429)

      // Advance past window
      vi.advanceTimersByTime(1100)

      // Should be allowed again
      res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
        body: '{}',
      })
      expect(res.status).toBe(200)

      vi.useRealTimers()
    })

    it('should use x-real-ip as fallback', async () => {
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Real-IP': '5.6.7.8' },
        body: '{}',
      })
      expect(res.status).toBe(200)
    })
  })

  describe('eviction', () => {
    it('should evict oldest IP when maxTrackedIps exceeded', () => {
      limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000, maxTrackedIps: 3 })
      const app = new Hono()
      app.use('*', limiter.middleware())
      app.post('/', (c) => c.json({ ok: true }))

      // Fill up tracked IPs
      const ips = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4']
      const requests = ips.map((ip) =>
        app.request('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
          body: '{}',
        })
      )

      return Promise.all(requests).then(() => {
        const stats = limiter.getStats()
        expect(stats.trackedIps).toBeLessThanOrEqual(3)
      })
    })
  })

  describe('getStats', () => {
    it('should return limiter stats', () => {
      limiter = new RateLimiter({ maxRequests: 50, windowMs: 30000 })
      const stats = limiter.getStats()
      expect(stats.maxRequests).toBe(50)
      expect(stats.windowMs).toBe(30000)
      expect(stats.trackedIps).toBe(0)
    })
  })
})

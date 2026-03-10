import type { Context, Next } from 'hono'

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests allowed within the window (default: 100) */
  maxRequests: number
  /** Window duration in milliseconds (default: 60000 = 1 minute) */
  windowMs: number
  /** Maximum number of tracked IPs before eviction (default: 10000) */
  maxTrackedIps: number
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxRequests: 100,
  windowMs: 60_000,
  maxTrackedIps: 10_000,
}

interface RequestRecord {
  /** Timestamps of requests within the current window */
  timestamps: number[]
}

/**
 * In-memory sliding-window rate limiter.
 *
 * Tracks request counts per IP using a simple sliding window.
 * Returns 429 with Retry-After header when limit is exceeded.
 *
 * Note: This is per-instance only. For multi-instance deployments,
 * use an external store (Redis, etc.) instead.
 */
export class RateLimiter {
  private readonly config: RateLimiterConfig
  private readonly records = new Map<string, RequestRecord>()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    // Periodic cleanup of expired entries every 2 minutes
    this.cleanupTimer = setInterval(() => this.cleanup(), 120_000)
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref()
    }
  }

  /**
   * Hono middleware function
   */
  middleware() {
    return async (c: Context, next: Next) => {
      const ip = this.getClientIp(c)
      const now = Date.now()
      const windowStart = now - this.config.windowMs

      const record = this.records.get(ip)
      if (record) {
        // Remove timestamps outside the window
        record.timestamps = record.timestamps.filter((t) => t > windowStart)

        if (record.timestamps.length >= this.config.maxRequests) {
          const retryAfterMs = record.timestamps[0]! - windowStart
          const retryAfterSec = Math.ceil(retryAfterMs / 1000)
          c.header('Retry-After', String(retryAfterSec))
          c.header('X-RateLimit-Limit', String(this.config.maxRequests))
          c.header('X-RateLimit-Remaining', '0')
          return c.json(
            {
              jsonrpc: '2.0',
              id: null,
              error: {
                code: -32005,
                message: 'Rate limit exceeded. Try again later.',
              },
            },
            429
          )
        }

        record.timestamps.push(now)
      } else {
        // Evict oldest entry if at capacity
        if (this.records.size >= this.config.maxTrackedIps) {
          const oldestKey = this.records.keys().next().value
          if (oldestKey) this.records.delete(oldestKey)
        }
        this.records.set(ip, { timestamps: [now] })
      }

      const remaining = this.config.maxRequests - (record?.timestamps.length ?? 1)
      c.header('X-RateLimit-Limit', String(this.config.maxRequests))
      c.header('X-RateLimit-Remaining', String(Math.max(0, remaining)))

      await next()
    }
  }

  /**
   * Get stats for health/metrics endpoints
   */
  getStats(): { trackedIps: number; maxRequests: number; windowMs: number } {
    return {
      trackedIps: this.records.size,
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
    }
  }

  /**
   * Stop the cleanup timer
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /** Remove expired entries */
  private cleanup(): void {
    const windowStart = Date.now() - this.config.windowMs
    for (const [ip, record] of this.records) {
      record.timestamps = record.timestamps.filter((t) => t > windowStart)
      if (record.timestamps.length === 0) {
        this.records.delete(ip)
      }
    }
  }

  /** Extract client IP from request */
  private getClientIp(c: Context): string {
    return (
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown'
    )
  }
}

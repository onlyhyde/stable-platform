/**
 * Rate Limiter for RPC requests
 *
 * Implements sliding window rate limiting to prevent abuse:
 * - Per-origin request tracking
 * - Method-specific limits for sensitive operations
 * - Automatic cleanup of old entries
 */

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

interface RequestRecord {
  timestamps: number[]
  blockedUntil?: number
  abuseCount: number // Track attempts when already rate limited
}

/**
 * Default rate limits by operation category
 */
export const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  // Sensitive operations - stricter limits
  sensitive: {
    maxRequests: 5,
    windowMs: 60_000, // 5 per minute
  },
  // Signing operations
  signing: {
    maxRequests: 10,
    windowMs: 60_000, // 10 per minute
  },
  // Connection requests
  connection: {
    maxRequests: 10,
    windowMs: 60_000, // 10 per minute
  },
  // Read operations - more permissive
  read: {
    maxRequests: 100,
    windowMs: 60_000, // 100 per minute
  },
  // Default for uncategorized
  default: {
    maxRequests: 60,
    windowMs: 60_000, // 60 per minute
  },
} as const

/**
 * Guaranteed default config (used as final fallback)
 */
const FALLBACK_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000,
}

/**
 * Method to category mapping
 */
export const METHOD_CATEGORIES: Record<string, string> = {
  // Sensitive operations
  eth_sendTransaction: 'sensitive',
  eth_sendUserOperation: 'sensitive',
  wallet_addEthereumChain: 'sensitive',

  // Signing operations
  personal_sign: 'signing',
  eth_sign: 'signing',
  eth_signTypedData: 'signing',
  eth_signTypedData_v3: 'signing',
  eth_signTypedData_v4: 'signing',
  eth_signTransaction: 'signing',

  // Connection operations
  eth_requestAccounts: 'connection',
  wallet_requestPermissions: 'connection',

  // Read operations
  eth_accounts: 'read',
  eth_chainId: 'read',
  net_version: 'read',
  eth_getBalance: 'read',
  eth_getTransactionCount: 'read',
  eth_getBlockByNumber: 'read',
  eth_blockNumber: 'read',
  eth_call: 'read',
  eth_estimateGas: 'read',
  eth_gasPrice: 'read',
  eth_getTransactionReceipt: 'read',
  eth_getTransactionByHash: 'read',
  eth_getLogs: 'read',
  eth_getCode: 'read',
  eth_getStorageAt: 'read',
  wallet_getPermissions: 'read',
  eth_getUserOperationByHash: 'read',
  eth_getUserOperationReceipt: 'read',
  eth_supportedEntryPoints: 'read',
}

/**
 * Rate Limiter class implementing sliding window algorithm
 */
export class RateLimiter {
  private records: Map<string, RequestRecord> = new Map()
  private limits: Record<string, RateLimitConfig>
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  private readonly CLEANUP_INTERVAL_MS = 60_000 // 1 minute
  private readonly BLOCK_DURATION_MS = 300_000 // 5 minutes block after abuse

  constructor(customLimits?: Record<string, RateLimitConfig>) {
    this.limits = { ...DEFAULT_LIMITS, ...(customLimits ?? {}) }
    this.startCleanup()
  }

  /**
   * Get config for a category with fallback to default
   */
  private getConfig(category: string): RateLimitConfig {
    return this.limits[category] ?? this.limits['default'] ?? FALLBACK_CONFIG
  }

  /**
   * Check if a request is allowed
   */
  checkLimit(origin: string, method: string): RateLimitResult {
    const now = Date.now()
    const category = METHOD_CATEGORIES[method] || 'default'
    const config = this.getConfig(category)
    const key = this.getKey(origin, category)

    let record = this.records.get(key)

    // Initialize record if not exists
    if (!record) {
      record = { timestamps: [], abuseCount: 0 }
      this.records.set(key, record)
    }

    // Check if origin is blocked
    if (record.blockedUntil && record.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.blockedUntil,
        retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
      }
    }

    // Clean old timestamps outside the window
    const windowStart = now - config.windowMs
    record.timestamps = record.timestamps.filter((t) => t > windowStart)

    // Reset abuse count if window has passed
    if (record.timestamps.length === 0) {
      record.abuseCount = 0
    }

    // Check if limit exceeded
    if (record.timestamps.length >= config.maxRequests) {
      // Track abuse attempts
      record.abuseCount++

      // Block the origin for repeated abuse (more than maxRequests additional attempts)
      if (record.abuseCount >= config.maxRequests) {
        record.blockedUntil = now + this.BLOCK_DURATION_MS
        return {
          allowed: false,
          remaining: 0,
          resetAt: record.blockedUntil,
          retryAfter: Math.ceil(this.BLOCK_DURATION_MS / 1000),
        }
      }

      const oldestInWindow = record.timestamps[0] || now
      const resetAt = oldestInWindow + config.windowMs

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      }
    }

    // Request allowed - record timestamp
    record.timestamps.push(now)

    return {
      allowed: true,
      remaining: config.maxRequests - record.timestamps.length,
      resetAt: now + config.windowMs,
    }
  }

  /**
   * Get rate limit status without consuming a request
   */
  getStatus(origin: string, method: string): RateLimitResult {
    const now = Date.now()
    const category = METHOD_CATEGORIES[method] || 'default'
    const config = this.getConfig(category)
    const key = this.getKey(origin, category)

    const record = this.records.get(key)

    if (!record) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: now + config.windowMs,
      }
    }

    // Check if origin is blocked
    if (record.blockedUntil && record.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.blockedUntil,
        retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
      }
    }

    // Clean old timestamps
    const windowStart = now - config.windowMs
    const activeTimestamps = record.timestamps.filter((t) => t > windowStart)
    const remaining = Math.max(0, config.maxRequests - activeTimestamps.length)

    return {
      allowed: remaining > 0,
      remaining,
      resetAt:
        activeTimestamps.length > 0
          ? (activeTimestamps[0] || now) + config.windowMs
          : now + config.windowMs,
    }
  }

  /**
   * Reset limits for an origin (useful for testing or admin actions)
   */
  reset(origin: string, category?: string): void {
    if (category) {
      this.records.delete(this.getKey(origin, category))
    } else {
      // Reset all categories for this origin
      for (const cat of Object.keys(this.limits)) {
        this.records.delete(this.getKey(origin, cat))
      }
    }
  }

  /**
   * Reset all limits
   */
  resetAll(): void {
    this.records.clear()
  }

  /**
   * Get the limit configuration for a method
   */
  getLimitConfig(method: string): RateLimitConfig {
    const category = METHOD_CATEGORIES[method] || 'default'
    return this.getConfig(category)
  }

  /**
   * Update limits dynamically
   */
  setLimits(limits: Record<string, RateLimitConfig>): void {
    this.limits = { ...this.limits, ...limits }
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.records.clear()
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    totalOrigins: number
    blockedOrigins: number
    requestsByCategory: Record<string, number>
  } {
    const now = Date.now()
    let blockedOrigins = 0
    const requestsByCategory: Record<string, number> = {}

    for (const [key, record] of this.records) {
      if (record.blockedUntil && record.blockedUntil > now) {
        blockedOrigins++
      }

      // Extract category from key (format: "origin:category")
      // Use lastIndexOf since origin may contain colons (e.g., "https://example.com")
      const lastColonIndex = key.lastIndexOf(':')
      const category = lastColonIndex >= 0 ? key.slice(lastColonIndex + 1) : 'unknown'
      requestsByCategory[category] = (requestsByCategory[category] || 0) + record.timestamps.length
    }

    return {
      totalOrigins: this.records.size,
      blockedOrigins,
      requestsByCategory,
    }
  }

  private getKey(origin: string, category: string): string {
    return `${origin}:${category}`
  }

  private startCleanup(): void {
    // Avoid multiple intervals
    if (this.cleanupInterval) {
      return
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, this.CLEANUP_INTERVAL_MS)
  }

  private cleanup(): void {
    const now = Date.now()

    for (const [key, record] of this.records) {
      // Remove records with no recent activity
      const hasRecentTimestamps = record.timestamps.some(
        (t) => t > now - this.CLEANUP_INTERVAL_MS * 5
      )
      const isBlocked = record.blockedUntil && record.blockedUntil > now

      if (!hasRecentTimestamps && !isBlocked) {
        this.records.delete(key)
      }
    }
  }
}

/**
 * Create a new RateLimiter instance
 */
export function createRateLimiter(customLimits?: Record<string, RateLimitConfig>): RateLimiter {
  return new RateLimiter(customLimits)
}

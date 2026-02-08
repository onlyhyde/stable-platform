/**
 * Request Cache
 *
 * TTL-based LRU cache for JSON-RPC responses.
 * Caches deterministic read-only methods to reduce RPC calls.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/**
 * Methods that are safe to cache and their TTLs in milliseconds.
 * Only deterministic, read-only methods should be cached.
 */
const CACHEABLE_METHODS: Record<string, number> = {
  eth_chainId: 60_000, // 1 min - rarely changes
  net_version: 60_000,
  eth_blockNumber: 2_000, // 2s - changes every block
  eth_gasPrice: 5_000, // 5s
  eth_maxPriorityFeePerGas: 5_000,
  eth_getCode: 30_000, // 30s - code rarely changes
}

export interface RequestCacheConfig {
  /** Maximum number of cached entries (default: 200) */
  maxSize?: number
  /** Override TTLs for specific methods */
  ttlOverrides?: Record<string, number>
}

export class RequestCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private readonly maxSize: number
  private readonly methodTtls: Record<string, number>

  constructor(config: RequestCacheConfig = {}) {
    this.maxSize = config.maxSize ?? 200
    this.methodTtls = { ...CACHEABLE_METHODS, ...config.ttlOverrides }
  }

  /**
   * Build a cache key from method and params.
   */
  private buildKey(method: string, params: unknown): string {
    return `${method}:${JSON.stringify(params ?? [])}`
  }

  /**
   * Check if a method is cacheable.
   */
  isCacheable(method: string): boolean {
    return method in this.methodTtls
  }

  /**
   * Get a cached value if it exists and hasn't expired.
   */
  get<T>(method: string, params: unknown): T | undefined {
    if (!this.isCacheable(method)) return undefined

    const key = this.buildKey(method, params)
    const entry = this.cache.get(key)

    if (!entry) return undefined

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    // Move to end for LRU (delete + re-set)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value as T
  }

  /**
   * Set a cached value with method-specific TTL.
   */
  set<T>(method: string, params: unknown, value: T): void {
    if (!this.isCacheable(method)) return

    const ttl = this.methodTtls[method]!
    const key = this.buildKey(method, params)

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    })
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear cached entries for a specific method.
   */
  invalidate(method: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${method}:`)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Current number of cached entries.
   */
  get size(): number {
    return this.cache.size
  }
}

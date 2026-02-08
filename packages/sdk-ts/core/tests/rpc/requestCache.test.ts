/**
 * Request Cache Tests
 *
 * Tests for TTL-based LRU cache: cacheability checks, TTL expiration,
 * LRU eviction, method-specific invalidation, and size limits.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestCache } from '../../src/rpc/requestCache'

describe('RequestCache', () => {
  let cache: RequestCache

  beforeEach(() => {
    vi.useFakeTimers()
    cache = new RequestCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should start empty', () => {
      expect(cache.size).toBe(0)
    })

    it('should accept custom maxSize', () => {
      const small = new RequestCache({ maxSize: 2 })
      small.set('eth_chainId', [], '0x1')
      small.set('eth_gasPrice', [], '0x100')
      small.set('net_version', [], '1')
      // Should have evicted the oldest entry
      expect(small.size).toBe(2)
    })

    it('should accept ttlOverrides', () => {
      const custom = new RequestCache({ ttlOverrides: { eth_chainId: 1000 } })
      custom.set('eth_chainId', [], '0x1')
      vi.advanceTimersByTime(999)
      expect(custom.get('eth_chainId', [])).toBe('0x1')
      vi.advanceTimersByTime(2)
      expect(custom.get('eth_chainId', [])).toBeUndefined()
    })
  })

  describe('isCacheable()', () => {
    it('should return true for cacheable methods', () => {
      expect(cache.isCacheable('eth_chainId')).toBe(true)
      expect(cache.isCacheable('net_version')).toBe(true)
      expect(cache.isCacheable('eth_blockNumber')).toBe(true)
      expect(cache.isCacheable('eth_gasPrice')).toBe(true)
      expect(cache.isCacheable('eth_maxPriorityFeePerGas')).toBe(true)
      expect(cache.isCacheable('eth_getCode')).toBe(true)
    })

    it('should return false for non-cacheable methods', () => {
      expect(cache.isCacheable('eth_sendTransaction')).toBe(false)
      expect(cache.isCacheable('eth_call')).toBe(false)
      expect(cache.isCacheable('eth_getBalance')).toBe(false)
      expect(cache.isCacheable('personal_sign')).toBe(false)
    })
  })

  describe('set() and get()', () => {
    it('should store and retrieve a cached value', () => {
      cache.set('eth_chainId', [], '0x1')
      expect(cache.get('eth_chainId', [])).toBe('0x1')
    })

    it('should not cache non-cacheable methods', () => {
      cache.set('eth_sendTransaction', [{ to: '0x123' }], '0xhash')
      expect(cache.size).toBe(0)
      expect(cache.get('eth_sendTransaction', [{ to: '0x123' }])).toBeUndefined()
    })

    it('should distinguish params in cache key', () => {
      cache.set('eth_getCode', ['0xAAA', 'latest'], '0xcode1')
      cache.set('eth_getCode', ['0xBBB', 'latest'], '0xcode2')
      expect(cache.get('eth_getCode', ['0xAAA', 'latest'])).toBe('0xcode1')
      expect(cache.get('eth_getCode', ['0xBBB', 'latest'])).toBe('0xcode2')
    })

    it('should handle null/undefined params', () => {
      cache.set('eth_chainId', null, '0x1')
      cache.set('eth_chainId', undefined, '0x1')
      // Both null and undefined map to the same key via JSON.stringify
      expect(cache.get('eth_chainId', null)).toBe('0x1')
    })

    it('should return undefined for missing entries', () => {
      expect(cache.get('eth_chainId', [])).toBeUndefined()
    })
  })

  describe('TTL expiration', () => {
    it('should expire eth_chainId after 60s', () => {
      cache.set('eth_chainId', [], '0x1')
      vi.advanceTimersByTime(59_999)
      expect(cache.get('eth_chainId', [])).toBe('0x1')
      vi.advanceTimersByTime(2)
      expect(cache.get('eth_chainId', [])).toBeUndefined()
    })

    it('should expire eth_blockNumber after 2s', () => {
      cache.set('eth_blockNumber', [], '0x100')
      vi.advanceTimersByTime(1_999)
      expect(cache.get('eth_blockNumber', [])).toBe('0x100')
      vi.advanceTimersByTime(2)
      expect(cache.get('eth_blockNumber', [])).toBeUndefined()
    })

    it('should expire eth_gasPrice after 5s', () => {
      cache.set('eth_gasPrice', [], '0x1000')
      vi.advanceTimersByTime(4_999)
      expect(cache.get('eth_gasPrice', [])).toBe('0x1000')
      vi.advanceTimersByTime(2)
      expect(cache.get('eth_gasPrice', [])).toBeUndefined()
    })

    it('should expire eth_getCode after 30s', () => {
      cache.set('eth_getCode', ['0xaddr', 'latest'], '0xcode')
      vi.advanceTimersByTime(29_999)
      expect(cache.get('eth_getCode', ['0xaddr', 'latest'])).toBe('0xcode')
      vi.advanceTimersByTime(2)
      expect(cache.get('eth_getCode', ['0xaddr', 'latest'])).toBeUndefined()
    })

    it('should delete expired entry on get()', () => {
      cache.set('eth_blockNumber', [], '0x100')
      expect(cache.size).toBe(1)
      vi.advanceTimersByTime(3_000)
      cache.get('eth_blockNumber', [])
      expect(cache.size).toBe(0)
    })
  })

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      const small = new RequestCache({ maxSize: 2 })
      small.set('eth_chainId', [], '0x1') // oldest
      small.set('eth_gasPrice', [], '0x100')
      small.set('net_version', [], '1') // triggers eviction
      expect(small.get('eth_chainId', [])).toBeUndefined()
      expect(small.get('eth_gasPrice', [])).toBe('0x100')
      expect(small.get('net_version', [])).toBe('1')
    })

    it('should move accessed entry to end (LRU refresh)', () => {
      const small = new RequestCache({ maxSize: 2 })
      small.set('eth_chainId', [], '0x1')
      small.set('eth_gasPrice', [], '0x100')
      // Access chainId to make gasPrice the oldest
      small.get('eth_chainId', [])
      small.set('net_version', [], '1') // evicts gasPrice (oldest)
      expect(small.get('eth_chainId', [])).toBe('0x1')
      expect(small.get('eth_gasPrice', [])).toBeUndefined()
      expect(small.get('net_version', [])).toBe('1')
    })

    it('should not evict when updating existing key', () => {
      const small = new RequestCache({ maxSize: 2 })
      small.set('eth_chainId', [], '0x1')
      small.set('eth_gasPrice', [], '0x100')
      // Update existing key
      small.set('eth_chainId', [], '0x89')
      expect(small.size).toBe(2)
      expect(small.get('eth_chainId', [])).toBe('0x89')
      expect(small.get('eth_gasPrice', [])).toBe('0x100')
    })
  })

  describe('clear()', () => {
    it('should remove all entries', () => {
      cache.set('eth_chainId', [], '0x1')
      cache.set('eth_gasPrice', [], '0x100')
      cache.set('net_version', [], '1')
      expect(cache.size).toBe(3)
      cache.clear()
      expect(cache.size).toBe(0)
      expect(cache.get('eth_chainId', [])).toBeUndefined()
    })
  })

  describe('invalidate()', () => {
    it('should remove entries for a specific method', () => {
      cache.set('eth_getCode', ['0xAAA', 'latest'], '0xcode1')
      cache.set('eth_getCode', ['0xBBB', 'latest'], '0xcode2')
      cache.set('eth_chainId', [], '0x1')
      expect(cache.size).toBe(3)
      cache.invalidate('eth_getCode')
      expect(cache.size).toBe(1)
      expect(cache.get('eth_getCode', ['0xAAA', 'latest'])).toBeUndefined()
      expect(cache.get('eth_chainId', [])).toBe('0x1')
    })

    it('should not affect other methods', () => {
      cache.set('eth_chainId', [], '0x1')
      cache.set('net_version', [], '1')
      cache.invalidate('eth_chainId')
      expect(cache.get('net_version', [])).toBe('1')
    })

    it('should handle invalidating method with no entries', () => {
      cache.set('eth_chainId', [], '0x1')
      cache.invalidate('eth_gasPrice')
      expect(cache.size).toBe(1)
    })
  })
})

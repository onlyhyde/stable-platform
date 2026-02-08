/**
 * TokenPriceService Tests
 *
 * Tests for token price fetching, caching, and portfolio value calculation.
 * Uses jest.setSystemTime() to control module-level cache TTL.
 */

import {
  getPortfolioValue,
  getPrice,
  getPrices,
  handleGetTokenPrices,
} from '../../../src/background/services/tokenPriceService'

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

function createRatesResponse(rates: Record<string, number | string | { usd: number }>) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({ rates }),
  }
}

// Incrementing clock to ensure each test has an expired cache from previous tests.
// Must be > TTL(30s) + max advanceTimersByTime within any test (31s) = 61s minimum.
let clock = 100_000

describe('TokenPriceService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    // Each test starts 120s later than the last, guaranteeing cache expiry
    clock += 120_000
    jest.setSystemTime(clock)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('getPrice', () => {
    it('should fetch and return price for a single token', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500, BTC: 60000 }))

      const price = await getPrice('ETH')
      expect(price).toBe(2500)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should return null for unknown token', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500 }))

      const price = await getPrice('UNKNOWN')
      expect(price).toBeNull()
    })

    it('should normalize symbol to uppercase', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ eth: 2500 }))

      const price = await getPrice('eth')
      expect(price).toBe(2500)
    })

    it('should parse object rate format with usd field', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: { usd: 2500 } }))

      const price = await getPrice('ETH')
      expect(price).toBe(2500)
    })

    it('should parse string rate values', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: '2500.50' }))

      const price = await getPrice('ETH')
      expect(price).toBe(2500.5)
    })

    it('should use cache for subsequent calls within TTL', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500 }))

      const price1 = await getPrice('ETH')
      expect(price1).toBe(2500)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Advance 10s (within TTL of 30s)
      jest.advanceTimersByTime(10_000)

      const price2 = await getPrice('ETH')
      expect(price2).toBe(2500)
      // Should NOT have fetched again
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should refetch after cache TTL expires', async () => {
      mockFetch
        .mockResolvedValueOnce(createRatesResponse({ ETH: 2500 }))
        .mockResolvedValueOnce(createRatesResponse({ ETH: 2600 }))

      const price1 = await getPrice('ETH')
      expect(price1).toBe(2500)

      // Advance past TTL
      jest.advanceTimersByTime(31_000)

      const price2 = await getPrice('ETH')
      expect(price2).toBe(2600)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('getPrices', () => {
    it('should return prices for multiple tokens', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500, USDC: 1, BTC: 60000 }))

      const prices = await getPrices(['ETH', 'USDC'])
      expect(prices).toEqual({ ETH: 2500, USDC: 1 })
    })

    it('should skip tokens not found in rates', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500 }))

      const prices = await getPrices(['ETH', 'UNKNOWN'])
      expect(prices).toEqual({ ETH: 2500 })
    })

    it('should return empty object for empty symbols', async () => {
      const prices = await getPrices([])
      expect(prices).toEqual({})
    })
  })

  describe('getPortfolioValue', () => {
    it('should calculate total portfolio value', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500, USDC: 1 }))

      const value = await getPortfolioValue([
        { symbol: 'ETH', amount: 2 },
        { symbol: 'USDC', amount: 1000 },
      ])
      expect(value).toBe(6000) // 2 * 2500 + 1000 * 1
    })

    it('should ignore holdings without a price', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500 }))

      const value = await getPortfolioValue([
        { symbol: 'ETH', amount: 1 },
        { symbol: 'UNKNOWN', amount: 999 },
      ])
      expect(value).toBe(2500)
    })

    it('should return 0 for empty holdings', async () => {
      const value = await getPortfolioValue([])
      expect(value).toBe(0)
    })
  })

  describe('handleGetTokenPrices', () => {
    it('should return prices for specified symbols', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500, BTC: 60000, USDC: 1 }))

      const prices = await handleGetTokenPrices(['ETH', 'BTC'])
      expect(prices).toEqual({ ETH: 2500, BTC: 60000 })
    })

    it('should return all cached prices when no symbols specified', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500, BTC: 60000 }))

      const prices = await handleGetTokenPrices()
      expect(prices).toHaveProperty('ETH')
      expect(prices).toHaveProperty('BTC')
    })

    it('should return all cached prices for empty array', async () => {
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500 }))

      const prices = await handleGetTokenPrices([])
      expect(prices).toHaveProperty('ETH')
    })
  })

  describe('error handling', () => {
    it('should return stale cache on network error', async () => {
      // First call succeeds
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500 }))

      const price1 = await getPrice('ETH')
      expect(price1).toBe(2500)

      // Advance past TTL
      jest.advanceTimersByTime(31_000)

      // Second call fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      const price2 = await getPrice('ETH')
      // Should return stale cached price
      expect(price2).toBe(2500)
    })

    it('should return stale cache on non-ok response', async () => {
      // First call succeeds
      mockFetch.mockResolvedValueOnce(createRatesResponse({ ETH: 2500 }))

      await getPrice('ETH')

      // Advance past TTL
      jest.advanceTimersByTime(31_000)

      // Second call returns non-ok
      mockFetch.mockResolvedValueOnce({ ok: false })
      const price = await getPrice('ETH')
      expect(price).toBe(2500)
    })
  })
})

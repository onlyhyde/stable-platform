/**
 * Token Price Service
 *
 * Fetches token prices from the onramp-simulator rates endpoint.
 * Maintains a 30-second TTL cache to minimize API calls.
 */

interface TokenPrice {
  symbol: string
  priceUsd: number
  lastUpdated: number
}

interface PriceCache {
  prices: Map<string, TokenPrice>
  lastFetched: number
}

const CACHE_TTL_MS = 30_000 // 30 seconds
const DEFAULT_RATES_URL = 'http://localhost:3002/api/v1/rates'

let priceCache: PriceCache = {
  prices: new Map(),
  lastFetched: 0,
}

/**
 * Get the rates API URL from settings or use default
 */
function getRatesUrl(): string {
  // Could be configured via network settings in the future
  return DEFAULT_RATES_URL
}

/**
 * Fetch prices from the onramp-simulator rates endpoint
 */
async function fetchPrices(): Promise<Map<string, TokenPrice>> {
  const now = Date.now()

  // Return cache if still valid
  if (now - priceCache.lastFetched < CACHE_TTL_MS && priceCache.prices.size > 0) {
    return priceCache.prices
  }

  try {
    const response = await fetch(getRatesUrl())
    if (!response.ok) {
      return priceCache.prices // Return stale cache on error
    }

    const data = await response.json()
    const prices = new Map<string, TokenPrice>()

    // Parse rate data - format depends on API response
    if (data.rates && typeof data.rates === 'object') {
      for (const [symbol, rate] of Object.entries(data.rates)) {
        if (typeof rate === 'number' || typeof rate === 'string') {
          prices.set(symbol.toUpperCase(), {
            symbol: symbol.toUpperCase(),
            priceUsd: Number(rate),
            lastUpdated: now,
          })
        } else if (rate && typeof rate === 'object' && 'usd' in (rate as Record<string, unknown>)) {
          prices.set(symbol.toUpperCase(), {
            symbol: symbol.toUpperCase(),
            priceUsd: Number((rate as Record<string, number>).usd),
            lastUpdated: now,
          })
        }
      }
    }

    priceCache = { prices, lastFetched: now }
    return prices
  } catch {
    return priceCache.prices // Return stale cache on network error
  }
}

/**
 * Get price for a single token
 */
export async function getPrice(symbol: string): Promise<number | null> {
  const prices = await fetchPrices()
  return prices.get(symbol.toUpperCase())?.priceUsd ?? null
}

/**
 * Get prices for multiple tokens
 */
export async function getPrices(symbols: string[]): Promise<Record<string, number>> {
  const prices = await fetchPrices()
  const result: Record<string, number> = {}
  for (const symbol of symbols) {
    const price = prices.get(symbol.toUpperCase())
    if (price) {
      result[symbol.toUpperCase()] = price.priceUsd
    }
  }
  return result
}

/**
 * Get total portfolio value in USD
 */
export async function getPortfolioValue(
  holdings: Array<{ symbol: string; amount: number }>
): Promise<number> {
  const prices = await fetchPrices()
  let total = 0
  for (const holding of holdings) {
    const price = prices.get(holding.symbol.toUpperCase())
    if (price) {
      total += holding.amount * price.priceUsd
    }
  }
  return total
}

/**
 * Handle GET_TOKEN_PRICES message from UI
 */
export async function handleGetTokenPrices(symbols?: string[]): Promise<Record<string, number>> {
  if (symbols && symbols.length > 0) {
    return getPrices(symbols)
  }
  // Return all cached prices
  const prices = await fetchPrices()
  const result: Record<string, number> = {}
  for (const [symbol, price] of prices) {
    result[symbol] = price.priceUsd
  }
  return result
}

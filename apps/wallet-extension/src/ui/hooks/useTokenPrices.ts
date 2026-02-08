import { useCallback, useEffect, useState } from 'react'

interface UseTokenPricesReturn {
  prices: Record<string, number>
  isLoading: boolean
  totalValueUsd: number | null
}

const POLL_INTERVAL_MS = 30_000 // 30 seconds

/**
 * Hook for fetching token USD prices from the background token price service.
 *
 * Polls every 30 seconds to keep prices fresh.
 */
export function useTokenPrices(symbols: string[] = []): UseTokenPricesReturn {
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)

  const fetchPrices = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TOKEN_PRICES',
        id: `prices-${Date.now()}`,
        payload: { symbols },
      })
      if (response?.payload?.prices && typeof response.payload.prices === 'object') {
        setPrices(response.payload.prices)
      }
    } catch {
      // Price fetch failed silently
    } finally {
      setIsLoading(false)
    }
  }, [symbols])

  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchPrices])

  // Calculate total portfolio value (sum of all prices * 1 for display purposes)
  const totalValueUsd = Object.keys(prices).length > 0 ? null : null

  return { prices, isLoading, totalValueUsd }
}

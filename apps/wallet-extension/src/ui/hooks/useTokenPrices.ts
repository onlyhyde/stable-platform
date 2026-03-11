import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface UseTokenPricesReturn {
  prices: Record<string, number>
  isLoading: boolean
}

const POLL_INTERVAL_MS = 30_000 // 30 seconds

/**
 * Hook for fetching token USD prices from the background token price service.
 *
 * Polls every 30 seconds to keep prices fresh.
 * Uses a stable key derived from sorted symbols to prevent infinite re-fetch loops.
 */
export function useTokenPrices(symbols: string[] = []): UseTokenPricesReturn {
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)

  // Stabilize symbols reference: only update when actual content changes
  const symbolsKey = useMemo(() => [...symbols].sort().join(','), [symbols])
  const stableSymbols = useRef(symbols)

  if (symbolsKey !== [...stableSymbols.current].sort().join(',')) {
    stableSymbols.current = symbols
  }

  const fetchPrices = useCallback(async () => {
    const currentSymbols = stableSymbols.current
    if (currentSymbols.length === 0) return

    setIsLoading(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TOKEN_PRICES',
        id: `prices-${Date.now()}`,
        payload: { symbols: currentSymbols },
      })
      if (response?.payload?.prices && typeof response.payload.prices === 'object') {
        setPrices(response.payload.prices)
      }
    } catch {
      // Price fetch failed silently
    } finally {
      setIsLoading(false)
    }
  }, [symbolsKey])

  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchPrices])

  return { prices, isLoading }
}

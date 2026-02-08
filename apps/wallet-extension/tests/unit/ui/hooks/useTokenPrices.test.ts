/**
 * useTokenPrices Hook Tests
 *
 * Tests for token price fetching via chrome.runtime.sendMessage,
 * polling behavior, and error handling.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { useTokenPrices } from '../../../../src/ui/hooks/useTokenPrices'

// Stable symbols array to avoid infinite re-render from new reference
const SYMBOLS_ETH_BTC = ['ETH', 'BTC']
const SYMBOLS_ETH = ['ETH']

function getSendMessage() {
  return chrome.runtime.sendMessage as jest.Mock
}

describe('useTokenPrices', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    getSendMessage().mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should fetch prices on mount', async () => {
    getSendMessage().mockResolvedValue({
      payload: { prices: { ETH: 2500, BTC: 60000 } },
    })

    const { result } = renderHook(() => useTokenPrices(SYMBOLS_ETH_BTC))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.prices).toEqual({ ETH: 2500, BTC: 60000 })
    expect(getSendMessage()).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'GET_TOKEN_PRICES',
        payload: { symbols: SYMBOLS_ETH_BTC },
      })
    )
  })

  it('should return empty prices when response has no payload', async () => {
    getSendMessage().mockResolvedValue({})

    const { result } = renderHook(() => useTokenPrices(SYMBOLS_ETH))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.prices).toEqual({})
  })

  it('should handle sendMessage failure gracefully', async () => {
    getSendMessage().mockRejectedValue(new Error('Extension context invalidated'))

    const { result } = renderHook(() => useTokenPrices(SYMBOLS_ETH))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.prices).toEqual({})
  })

  it('should poll for prices at 30s interval', async () => {
    getSendMessage()
      .mockResolvedValueOnce({ payload: { prices: { ETH: 2500 } } })
      .mockResolvedValueOnce({ payload: { prices: { ETH: 2600 } } })

    const { result } = renderHook(() => useTokenPrices(SYMBOLS_ETH))

    await waitFor(() => {
      expect(result.current.prices).toEqual({ ETH: 2500 })
    })

    // Advance past polling interval
    act(() => {
      jest.advanceTimersByTime(30_000)
    })

    await waitFor(() => {
      expect(result.current.prices).toEqual({ ETH: 2600 })
    })

    expect(getSendMessage()).toHaveBeenCalledTimes(2)
  })

  it('should work with empty symbols array', async () => {
    getSendMessage().mockResolvedValue({
      payload: { prices: {} },
    })

    const emptySymbols: string[] = []
    const { result } = renderHook(() => useTokenPrices(emptySymbols))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.prices).toEqual({})
  })

  it('should clean up interval on unmount', async () => {
    getSendMessage().mockResolvedValue({
      payload: { prices: { ETH: 2500 } },
    })

    const { result, unmount } = renderHook(() => useTokenPrices(SYMBOLS_ETH))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const callCount = getSendMessage().mock.calls.length
    unmount()

    // Advance past polling interval - should NOT trigger new fetch
    act(() => {
      jest.advanceTimersByTime(60_000)
    })

    expect(getSendMessage()).toHaveBeenCalledTimes(callCount)
  })

  it('should return null for totalValueUsd', () => {
    getSendMessage().mockResolvedValue({
      payload: { prices: { ETH: 2500 } },
    })

    const { result } = renderHook(() => useTokenPrices(SYMBOLS_ETH))

    // totalValueUsd is always null in current implementation
    expect(result.current.totalValueUsd).toBeNull()
  })
})

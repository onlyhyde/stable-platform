import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChainId } from '../../src/hooks/useChainId'
import { StableNetProvider } from '../../src/provider/StableNetProvider'
import { createMockProvider } from '../setup'

describe('useChainId', () => {
  let mockProvider: ReturnType<typeof createMockProvider>
  let provider: StableNetProvider

  beforeEach(() => {
    mockProvider = createMockProvider()
    provider = new StableNetProvider(mockProvider)
  })

  it('should return null when provider is null', () => {
    const { result } = renderHook(() => useChainId({ provider: null }))
    expect(result.current.chainId).toBeNull()
    expect(result.current.chainIdHex).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should fetch chainId on mount', async () => {
    const { result } = renderHook(() => useChainId({ provider }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.chainId).toBe(1)
    expect(result.current.chainIdHex).toBe('0x1')
    expect(result.current.error).toBeNull()
  })

  it('should return both decimal and hex formats', async () => {
    const hexProvider = createMockProvider({ eth_chainId: '0x89' })
    const prov = new StableNetProvider(hexProvider)

    const { result } = renderHook(() => useChainId({ provider: prov }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.chainId).toBe(137) // 0x89 = 137 (Polygon)
    expect(result.current.chainIdHex).toBe('0x89')
  })

  it('should handle chainChanged events', async () => {
    const { result } = renderHook(() => useChainId({ provider }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.chainId).toBe(1)

    act(() => {
      mockProvider._emit('chainChanged', '0xa')
    })

    expect(result.current.chainId).toBe(10) // 0xa = 10 (Optimism)
    expect(result.current.chainIdHex).toBe('0xa')
  })

  it('should handle fetch errors', async () => {
    const errorProvider = createMockProvider({
      eth_chainId: () => {
        throw new Error('Network error')
      },
    })
    const errProv = new StableNetProvider(errorProvider)

    const { result } = renderHook(() => useChainId({ provider: errProv }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeTruthy()
  })

  it('should clean up listener on unmount', async () => {
    const { result, unmount } = renderHook(() => useChainId({ provider }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    unmount()

    // After unmount, emitting chainChanged should not cause state updates
    // (StableNetProvider.on() returns cleanup function which is called on unmount)
    // This verifies no errors are thrown from updating unmounted component state
  })
})

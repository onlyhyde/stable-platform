import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToken } from '../../src/hooks/useToken'
import { StableNetProvider } from '../../src/provider/StableNetProvider'
import { createMockProvider } from '../setup'

const TOKEN_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`
const ACCOUNT = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`

/**
 * Encode a string as ABI-encoded bytes (for name/symbol)
 */
function encodeString(str: string): string {
  const hex = Buffer.from(str).toString('hex')
  const offset = '0000000000000000000000000000000000000000000000000000000000000020'
  const length = str.length.toString(16).padStart(64, '0')
  const data = hex.padEnd(64, '0')
  return '0x' + offset + length + data
}

/**
 * Encode a uint256 as ABI-encoded bytes (for decimals/balance)
 */
function encodeUint256(value: bigint): string {
  return '0x' + value.toString(16).padStart(64, '0')
}

function createTokenMockProvider() {
  return createMockProvider({
    eth_call: (params: unknown) => {
      const callData = params?.[0]?.data as string
      if (!callData) return '0x'
      // name()
      if (callData.startsWith('0x06fdde03')) return encodeString('USD Coin')
      // symbol()
      if (callData.startsWith('0x95d89b41')) return encodeString('USDC')
      // decimals()
      if (callData.startsWith('0x313ce567')) return encodeUint256(6n)
      // balanceOf(address)
      if (callData.startsWith('0x70a08231')) return encodeUint256(1_000_000n) // 1 USDC
      return '0x'
    },
  })
}

describe('useToken', () => {
  let mockProvider: ReturnType<typeof createMockProvider>
  let provider: StableNetProvider

  beforeEach(() => {
    mockProvider = createTokenMockProvider()
    provider = new StableNetProvider(mockProvider)
  })

  it('should return null when provider is null', () => {
    const { result } = renderHook(() => useToken({ tokenAddress: TOKEN_ADDR, provider: null }))
    expect(result.current.token).toBeNull()
    expect(result.current.balance).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should fetch token info', async () => {
    const { result } = renderHook(() => useToken({ tokenAddress: TOKEN_ADDR, provider }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.token).toBeTruthy()
    expect(result.current.token!.name).toBe('USD Coin')
    expect(result.current.token!.symbol).toBe('USDC')
    expect(result.current.token!.decimals).toBe(6)
    expect(result.current.token!.address).toBe(TOKEN_ADDR)
  })

  it('should fetch token balance when account is provided', async () => {
    const { result } = renderHook(() =>
      useToken({ tokenAddress: TOKEN_ADDR, account: ACCOUNT, provider })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.balance).toBeTruthy()
    expect(result.current.balance!.raw).toBe(1_000_000n)
    expect(result.current.balance!.symbol).toBe('USDC')
    expect(result.current.balance!.decimals).toBe(6)
  })

  it('should not fetch balance when account is not provided', async () => {
    const { result } = renderHook(() => useToken({ tokenAddress: TOKEN_ADDR, provider }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.token).toBeTruthy()
    expect(result.current.balance).toBeNull()
  })

  it('should format balance with correct decimals', async () => {
    const { result } = renderHook(() =>
      useToken({ tokenAddress: TOKEN_ADDR, account: ACCOUNT, provider })
    )

    await waitFor(() => {
      expect(result.current.balance).toBeTruthy()
    })

    // 1_000_000 / 10^6 = 1 (viem's formatUnits doesn't pad trailing zeros)
    expect(result.current.balance!.formatted).toBe('1')
  })

  it('should handle fetch errors', async () => {
    const errorProvider = createMockProvider({
      eth_call: () => {
        throw new Error('RPC error')
      },
    })
    const errProv = new StableNetProvider(errorProvider)

    const { result } = renderHook(() => useToken({ tokenAddress: TOKEN_ADDR, provider: errProv }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.token).toBeNull()
  })

  it('should refetch when refetch is called', async () => {
    const requestSpy = vi.spyOn(mockProvider, 'request')

    const { result } = renderHook(() => useToken({ tokenAddress: TOKEN_ADDR, provider }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const callsBefore = requestSpy.mock.calls.length

    await act(async () => {
      await result.current.refetch()
    })

    expect(requestSpy.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('should refetch on accountsChanged when watch=true', async () => {
    const requestSpy = vi.spyOn(mockProvider, 'request')

    const { result } = renderHook(() =>
      useToken({ tokenAddress: TOKEN_ADDR, provider, watch: true })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const callsBefore = requestSpy.mock.calls.length

    act(() => {
      mockProvider._emit('accountsChanged', ['0xnew'])
    })

    await waitFor(() => {
      expect(requestSpy.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it('should refetch on chainChanged when watch=true', async () => {
    const requestSpy = vi.spyOn(mockProvider, 'request')

    const { result } = renderHook(() =>
      useToken({ tokenAddress: TOKEN_ADDR, provider, watch: true })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const callsBefore = requestSpy.mock.calls.length

    act(() => {
      mockProvider._emit('chainChanged', '0x89')
    })

    await waitFor(() => {
      expect(requestSpy.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  it('should not watch when watch=false', async () => {
    const requestSpy = vi.spyOn(mockProvider, 'request')

    const { result } = renderHook(() =>
      useToken({ tokenAddress: TOKEN_ADDR, provider, watch: false })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const callsBefore = requestSpy.mock.calls.length

    act(() => {
      mockProvider._emit('accountsChanged', ['0xnew'])
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(requestSpy.mock.calls.length).toBe(callsBefore)
  })
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBalance } from '../../src/hooks/useBalance'
import { StableNetProvider } from '../../src/provider/StableNetProvider'
import { createMockProvider } from '../setup'

describe('useBalance', () => {
  let mockProvider: ReturnType<typeof createMockProvider>
  let provider: StableNetProvider

  beforeEach(() => {
    mockProvider = createMockProvider()
    provider = new StableNetProvider(mockProvider)
  })

  it('should return null balance when no provider', () => {
    const { result } = renderHook(() =>
      useBalance({
        provider: null,
        account: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
      })
    )

    expect(result.current.balance).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should return null balance when no address', () => {
    const { result } = renderHook(() =>
      useBalance({
        provider,
        account: null,
      })
    )

    expect(result.current.balance).toBeNull()
  })

  it('should fetch balance for account', async () => {
    const { result } = renderHook(() =>
      useBalance({
        provider,
        account: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.balance).toBe(1000000000000000000n)
    expect(result.current.error).toBeNull()
  })

  it('should fetch balance for explicit address', async () => {
    const { result } = renderHook(() =>
      useBalance({
        provider,
        address: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.balance).toBe(1000000000000000000n)
  })

  it('should handle fetch errors', async () => {
    const errorProvider = createMockProvider({
      eth_getBalance: () => {
        throw new Error('Network error')
      },
    })
    const errProv = new StableNetProvider(errorProvider)

    const { result } = renderHook(() =>
      useBalance({
        provider: errProv,
        account: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeDefined()
    expect(result.current.balance).toBeNull()
  })

  it('should refetch when refetch is called', async () => {
    const requestSpy = vi.spyOn(mockProvider, 'request')

    const { result } = renderHook(() =>
      useBalance({
        provider,
        account: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const balanceCalls = () =>
      requestSpy.mock.calls.filter(
        (call) => (call[0] as { method: string }).method === 'eth_getBalance'
      ).length

    const initialCalls = balanceCalls()

    await act(async () => {
      await result.current.refetch()
    })

    expect(balanceCalls()).toBe(initialCalls + 1)
  })

  it('should refetch on accountsChanged when watching', async () => {
    const requestSpy = vi.spyOn(mockProvider, 'request')

    const { result } = renderHook(() =>
      useBalance({
        provider,
        account: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
        watch: true,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const balanceCalls = () =>
      requestSpy.mock.calls.filter(
        (call) => (call[0] as { method: string }).method === 'eth_getBalance'
      ).length

    const beforeCalls = balanceCalls()

    act(() => {
      mockProvider._emit('accountsChanged', ['0xnew'])
    })

    await waitFor(() => {
      expect(balanceCalls()).toBeGreaterThan(beforeCalls)
    })
  })

  it('should not watch when watch is false', async () => {
    const requestSpy = vi.spyOn(mockProvider, 'request')

    const { result } = renderHook(() =>
      useBalance({
        provider,
        account: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
        watch: false,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const balanceCalls = () =>
      requestSpy.mock.calls.filter(
        (call) => (call[0] as { method: string }).method === 'eth_getBalance'
      ).length

    const beforeCalls = balanceCalls()

    act(() => {
      mockProvider._emit('accountsChanged', ['0xnew'])
    })

    // Give time for potential async operations
    await new Promise((r) => setTimeout(r, 50))

    expect(balanceCalls()).toBe(beforeCalls)
  })
})

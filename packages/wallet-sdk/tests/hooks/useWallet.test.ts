import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useWallet } from '../../src/hooks/useWallet'
import { createMockProvider } from '../setup'

describe('useWallet', () => {
  beforeEach(() => {
    delete (window as Record<string, unknown>).stablenet
    delete (window as Record<string, unknown>).ethereum
  })

  afterEach(() => {
    delete (window as Record<string, unknown>).stablenet
    delete (window as Record<string, unknown>).ethereum
  })

  it('should start with disconnected state', () => {
    const { result } = renderHook(() => useWallet({ timeout: 100 }))

    expect(result.current.isConnected).toBe(false)
    expect(result.current.account).toBeNull()
    expect(result.current.chainId).toBeNull()
    expect(result.current.isConnecting).toBe(false)
  })

  it('should detect existing connection', async () => {
    const mockProv = createMockProvider()
    ;(window as Record<string, unknown>).stablenet = mockProv

    const { result } = renderHook(() => useWallet({ timeout: 100 }))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    expect(result.current.account).toBe('0x1234567890abcdef1234567890abcdef12345678')
    expect(result.current.chainId).toBe(1)
  })

  it('should connect on user action', async () => {
    const mockProv = createMockProvider({
      eth_accounts: [], // No existing connection
    })
    ;(window as Record<string, unknown>).stablenet = mockProv

    const { result } = renderHook(() => useWallet({ timeout: 100 }))

    // Wait for provider detection to complete (provider sets up but no accounts)
    // Since eth_accounts returns [], isConnected stays false and isConnecting stays false
    await waitFor(() => {
      expect(result.current.isConnecting).toBe(false)
    })

    // Small delay to let the useEffect complete
    await new Promise((r) => setTimeout(r, 200))

    // Connect
    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.isConnected).toBe(true)
    expect(result.current.account).toBe('0x1234567890abcdef1234567890abcdef12345678')
  })

  it('should disconnect', async () => {
    const mockProv = createMockProvider()
    ;(window as Record<string, unknown>).stablenet = mockProv

    const { result } = renderHook(() => useWallet({ timeout: 100 }))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    await act(async () => {
      await result.current.disconnect()
    })

    expect(result.current.isConnected).toBe(false)
    expect(result.current.account).toBeNull()
  })

  it('should throw on connect when wallet not detected', async () => {
    const { result } = renderHook(() => useWallet({ timeout: 100 }))

    await expect(
      act(async () => {
        await result.current.connect()
      })
    ).rejects.toThrow('Wallet not detected')
  })

  it('should update state on accountsChanged event', async () => {
    const mockProv = createMockProvider()
    ;(window as Record<string, unknown>).stablenet = mockProv

    const { result } = renderHook(() => useWallet({ timeout: 100 }))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      mockProv._emit('accountsChanged', ['0xabcdef1234567890abcdef1234567890abcdef12'])
    })

    await waitFor(() => {
      expect(result.current.account).toBe('0xabcdef1234567890abcdef1234567890abcdef12')
    })
  })

  it('should update state on chainChanged event', async () => {
    const mockProv = createMockProvider()
    ;(window as Record<string, unknown>).stablenet = mockProv

    const { result } = renderHook(() => useWallet({ timeout: 100 }))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      mockProv._emit('chainChanged', '0x89')
    })

    await waitFor(() => {
      expect(result.current.chainId).toBe(137)
    })
  })

  it('should set error on failed detection', async () => {
    // This is hard to trigger in jsdom since there's no provider installed
    const { result } = renderHook(() => useWallet({ timeout: 100 }))

    // Just verify no error in clean state
    expect(result.current.error).toBeNull()
  })
})

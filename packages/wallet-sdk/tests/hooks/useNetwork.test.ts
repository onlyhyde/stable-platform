import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkRegistry } from '../../src/config/registry'
import { useNetwork } from '../../src/hooks/useNetwork'
import { StableNetProvider } from '../../src/provider/StableNetProvider'
import { createMockProvider } from '../setup'

describe('useNetwork', () => {
  let mockProvider: ReturnType<typeof createMockProvider>
  let provider: StableNetProvider
  let registry: NetworkRegistry

  beforeEach(() => {
    mockProvider = createMockProvider()
    provider = new StableNetProvider(mockProvider)
    registry = new NetworkRegistry()
  })

  it('should return null when no provider', () => {
    const { result } = renderHook(() => useNetwork({ provider: null, registry }))

    expect(result.current.network).toBeNull()
    expect(result.current.chainId).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should fetch current chain ID', async () => {
    const { result } = renderHook(() => useNetwork({ provider, registry }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.chainId).toBe(1)
  })

  it('should return network info for known chain', async () => {
    // Mock provider to return StableNet Local chain (8283)
    const localProvider = createMockProvider({
      eth_chainId: '0x205b', // 8283
    })
    const localProv = new StableNetProvider(localProvider)

    const { result } = renderHook(() => useNetwork({ provider: localProv, registry }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.chainId).toBe(8283)
    expect(result.current.network).toBeDefined()
    expect(result.current.network?.name).toBe('StableNet Local')
  })

  it('should detect testnets', async () => {
    const testnetProvider = createMockProvider({
      eth_chainId: '0x205b', // 8283 (StableNet Local - testnet)
    })
    const testProv = new StableNetProvider(testnetProvider)

    const { result } = renderHook(() => useNetwork({ provider: testProv, registry }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isTestnet).toBe(true)
  })

  it('should return all available networks', async () => {
    const { result } = renderHook(() => useNetwork({ provider, registry }))

    expect(result.current.networks.length).toBeGreaterThan(0)
  })

  it('should return supported chain IDs', async () => {
    const { result } = renderHook(() => useNetwork({ provider, registry }))

    expect(result.current.supportedChainIds).toContain(31337)
    expect(result.current.supportedChainIds).toContain(8283)
  })

  it('should check if chain is supported', async () => {
    const { result } = renderHook(() => useNetwork({ provider, registry }))

    expect(result.current.isSupported(31337)).toBe(true)
    expect(result.current.isSupported(99999)).toBe(false)
  })

  it('should switch network', async () => {
    const requestSpy = vi.spyOn(mockProvider, 'request')

    const { result } = renderHook(() => useNetwork({ provider, registry }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.switchNetwork(137)
    })

    expect(requestSpy).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x89' }],
    })
  })

  it('should throw on switch when no provider', async () => {
    const { result } = renderHook(() => useNetwork({ provider: null, registry }))

    await expect(
      act(async () => {
        await result.current.switchNetwork(137)
      })
    ).rejects.toThrow('Provider not available')
  })

  it('should add a custom network', async () => {
    const { result } = renderHook(() => useNetwork({ provider, registry }))

    await act(async () => {
      await result.current.addNetwork({
        chainId: 42161,
        name: 'Arbitrum',
        symbol: 'ETH',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
      })
    })

    expect(registry.hasNetwork(42161)).toBe(true)
  })

  it('should update chain ID on chainChanged event', async () => {
    const { result } = renderHook(() => useNetwork({ provider, registry }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.chainId).toBe(1)

    act(() => {
      mockProvider._emit('chainChanged', '0x89')
    })

    await waitFor(() => {
      expect(result.current.chainId).toBe(137)
    })
  })

  it('should handle chain ID fetch errors', async () => {
    const errorProvider = createMockProvider({
      eth_chainId: () => {
        throw new Error('RPC error')
      },
    })
    const errProv = new StableNetProvider(errorProvider)

    const { result } = renderHook(() => useNetwork({ provider: errProv, registry }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeDefined()
  })
})

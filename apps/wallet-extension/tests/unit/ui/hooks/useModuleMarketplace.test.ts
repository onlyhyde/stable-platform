/**
 * useModuleMarketplace Hook Tests
 *
 * Tests for registry module fetching via stablenet_getRegistryModules RPC.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { useWalletStore } from '../../../../src/ui/hooks/useWalletStore'
import { useModuleMarketplace } from '../../../../src/ui/pages/Modules/hooks/useModuleMarketplace'

function getSendMessage() {
  return chrome.runtime.sendMessage as jest.Mock
}

const MOCK_NETWORK = {
  chainId: 1,
  name: 'Ethereum Mainnet',
  rpcUrl: 'https://eth-mainnet.example.com',
  currency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
}

const MOCK_MODULES = [
  {
    metadata: {
      address: '0xValidator1',
      type: 1n,
      name: 'ECDSA Validator',
      description: 'Standard ECDSA signature validation',
      version: '1.0.0',
      isVerified: true,
    },
    configSchema: null,
    addresses: { 1: '0xValidator1' },
    supportedChains: [1, 137],
  },
  {
    metadata: {
      address: '0xExecutor1',
      type: 2n,
      name: 'Swap Executor',
      description: 'DEX swap execution module',
      version: '1.0.0',
      isVerified: false,
    },
    configSchema: null,
    addresses: { 1: '0xExecutor1' },
    supportedChains: [1],
  },
]

describe('useModuleMarketplace', () => {
  beforeEach(() => {
    getSendMessage().mockReset()
    useWalletStore.setState({
      networks: [MOCK_NETWORK],
      selectedChainId: 1,
    })
  })

  it('should fetch registry modules on mount', async () => {
    getSendMessage().mockResolvedValue({
      payload: { result: { modules: MOCK_MODULES } },
    })

    const { result } = renderHook(() => useModuleMarketplace())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.registryModules).toEqual(MOCK_MODULES)
    expect(result.current.error).toBeNull()
    expect(getSendMessage()).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RPC_REQUEST',
        payload: expect.objectContaining({
          method: 'stablenet_getRegistryModules',
          params: [{ chainId: 1 }],
        }),
      })
    )
  })

  it('should return empty array when no modules in response', async () => {
    getSendMessage().mockResolvedValue({
      payload: { result: {} },
    })

    const { result } = renderHook(() => useModuleMarketplace())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.registryModules).toEqual([])
  })

  it('should handle RPC error response', async () => {
    getSendMessage().mockResolvedValue({
      payload: { error: { message: 'Registry unavailable' } },
    })

    const { result } = renderHook(() => useModuleMarketplace())

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error!.message).toBe('Registry unavailable')
    expect(result.current.registryModules).toEqual([])
  })

  it('should handle sendMessage rejection', async () => {
    getSendMessage().mockRejectedValue(new Error('Connection failed'))

    const { result } = renderHook(() => useModuleMarketplace())

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error!.message).toBe('Connection failed')
  })

  it('should handle non-Error throws', async () => {
    getSendMessage().mockRejectedValue(42)

    const { result } = renderHook(() => useModuleMarketplace())

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error!.message).toBe('Failed to fetch registry modules')
  })

  it('should support refetch', async () => {
    getSendMessage()
      .mockResolvedValueOnce({ payload: { result: { modules: [MOCK_MODULES[0]] } } })
      .mockResolvedValueOnce({ payload: { result: { modules: MOCK_MODULES } } })

    const { result } = renderHook(() => useModuleMarketplace())

    await waitFor(() => {
      expect(result.current.registryModules).toHaveLength(1)
    })

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.registryModules).toHaveLength(2)
  })

  it('should handle RPC error with fallback message', async () => {
    getSendMessage().mockResolvedValue({
      payload: { error: {} }, // No message field
    })

    const { result } = renderHook(() => useModuleMarketplace())

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error!.message).toBe('Failed to fetch registry modules')
  })
})

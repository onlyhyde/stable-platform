/**
 * useSmartAccountInfo Hook Tests
 *
 * Tests for Smart Account info fetching via stablenet_getSmartAccountInfo RPC.
 * Hook depends on useSelectedNetwork (reads zustand store) and chrome.runtime.sendMessage.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import type { Address } from 'viem'
import { useWalletStore } from '../../../../src/ui/hooks/useWalletStore'
import { useSmartAccountInfo } from '../../../../src/ui/pages/Modules/hooks/useSmartAccountInfo'

const TEST_ACCOUNT = '0x1234567890abcdef1234567890abcdef12345678' as Address
const TEST_VALIDATOR = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address

function getSendMessage() {
  return chrome.runtime.sendMessage as jest.Mock
}

const MOCK_NETWORK = {
  chainId: 1,
  name: 'Ethereum Mainnet',
  rpcUrl: 'https://eth-mainnet.example.com',
  currency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
}

describe('useSmartAccountInfo', () => {
  beforeEach(() => {
    getSendMessage().mockReset()
    // Set up zustand store with a network so useSelectedNetwork returns a value
    useWalletStore.setState({
      networks: [MOCK_NETWORK],
      selectedChainId: 1,
    })
  })

  it('should fetch smart account info on mount', async () => {
    const mockInfo = {
      accountType: 'smart',
      isDeployed: true,
      rootValidator: TEST_VALIDATOR,
      accountId: 'stablenet.kernel.v0.3.3',
      delegationTarget: null,
      isDelegated: false,
    }

    getSendMessage().mockResolvedValue({
      payload: { result: mockInfo },
    })

    const { result } = renderHook(() => useSmartAccountInfo(TEST_ACCOUNT))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.info).toEqual(mockInfo)
    expect(result.current.error).toBeNull()
    expect(getSendMessage()).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RPC_REQUEST',
        payload: expect.objectContaining({
          method: 'stablenet_getSmartAccountInfo',
          params: [{ account: TEST_ACCOUNT, chainId: 1 }],
        }),
      })
    )
  })

  it('should return null info when no account address provided', async () => {
    const { result } = renderHook(() => useSmartAccountInfo(undefined))

    // Should not call sendMessage at all
    expect(getSendMessage()).not.toHaveBeenCalled()
    expect(result.current.info).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should return null info when no network selected', async () => {
    useWalletStore.setState({
      networks: [],
      selectedChainId: 999, // Non-matching chainId
    })

    const { result } = renderHook(() => useSmartAccountInfo(TEST_ACCOUNT))

    expect(getSendMessage()).not.toHaveBeenCalled()
    expect(result.current.info).toBeNull()
  })

  it('should handle RPC error response', async () => {
    getSendMessage().mockResolvedValue({
      payload: { error: { message: 'Account not found' } },
    })

    const { result } = renderHook(() => useSmartAccountInfo(TEST_ACCOUNT))

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error!.message).toBe('Account not found')
    expect(result.current.info).toBeNull()
  })

  it('should handle sendMessage rejection', async () => {
    getSendMessage().mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useSmartAccountInfo(TEST_ACCOUNT))

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error!.message).toBe('Network error')
    expect(result.current.info).toBeNull()
  })

  it('should handle non-Error throws', async () => {
    getSendMessage().mockRejectedValue('string error')

    const { result } = renderHook(() => useSmartAccountInfo(TEST_ACCOUNT))

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error!.message).toBe('Failed to fetch smart account info')
  })

  it('should return delegated account info', async () => {
    const mockInfo = {
      accountType: 'delegated',
      isDeployed: false,
      rootValidator: null,
      accountId: null,
      delegationTarget: '0xKernelImplementation',
      isDelegated: true,
    }

    getSendMessage().mockResolvedValue({
      payload: { result: mockInfo },
    })

    const { result } = renderHook(() => useSmartAccountInfo(TEST_ACCOUNT))

    await waitFor(() => {
      expect(result.current.info?.isDelegated).toBe(true)
    })

    expect(result.current.info?.accountType).toBe('delegated')
    expect(result.current.info?.delegationTarget).toBe('0xKernelImplementation')
  })

  it('should support refetch', async () => {
    getSendMessage()
      .mockResolvedValueOnce({
        payload: {
          result: {
            accountType: 'eoa',
            isDeployed: false,
            rootValidator: null,
            accountId: null,
            delegationTarget: null,
            isDelegated: false,
          },
        },
      })
      .mockResolvedValueOnce({
        payload: {
          result: {
            accountType: 'smart',
            isDeployed: true,
            rootValidator: TEST_VALIDATOR,
            accountId: 'v0.3.3',
            delegationTarget: null,
            isDelegated: false,
          },
        },
      })

    const { result } = renderHook(() => useSmartAccountInfo(TEST_ACCOUNT))

    await waitFor(() => {
      expect(result.current.info?.accountType).toBe('eoa')
    })

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.info?.accountType).toBe('smart')
    expect(result.current.info?.isDeployed).toBe(true)
  })
})

/**
 * useContractRead Tests
 *
 * Tests for the smart contract read hook (eth_call encoding/decoding).
 *
 * Note: The hook uses `args` in useCallback dependencies, so args must be
 * a stable reference to avoid infinite re-renders. We define args outside
 * the renderHook callback and use React.useRef pattern where needed.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import type { Abi, Address } from 'viem'
import { encodeFunctionResult } from 'viem'
import { useContractRead } from '../../src/hooks/useContractRead'
import { createMockProvider, flushPromises } from '../setup'

const TEST_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address
const TEST_ACCOUNT = '0x1234567890abcdef1234567890abcdef12345678' as Address

const erc20Abi: Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
] as const

function encodeMockResult(abi: Abi, functionName: string, value: unknown): string {
  return encodeFunctionResult({ abi, functionName, result: value })
}

// Stable args references (avoid new array ref each render causing infinite loops)
const BALANCE_OF_ARGS = [TEST_ACCOUNT] as const

describe('useContractRead', () => {
  it('should fetch data and return decoded result', async () => {
    const mockResult = encodeMockResult(erc20Abi, 'balanceOf', BigInt(1000000))
    const provider = createMockProvider({ eth_call: mockResult })

    const { result } = renderHook(() =>
      useContractRead({
        address: TEST_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: BALANCE_OF_ARGS,
        provider: provider as unknown,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBe(BigInt(1000000))
    expect(result.current.error).toBeNull()
  })

  it('should return null data when provider is null', async () => {
    const { result } = renderHook(() =>
      useContractRead({
        address: TEST_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: BALANCE_OF_ARGS,
        provider: null,
      })
    )

    await flushPromises()

    expect(result.current.data).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should not fetch when enabled is false', async () => {
    const requestSpy = vi.fn().mockResolvedValue('0x')
    const provider = createMockProvider({ eth_call: requestSpy })

    const { result } = renderHook(() =>
      useContractRead({
        address: TEST_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: BALANCE_OF_ARGS,
        provider: provider as unknown,
        enabled: false,
      })
    )

    await flushPromises()

    expect(result.current.data).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle RPC errors gracefully', async () => {
    const provider = createMockProvider({
      eth_call: () => {
        throw new Error('RPC call failed')
      },
    })

    const { result } = renderHook(() =>
      useContractRead({
        address: TEST_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: BALANCE_OF_ARGS,
        provider: provider as unknown,
      })
    )

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error!.message).toBe('RPC call failed')
    expect(result.current.data).toBeNull()
  })

  it('should refetch data when refetch is called', async () => {
    let callCount = 0
    const provider = createMockProvider({
      eth_call: () => {
        callCount++
        return encodeMockResult(erc20Abi, 'balanceOf', BigInt(callCount * 1000))
      },
    })

    const { result } = renderHook(() =>
      useContractRead({
        address: TEST_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: BALANCE_OF_ARGS,
        provider: provider as unknown,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBe(BigInt(1000))

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.data).toBe(BigInt(2000))
  })

  it('should read a string return value (name)', async () => {
    const mockResult = encodeMockResult(erc20Abi, 'name', 'USD Coin')
    const provider = createMockProvider({ eth_call: mockResult })

    const { result } = renderHook(() =>
      useContractRead({
        address: TEST_ADDRESS,
        abi: erc20Abi,
        functionName: 'name',
        provider: provider as unknown,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBe('USD Coin')
  })

  it('should read a uint8 return value (decimals)', async () => {
    const mockResult = encodeMockResult(erc20Abi, 'decimals', 6)
    const provider = createMockProvider({ eth_call: mockResult })

    const { result } = renderHook(() =>
      useContractRead({
        address: TEST_ADDRESS,
        abi: erc20Abi,
        functionName: 'decimals',
        provider: provider as unknown,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBe(6)
  })
})

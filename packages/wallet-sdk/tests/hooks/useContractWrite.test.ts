/**
 * useContractWrite Tests
 *
 * Tests for the smart contract write hook (transaction encoding/sending).
 */

import { act, renderHook } from '@testing-library/react'
import type { Abi, Address, Hash } from 'viem'
import { useContractWrite } from '../../src/hooks/useContractWrite'
import { createMockProvider } from '../setup'

const TEST_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address
const TEST_RECIPIENT = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address
const MOCK_TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash

const erc20Abi: Abi = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

function withAccount(
  provider: ReturnType<typeof createMockProvider>,
  account = '0x1234567890abcdef1234567890abcdef12345678'
) {
  ;(provider as any).account = account
  return provider
}

describe('useContractWrite', () => {
  it('should initialize with idle state', () => {
    const provider = createMockProvider()

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: provider as any,
      })
    )

    expect(result.current.txHash).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.write).toBe('function')
    expect(typeof result.current.reset).toBe('function')
  })

  it('should send transaction and return hash', async () => {
    const provider = withAccount(createMockProvider())

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: provider as any,
      })
    )

    let hash: Hash | undefined
    await act(async () => {
      hash = await result.current.write([TEST_RECIPIENT, BigInt(1000000)])
    })

    expect(hash).toBe(MOCK_TX_HASH)
    expect(result.current.txHash).toBe(MOCK_TX_HASH)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should throw if provider is null', async () => {
    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: null,
      })
    )

    let thrownError: Error | undefined
    await act(async () => {
      try {
        await result.current.write([TEST_RECIPIENT, BigInt(1000000)])
      } catch (err) {
        thrownError = err as Error
      }
    })

    expect(thrownError).toBeDefined()
    expect(thrownError!.message).toBe('Provider not available')
  })

  it('should throw if no account connected', async () => {
    const provider = createMockProvider()
    // Explicitly ensure no account
    ;(provider as any).account = undefined

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: provider as any,
      })
    )

    let thrownError: Error | undefined
    await act(async () => {
      try {
        await result.current.write([TEST_RECIPIENT, BigInt(1000000)])
      } catch (err) {
        thrownError = err as Error
      }
    })

    expect(thrownError).toBeDefined()
    expect(thrownError!.message).toBe('No account connected')
  })

  it('should handle transaction failure and set error state', async () => {
    const provider = withAccount(
      createMockProvider({
        eth_sendTransaction: () => {
          throw new Error('User rejected')
        },
        eth_estimateGas: '0x5208',
      })
    )

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: provider as any,
      })
    )

    await act(async () => {
      try {
        await result.current.write([TEST_RECIPIENT, BigInt(1000000)])
      } catch {
        // Expected to throw
      }
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.error!.message).toBe('User rejected')
    expect(result.current.txHash).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should reset state', async () => {
    const provider = withAccount(createMockProvider())

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: provider as any,
      })
    )

    await act(async () => {
      await result.current.write([TEST_RECIPIENT, BigInt(1000000)])
    })

    expect(result.current.txHash).toBe(MOCK_TX_HASH)

    act(() => {
      result.current.reset()
    })

    expect(result.current.txHash).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should include value in transaction when specified', async () => {
    let sentTx: Record<string, unknown> | undefined
    const provider = withAccount(
      createMockProvider({
        eth_sendTransaction: (params: unknown) => {
          sentTx = (params as unknown[])[0] as Record<string, unknown>
          return MOCK_TX_HASH
        },
        eth_estimateGas: '0x5208',
      })
    )

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: provider as any,
        value: BigInt('1000000000000000000'), // 1 ETH
      })
    )

    await act(async () => {
      await result.current.write([TEST_RECIPIENT, BigInt(1000000)])
    })

    expect(sentTx).toBeDefined()
    expect(sentTx!.value).toBe('0xde0b6b3a7640000')
  })

  it('should apply gas overrides when provided', async () => {
    let sentTx: Record<string, unknown> | undefined
    const provider = withAccount(
      createMockProvider({
        eth_sendTransaction: (params: unknown) => {
          sentTx = (params as unknown[])[0] as Record<string, unknown>
          return MOCK_TX_HASH
        },
      })
    )

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: provider as any,
        gas: BigInt(100000),
        maxFeePerGas: BigInt(30000000000),
        maxPriorityFeePerGas: BigInt(2000000000),
      })
    )

    await act(async () => {
      await result.current.write([TEST_RECIPIENT, BigInt(1000000)])
    })

    expect(sentTx).toBeDefined()
    expect(sentTx!.gas).toBe(`0x${BigInt(100000).toString(16)}`)
    expect(sentTx!.maxFeePerGas).toBe(`0x${BigInt(30000000000).toString(16)}`)
    expect(sentTx!.maxPriorityFeePerGas).toBe(`0x${BigInt(2000000000).toString(16)}`)
  })

  it('should estimate gas with 20% buffer when no gas override', async () => {
    let sentTx: Record<string, unknown> | undefined
    const estimatedGas = '0x10000' // 65536
    const provider = withAccount(
      createMockProvider({
        eth_estimateGas: estimatedGas,
        eth_sendTransaction: (params: unknown) => {
          sentTx = (params as unknown[])[0] as Record<string, unknown>
          return MOCK_TX_HASH
        },
      })
    )

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: provider as any,
      })
    )

    await act(async () => {
      await result.current.write([TEST_RECIPIENT, BigInt(1000000)])
    })

    // 65536 * 120 / 100 = 78643
    const expectedGas = (BigInt(0x10000) * 120n) / 100n
    expect(sentTx!.gas).toBe(`0x${expectedGas.toString(16)}`)
  })

  it('should continue even if gas estimation fails', async () => {
    const provider = withAccount(
      createMockProvider({
        eth_estimateGas: () => {
          throw new Error('Estimation failed')
        },
        eth_sendTransaction: MOCK_TX_HASH,
      })
    )

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: provider as any,
      })
    )

    let hash: Hash | undefined
    await act(async () => {
      hash = await result.current.write([TEST_RECIPIENT, BigInt(1000000)])
    })

    expect(hash).toBe(MOCK_TX_HASH)
    expect(result.current.txHash).toBe(MOCK_TX_HASH)
  })

  it('should wrap non-Error throws', async () => {
    const provider = withAccount(
      createMockProvider({
        eth_sendTransaction: () => {
          throw 'string error'
        },
        eth_estimateGas: '0x5208',
      })
    )

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: provider as any,
      })
    )

    let thrownError: Error | undefined
    await act(async () => {
      try {
        await result.current.write([TEST_RECIPIENT, BigInt(1000000)])
      } catch (err) {
        thrownError = err as Error
      }
    })

    expect(thrownError).toBeDefined()
    expect(thrownError!.message).toBe('Failed to write contract')
    expect(result.current.error!.message).toBe('Failed to write contract')
  })
})

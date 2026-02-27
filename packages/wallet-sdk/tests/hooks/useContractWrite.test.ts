/**
 * useContractWrite Tests
 *
 * Tests for the smart contract write hook (transaction encoding/sending).
 */

import { act, renderHook } from '@testing-library/react'
import type { Abi, Address, Hash } from 'viem'
import { useContractWrite } from '../../src/hooks/useContractWrite'
import { StableNetProvider } from '../../src/provider/StableNetProvider'
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

function createProvider(overrides?: Partial<Record<string, unknown>>) {
  const mock = createMockProvider(overrides)
  const prov = new StableNetProvider(mock)
  return { mock, prov }
}

function withAccount(
  prov: StableNetProvider,
  account = '0x1234567890abcdef1234567890abcdef12345678'
) {
  // Set internal account for testing (private field access via cast)
  ;(prov as unknown as Record<string, unknown>)._account = account
  return prov
}

describe('useContractWrite', () => {
  it('should initialize with idle state', () => {
    const { prov } = createProvider()

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: prov,
      })
    )

    expect(result.current.txHash).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.write).toBe('function')
    expect(typeof result.current.reset).toBe('function')
  })

  it('should send transaction and return hash', async () => {
    const { prov } = createProvider()
    withAccount(prov)

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: prov,
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
    const { prov } = createProvider()
    // Do NOT set account — _account stays null

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: prov,
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
    const { prov } = createProvider({
      eth_sendTransaction: () => {
        throw new Error('User rejected')
      },
      eth_estimateGas: '0x5208',
    })
    withAccount(prov)

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: prov,
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
    const { prov } = createProvider()
    withAccount(prov)

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: prov,
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
    const { prov } = createProvider({
      eth_sendTransaction: (params: unknown) => {
        sentTx = (params as unknown[])[0] as Record<string, unknown>
        return MOCK_TX_HASH
      },
      eth_estimateGas: '0x5208',
    })
    withAccount(prov)

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: prov,
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
    const { prov } = createProvider({
      eth_sendTransaction: (params: unknown) => {
        sentTx = (params as unknown[])[0] as Record<string, unknown>
        return MOCK_TX_HASH
      },
    })
    withAccount(prov)

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: prov,
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

  it('should send without gas field when no gas override', async () => {
    let sentTx: Record<string, unknown> | undefined
    const { prov } = createProvider({
      eth_sendTransaction: (params: unknown) => {
        sentTx = (params as unknown[])[0] as Record<string, unknown>
        return MOCK_TX_HASH
      },
    })
    withAccount(prov)

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: prov,
      })
    )

    await act(async () => {
      await result.current.write([TEST_RECIPIENT, BigInt(1000000)])
    })

    // Gas field is undefined when not explicitly provided
    expect(sentTx).toBeDefined()
    expect(sentTx!.gas).toBeUndefined()
  })

  it('should succeed without gas estimation', async () => {
    const { prov } = createProvider({
      eth_sendTransaction: MOCK_TX_HASH,
    })
    withAccount(prov)

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: prov,
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
    const { prov } = createProvider({
      eth_sendTransaction: () => {
        throw 'string error'
      },
      eth_estimateGas: '0x5208',
    })
    withAccount(prov)

    const { result } = renderHook(() =>
      useContractWrite({
        address: TEST_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        provider: prov,
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

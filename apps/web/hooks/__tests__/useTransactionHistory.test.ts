'use client'

import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Address, Hex } from 'viem'
import { useTransactionHistory } from '../useTransactionHistory'

// Mock the StableNetProvider context
vi.mock('@/providers/StableNetProvider', () => ({
  useStableNetContext: () => ({
    chainId: 8283,
    indexerUrl: 'http://localhost:4000',
    publicClient: {},
  }),
}))

/**
 * Helper to build a mock fetch that returns different responses
 * for GraphQL (/graphql) and RPC (/rpc) endpoints.
 *
 * getAllERC20Transfers calls getERC20Transfers twice (sent + received).
 * To avoid duplicates, rpcSentData returns data for the first RPC call
 * (isFrom=true), and rpcReceivedData for the second (isFrom=false).
 */
function mockFetchWith(
  graphqlData: unknown,
  rpcSentData: unknown[] = [],
  rpcReceivedData: unknown[] = []
) {
  let rpcCallIndex = 0
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('/graphql')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(graphqlData),
      })
    }
    if (url.includes('/rpc')) {
      // First call = sent (isFrom=true), second call = received (isFrom=false)
      const data = rpcCallIndex === 0 ? rpcSentData : rpcReceivedData
      rpcCallIndex++
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', result: data, id: 1 }),
      })
    }
    return Promise.resolve({ ok: false, status: 404 })
  })
}

describe('useTransactionHistory — IndexerClient path', () => {
  const originalFetch = global.fetch
  const testAddress = '0x1234567890123456789012345678901234567890' as Address

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('should map native transactions correctly', async () => {
    const graphqlResponse = {
      data: {
        transactionsByAddress: {
          nodes: [
            {
              hash: '0xabc1230000000000000000000000000000000000000000000000000000000001',
              from: '0x1234567890123456789012345678901234567890',
              to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              value: '1000000000000000000', // 1 native token
              gasPrice: '20000000000',
              gasUsed: '21000',
              blockNumber: 100,
              timestamp: 1705881600,
              status: 1,
            },
          ],
          pageInfo: { hasNextPage: false },
        },
      },
    }

    global.fetch = mockFetchWith(graphqlResponse)

    const { result } = renderHook(() =>
      useTransactionHistory({ address: testAddress })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.transactions).toHaveLength(1)
    expect(result.current.error).toBeNull()

    const tx = result.current.transactions[0]
    expect(tx.hash).toBe('0xabc1230000000000000000000000000000000000000000000000000000000001')
    expect(tx.value).toBe(BigInt('1000000000000000000'))
    expect(tx.chainId).toBe(8283)
    expect(tx.status).toBe('confirmed')
    expect(tx.tokenTransfer).toBeUndefined()
  })

  it('should enrich native tx with ERC-20 transfer when txHash matches', async () => {
    const sharedHash = '0xaaa0000000000000000000000000000000000000000000000000000000000001'
    const tokenContract = '0xTokenContract000000000000000000000000000001'

    const graphqlResponse = {
      data: {
        transactionsByAddress: {
          nodes: [
            {
              hash: sharedHash,
              from: testAddress,
              to: tokenContract,
              value: '0', // native value is 0 for ERC-20 transfer
              gasPrice: '20000000000',
              gasUsed: '65000',
              blockNumber: 100,
              timestamp: 1705881600,
              status: 1,
            },
          ],
          pageInfo: { hasNextPage: false },
        },
      },
    }

    // ERC-20 sent transfer (isFrom=true)
    const sentTransfers = [
      {
        contractAddress: tokenContract,
        from: testAddress,
        to: '0x9999999999999999999999999999999999999999',
        value: '5000000', // 5 USDC (6 decimals)
        transactionHash: sharedHash,
        blockNumber: 100,
        logIndex: 0,
        timestamp: 1705881600,
      },
    ]

    global.fetch = mockFetchWith(graphqlResponse, sentTransfers)

    const { result } = renderHook(() =>
      useTransactionHistory({ address: testAddress })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Should be 1 transaction (merged, not duplicated)
    expect(result.current.transactions).toHaveLength(1)

    const tx = result.current.transactions[0]
    expect(tx.hash).toBe(sharedHash)
    expect(tx.value).toBe(0n) // native value is 0
    expect(tx.tokenTransfer).toBeDefined()
    expect(tx.tokenTransfer!.contractAddress).toBe(tokenContract)
    expect(tx.tokenTransfer!.value).toBe(BigInt('5000000'))
  })

  it('should add standalone ERC-20 transfers not in native txs', async () => {
    const graphqlResponse = {
      data: {
        transactionsByAddress: {
          nodes: [],
          pageInfo: { hasNextPage: false },
        },
      },
    }

    const erc20OnlyHash = '0xerc20only00000000000000000000000000000000000000000000000000000001'
    const sentTransfers = [
      {
        contractAddress: '0xUSDC00000000000000000000000000000000000001',
        from: testAddress,
        to: '0x8888888888888888888888888888888888888888',
        value: '1000000',
        transactionHash: erc20OnlyHash,
        blockNumber: 200,
        logIndex: 0,
        timestamp: 1705882000,
      },
    ]

    global.fetch = mockFetchWith(graphqlResponse, sentTransfers)

    const { result } = renderHook(() =>
      useTransactionHistory({ address: testAddress })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.transactions).toHaveLength(1)

    const tx = result.current.transactions[0]
    expect(tx.hash).toBe(erc20OnlyHash)
    expect(tx.value).toBe(0n)
    expect(tx.tokenTransfer).toBeDefined()
    expect(tx.tokenTransfer!.value).toBe(BigInt('1000000'))
    expect(tx.status).toBe('confirmed')
  })

  it('should sort merged transactions by timestamp descending', async () => {
    const graphqlResponse = {
      data: {
        transactionsByAddress: {
          nodes: [
            {
              hash: '0x0000000000000000000000000000000000000000000000000000000000000001',
              from: testAddress,
              to: '0x0000000000000000000000000000000000000002',
              value: '1000000000000000000',
              gasPrice: '20000000000',
              gasUsed: '21000',
              blockNumber: 100,
              timestamp: 1000, // oldest
              status: 1,
            },
          ],
          pageInfo: { hasNextPage: false },
        },
      },
    }

    const sentTransfers = [
      {
        contractAddress: '0xToken000000000000000000000000000000000001',
        from: testAddress,
        to: '0x0000000000000000000000000000000000000003',
        value: '500000',
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000099',
        blockNumber: 200,
        logIndex: 0,
        timestamp: 3000, // newest
      },
    ]

    global.fetch = mockFetchWith(graphqlResponse, sentTransfers)

    const { result } = renderHook(() =>
      useTransactionHistory({ address: testAddress })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.transactions).toHaveLength(2)
    // Newest first
    expect(result.current.transactions[0].timestamp).toBe(3000)
    expect(result.current.transactions[1].timestamp).toBe(1000)
  })

  it('should map failed transactions correctly', async () => {
    const graphqlResponse = {
      data: {
        transactionsByAddress: {
          nodes: [
            {
              hash: '0xfail000000000000000000000000000000000000000000000000000000000001',
              from: testAddress,
              to: '0x0000000000000000000000000000000000000001',
              value: '100000000000000000',
              gasPrice: '20000000000',
              gasUsed: '21000',
              blockNumber: 200,
              timestamp: 1705882000,
              status: 0,
            },
          ],
          pageInfo: { hasNextPage: false },
        },
      },
    }

    global.fetch = mockFetchWith(graphqlResponse)

    const { result } = renderHook(() =>
      useTransactionHistory({ address: testAddress })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.transactions).toHaveLength(1)
    expect(result.current.transactions[0].status).toBe('failed')
  })

  it('should handle GraphQL errors gracefully', async () => {
    const errorResponse = {
      data: null,
      errors: [{ message: 'address not found' }],
    }

    global.fetch = mockFetchWith(errorResponse)

    const { result } = renderHook(() =>
      useTransactionHistory({ address: testAddress })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.transactions).toHaveLength(0)
    expect(result.current.error).toBeTruthy()
  })

  it('should handle network failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    const { result } = renderHook(() =>
      useTransactionHistory({ address: testAddress })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.transactions).toHaveLength(0)
    expect(result.current.error).toBeTruthy()
  })

  it('should return empty when no address is provided', () => {
    const { result } = renderHook(() =>
      useTransactionHistory({ address: undefined })
    )

    expect(result.current.transactions).toHaveLength(0)
    expect(result.current.isLoading).toBe(false)
  })

  it('should still work when ERC-20 fetch fails (graceful degradation)', async () => {
    const graphqlResponse = {
      data: {
        transactionsByAddress: {
          nodes: [
            {
              hash: '0x0000000000000000000000000000000000000000000000000000000000000001',
              from: testAddress,
              to: '0x0000000000000000000000000000000000000002',
              value: '1000000000000000000',
              gasPrice: '20000000000',
              gasUsed: '21000',
              blockNumber: 100,
              timestamp: 1705881600,
              status: 1,
            },
          ],
          pageInfo: { hasNextPage: false },
        },
      },
    }

    // GraphQL works, RPC fails
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/graphql')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(graphqlResponse),
        })
      }
      if (url.includes('/rpc')) {
        return Promise.resolve({ ok: false, status: 500 })
      }
      return Promise.resolve({ ok: false, status: 404 })
    })

    const { result } = renderHook(() =>
      useTransactionHistory({ address: testAddress })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Native txs should still be available even if ERC-20 fetch failed
    expect(result.current.transactions).toHaveLength(1)
    expect(result.current.error).toBeNull()
    expect(result.current.transactions[0].tokenTransfer).toBeUndefined()
  })
})

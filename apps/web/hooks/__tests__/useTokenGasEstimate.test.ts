import { act, renderHook } from '@testing-library/react'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// F-05: ERC-20 token gas estimation display
// RED phase — useTokenGasEstimate does not exist yet
// ============================================================================

// Mock fetch for paymaster RPC calls
const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('@/providers', () => ({
  useStableNetContext: () => ({
    paymasterUrl: 'http://localhost:4338',
    entryPoint: '0x2ef7E4897d71647502e2Fe60F707AcD9a110660C',
    chainId: 8283,
  }),
}))

const USDC_ADDRESS = '0x7CD8d8aaba475F653772E5EfAc38512337f0D1fA' as Address

describe('F-05: useTokenGasEstimate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should estimate token cost for a UserOp', async () => {
    // Mock pm_estimateTokenPayment RPC response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: {
            tokenAddress: USDC_ADDRESS,
            tokenAmount: '2500000', // 2.5 USDC (6 decimals)
            tokenSymbol: 'USDC',
            tokenDecimals: 6,
            exchangeRate: '2500',
            gasCostInWei: '1000000000000000', // 0.001 ETH
          },
        }),
    })

    const { useTokenGasEstimate } = await import('../useTokenGasEstimate')
    const { result } = renderHook(() => useTokenGasEstimate())

    await act(async () => {
      await result.current.estimateTokenCost(USDC_ADDRESS, {
        sender: '0x056DB290F8Ba3250ca64a45D16284D04Bc6f5FBf',
        callGasLimit: '0x10000',
        verificationGasLimit: '0x10000',
        preVerificationGas: '0x5208',
      })
    })

    expect(result.current.estimate).toBeDefined()
    expect(result.current.estimate?.tokenAmount).toBe('2500000')
    expect(result.current.estimate?.tokenSymbol).toBe('USDC')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should handle RPC error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'Token not supported' },
        }),
    })

    const { useTokenGasEstimate } = await import('../useTokenGasEstimate')
    const { result } = renderHook(() => useTokenGasEstimate())

    await act(async () => {
      await result.current.estimateTokenCost(USDC_ADDRESS, {
        sender: '0x056DB290F8Ba3250ca64a45D16284D04Bc6f5FBf',
      })
    })

    expect(result.current.estimate).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it('should format token amount with decimals', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: {
            tokenAddress: USDC_ADDRESS,
            tokenAmount: '2500000',
            tokenSymbol: 'USDC',
            tokenDecimals: 6,
            exchangeRate: '2500',
            gasCostInWei: '1000000000000000',
          },
        }),
    })

    const { useTokenGasEstimate } = await import('../useTokenGasEstimate')
    const { result } = renderHook(() => useTokenGasEstimate())

    await act(async () => {
      await result.current.estimateTokenCost(USDC_ADDRESS, {
        sender: '0x056DB290F8Ba3250ca64a45D16284D04Bc6f5FBf',
      })
    })

    // 2500000 / 10^6 = 2.5 USDC
    expect(result.current.formattedTokenCost).toBe('2.5')
  })
})

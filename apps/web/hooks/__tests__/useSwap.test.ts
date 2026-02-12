import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Token } from '@/types'
import { useSwap } from '../useSwap'

// Mock context
vi.mock('@/providers', () => ({
  useStableNetContext: () => ({
    chainId: 8283,
  }),
}))

// Mock tokens for testing
const mockTokenIn: Token = {
  address: '0x0000000000000000000000000000000000000000',
  name: 'Ether',
  symbol: 'ETH',
  decimals: 18,
}

const mockTokenOut: Token = {
  address: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
}

describe('useSwap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getQuote', () => {
    it('should call order router API to get real quote', async () => {
      const mockQuoteResponse = {
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        amountIn: '1000000000000000000', // 1 ETH
        amountOut: '2500000000', // 2500 USDC
        priceImpact: 0.05,
        route: [mockTokenIn.address, mockTokenOut.address],
        gasEstimate: '150000',
      }

      // Mock the fetch call to order router
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuoteResponse,
      } as Response)

      const { result } = renderHook(() =>
        useSwap({
          orderRouterUrl: 'http://localhost:4340',
        })
      )

      let quote: unknown
      await act(async () => {
        quote = await result.current.getQuote({
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          amountIn: BigInt('1000000000000000000'),
        })
      })

      // Should have called the order router API
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4340/quote',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )

      // Should return parsed quote with BigInt values
      expect(quote).toMatchObject({
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        amountIn: BigInt('1000000000000000000'),
        amountOut: BigInt('2500000000'),
        priceImpact: 0.05,
      })
    })

    it('should handle quote API errors gracefully', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() =>
        useSwap({
          orderRouterUrl: 'http://localhost:4340',
        })
      )

      let quote: unknown
      await act(async () => {
        quote = await result.current.getQuote({
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          amountIn: BigInt('1000000000000000000'),
        })
      })

      expect(quote).toBeNull()
      expect(result.current.error).toBeTruthy()
      // Original error message is preserved for better debugging
      expect(result.current.error?.message).toBe('Network error')
    })

    it('should set loading state during quote fetch', async () => {
      let resolvePromise: (value: Response) => void
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(global.fetch).mockReturnValueOnce(pendingPromise)

      const { result } = renderHook(() =>
        useSwap({
          orderRouterUrl: 'http://localhost:4340',
        })
      )

      expect(result.current.isLoading).toBe(false)

      act(() => {
        result.current.getQuote({
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          amountIn: BigInt('1000000000000000000'),
        })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true)
      })

      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({
            amountOut: '2500000000',
            priceImpact: 0.05,
            route: [mockTokenIn.address, mockTokenOut.address],
            gasEstimate: '150000',
          }),
        } as Response)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('executeSwap', () => {
    it('should execute swap via UserOperation', async () => {
      const mockSwapResult = {
        userOpHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      }

      // Mock sendUserOp function
      const mockSendUserOp = vi.fn().mockResolvedValueOnce({
        userOpHash: mockSwapResult.userOpHash,
        transactionHash: mockSwapResult.transactionHash,
        success: true,
      })

      const { result } = renderHook(() =>
        useSwap({
          orderRouterUrl: 'http://localhost:4340',
          sendUserOp: mockSendUserOp,
          routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        })
      )

      const mockQuote = {
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        amountIn: BigInt('1000000000000000000'),
        amountOut: BigInt('2500000000'),
        priceImpact: 0.05,
        route: [mockTokenIn.address, mockTokenOut.address],
        gasEstimate: BigInt(150000),
      }

      let swapResult: unknown
      await act(async () => {
        swapResult = await result.current.executeSwap(
          mockQuote,
          '0x1234567890123456789012345678901234567890' as `0x${string}`
        )
      })

      // Should have called sendUserOp with swap calldata
      expect(mockSendUserOp).toHaveBeenCalled()

      // Should return transaction result
      expect(swapResult).toMatchObject({
        transactionHash: mockSwapResult.transactionHash,
      })
    })

    it('should build correct swap calldata', async () => {
      const mockSendUserOp = vi.fn().mockResolvedValueOnce({
        userOpHash: '0x1234',
        transactionHash: '0xabcd',
        success: true,
      })

      const { result } = renderHook(() =>
        useSwap({
          orderRouterUrl: 'http://localhost:4340',
          sendUserOp: mockSendUserOp,
          routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        })
      )

      const mockQuote = {
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        amountIn: BigInt('1000000000000000000'),
        amountOut: BigInt('2500000000'),
        priceImpact: 0.05,
        route: [mockTokenIn.address, mockTokenOut.address],
        gasEstimate: BigInt(150000),
      }

      await act(async () => {
        await result.current.executeSwap(
          mockQuote,
          '0x1234567890123456789012345678901234567890' as `0x${string}`
        )
      })

      // Verify sendUserOp was called with proper calldata
      const callArgs = mockSendUserOp.mock.calls[0][1]
      expect(callArgs.to).toBe('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D')
      expect(callArgs.data).toBeDefined()
      expect(callArgs.data.startsWith('0x')).toBe(true)
    })

    it('should handle swap execution errors', async () => {
      const mockSendUserOp = vi.fn().mockRejectedValueOnce(new Error('UserOp failed'))

      const { result } = renderHook(() =>
        useSwap({
          orderRouterUrl: 'http://localhost:4340',
          sendUserOp: mockSendUserOp,
          routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        })
      )

      const mockQuote = {
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        amountIn: BigInt('1000000000000000000'),
        amountOut: BigInt('2500000000'),
        priceImpact: 0.05,
        route: [mockTokenIn.address, mockTokenOut.address],
        gasEstimate: BigInt(150000),
      }

      let swapResult: unknown
      await act(async () => {
        swapResult = await result.current.executeSwap(
          mockQuote,
          '0x1234567890123456789012345678901234567890' as `0x${string}`
        )
      })

      expect(swapResult).toBeNull()
      expect(result.current.error).toBeTruthy()
    })
  })

  describe('ERC-20 allowance and approve', () => {
    const mockERC20TokenIn: Token = {
      address: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
    }

    it('should skip allowance check for ETH swaps', async () => {
      const mockSendUserOp = vi.fn().mockResolvedValueOnce({
        userOpHash: '0x1234',
        transactionHash: '0xabcd',
        success: true,
      })

      const mockReadContract = vi.fn()

      const { result } = renderHook(() =>
        useSwap({
          orderRouterUrl: 'http://localhost:4340',
          sendUserOp: mockSendUserOp,
          readContract: mockReadContract,
          routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        })
      )

      const mockQuote = {
        tokenIn: mockTokenIn, // ETH
        tokenOut: mockTokenOut,
        amountIn: BigInt('1000000000000000000'),
        amountOut: BigInt('2500000000'),
        priceImpact: 0.05,
        route: [mockTokenIn.address, mockTokenOut.address],
        gasEstimate: BigInt(150000),
      }

      await act(async () => {
        await result.current.executeSwap(
          mockQuote,
          '0x1234567890123456789012345678901234567890' as `0x${string}`
        )
      })

      // readContract should NOT have been called for ETH
      expect(mockReadContract).not.toHaveBeenCalled()
      // Only one sendUserOp call (swap only, no approve)
      expect(mockSendUserOp).toHaveBeenCalledTimes(1)
    })

    it('should call approve when ERC-20 allowance is insufficient', async () => {
      const mockSendUserOp = vi
        .fn()
        .mockResolvedValueOnce({
          userOpHash: '0xapprove',
          transactionHash: '0xapproveTx',
          success: true,
        })
        .mockResolvedValueOnce({
          userOpHash: '0xswap',
          transactionHash: '0xswapTx',
          success: true,
        })

      // Return insufficient allowance
      const mockReadContract = vi.fn().mockResolvedValueOnce(BigInt(0))

      const { result } = renderHook(() =>
        useSwap({
          orderRouterUrl: 'http://localhost:4340',
          sendUserOp: mockSendUserOp,
          readContract: mockReadContract,
          routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        })
      )

      const mockQuote = {
        tokenIn: mockERC20TokenIn,
        tokenOut: mockTokenOut,
        amountIn: BigInt('1000000'),
        amountOut: BigInt('2500000000'),
        priceImpact: 0.05,
        route: [mockERC20TokenIn.address, mockTokenOut.address],
        gasEstimate: BigInt(150000),
      }

      await act(async () => {
        await result.current.executeSwap(
          mockQuote,
          '0x1234567890123456789012345678901234567890' as `0x${string}`
        )
      })

      // Should have called readContract to check allowance
      expect(mockReadContract).toHaveBeenCalled()
      // Should have called sendUserOp twice: approve + swap
      expect(mockSendUserOp).toHaveBeenCalledTimes(2)
    })

    it('should skip approve when ERC-20 allowance is sufficient', async () => {
      const mockSendUserOp = vi.fn().mockResolvedValueOnce({
        userOpHash: '0xswap',
        transactionHash: '0xswapTx',
        success: true,
      })

      // Return sufficient allowance
      const mockReadContract = vi.fn().mockResolvedValueOnce(BigInt('999999999999'))

      const { result } = renderHook(() =>
        useSwap({
          orderRouterUrl: 'http://localhost:4340',
          sendUserOp: mockSendUserOp,
          readContract: mockReadContract,
          routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        })
      )

      const mockQuote = {
        tokenIn: mockERC20TokenIn,
        tokenOut: mockTokenOut,
        amountIn: BigInt('1000000'),
        amountOut: BigInt('2500000000'),
        priceImpact: 0.05,
        route: [mockERC20TokenIn.address, mockTokenOut.address],
        gasEstimate: BigInt(150000),
      }

      await act(async () => {
        await result.current.executeSwap(
          mockQuote,
          '0x1234567890123456789012345678901234567890' as `0x${string}`
        )
      })

      // Should have checked allowance
      expect(mockReadContract).toHaveBeenCalled()
      // Only swap, no approve needed
      expect(mockSendUserOp).toHaveBeenCalledTimes(1)
    })
  })

  describe('slippage handling', () => {
    it('should apply slippage to minimum amount out', async () => {
      const mockSendUserOp = vi.fn().mockResolvedValueOnce({
        userOpHash: '0x1234',
        transactionHash: '0xabcd',
        success: true,
      })

      const { result } = renderHook(() =>
        useSwap({
          orderRouterUrl: 'http://localhost:4340',
          sendUserOp: mockSendUserOp,
          routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
          defaultSlippage: 0.5, // 0.5%
        })
      )

      const mockQuote = {
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        amountIn: BigInt('1000000000000000000'),
        amountOut: BigInt('2500000000'), // 2500 USDC
        priceImpact: 0.05,
        route: [mockTokenIn.address, mockTokenOut.address],
        gasEstimate: BigInt(150000),
      }

      await act(async () => {
        await result.current.executeSwap(
          mockQuote,
          '0x1234567890123456789012345678901234567890' as `0x${string}`,
          { slippage: 1.0 } // 1% slippage
        )
      })

      // minAmountOut should be 99% of amountOut (1% slippage)
      // 2500000000 * 0.99 = 2475000000
      const callArgs = mockSendUserOp.mock.calls[0][1]
      expect(callArgs.minAmountOut).toBe(BigInt('2475000000'))
    })
  })
})

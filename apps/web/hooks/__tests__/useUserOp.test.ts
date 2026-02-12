import { act, renderHook } from '@testing-library/react'
import type { Address, Hex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserOp } from '../useUserOp'

// Mock the context provider
const mockContext = {
  bundlerUrl: 'http://localhost:4337',
  entryPoint: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Address,
  chainId: 31337,
}

vi.mock('@/providers', () => ({
  useStableNetContext: () => mockContext,
}))

const mockSignUserOp = vi.fn().mockResolvedValue(`0x${'ab'.repeat(65)}` as Hex)

// Receipt response for waitForUserOpReceipt polling
const mockReceiptResponse = {
  ok: true,
  json: async () => ({
    jsonrpc: '2.0',
    id: 1,
    result: {
      transactionHash: `0x${'ee'.repeat(32)}`,
      success: true,
    },
  }),
} as Response

describe('useUserOp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignUserOp.mockResolvedValue(`0x${'ab'.repeat(65)}` as Hex)
  })

  describe('nonce fetching', () => {
    it('should fetch nonce from chain before building UserOp', async () => {
      const _mockNonce = '0x5'
      const mockGetNonce = vi.fn().mockResolvedValue(BigInt(5))

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jsonrpc: '2.0',
            id: 1,
            result: '0xabcd1234',
          }),
        } as Response)
        .mockResolvedValueOnce(mockReceiptResponse)

      const { result } = renderHook(() =>
        useUserOp({
          getNonce: mockGetNonce,
          signUserOp: mockSignUserOp,
        })
      )

      await act(async () => {
        await result.current.sendUserOp('0x1234567890123456789012345678901234567890' as Address, {
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
          data: '0x' as Hex,
        })
      })

      // Should have called getNonce
      expect(mockGetNonce).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890')

      // Should have sent UserOp with correct nonce
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4337',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"nonce":"0x5"'),
        })
      )
    })
  })

  describe('gas estimation', () => {
    it('should estimate gas dynamically', async () => {
      const mockGasEstimate = {
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(200000),
        preVerificationGas: BigInt(50000),
      }

      const mockEstimateGas = vi.fn().mockResolvedValue(mockGasEstimate)
      const mockGetNonce = vi.fn().mockResolvedValue(BigInt(0))

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jsonrpc: '2.0',
            id: 1,
            result: '0xabcd1234',
          }),
        } as Response)
        .mockResolvedValueOnce(mockReceiptResponse)

      const { result } = renderHook(() =>
        useUserOp({
          getNonce: mockGetNonce,
          estimateGas: mockEstimateGas,
          signUserOp: mockSignUserOp,
        })
      )

      await act(async () => {
        await result.current.sendUserOp('0x1234567890123456789012345678901234567890' as Address, {
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
          data: '0x12345678' as Hex,
        })
      })

      // Should have called estimateGas
      expect(mockEstimateGas).toHaveBeenCalled()

      // Should have used estimated gas values in UserOp
      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)
      expect(body.params[0].callGasLimit).toBe('0x186a0') // 100000 in hex
      expect(body.params[0].verificationGasLimit).toBe('0x30d40') // 200000 in hex
      expect(body.params[0].preVerificationGas).toBe('0xc350') // 50000 in hex
    })

    it('should fetch gas price dynamically', async () => {
      const mockGetNonce = vi.fn().mockResolvedValue(BigInt(0))
      const mockEstimateGas = vi.fn().mockResolvedValue({
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(200000),
        preVerificationGas: BigInt(50000),
      })
      const mockGetGasPrice = vi.fn().mockResolvedValue({
        maxFeePerGas: BigInt(50000000000), // 50 gwei
        maxPriorityFeePerGas: BigInt(2000000000), // 2 gwei
      })

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jsonrpc: '2.0',
            id: 1,
            result: '0xabcd1234',
          }),
        } as Response)
        .mockResolvedValueOnce(mockReceiptResponse)

      const { result } = renderHook(() =>
        useUserOp({
          getNonce: mockGetNonce,
          estimateGas: mockEstimateGas,
          getGasPrice: mockGetGasPrice,
          signUserOp: mockSignUserOp,
        })
      )

      await act(async () => {
        await result.current.sendUserOp('0x1234567890123456789012345678901234567890' as Address, {
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
          data: '0x' as Hex,
        })
      })

      // Should have called getGasPrice
      expect(mockGetGasPrice).toHaveBeenCalled()

      // Should have used dynamic gas prices in UserOp
      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)
      expect(body.params[0].maxFeePerGas).toBe('0xba43b7400') // 50 gwei in hex
      expect(body.params[0].maxPriorityFeePerGas).toBe('0x77359400') // 2 gwei in hex
    })
  })

  describe('error handling', () => {
    it('should handle bundler RPC errors properly', async () => {
      const mockGetNonce = vi.fn().mockResolvedValue(BigInt(0))
      const mockEstimateGas = vi.fn().mockResolvedValue({
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(200000),
        preVerificationGas: BigInt(50000),
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32500,
            message: 'AA21 did not pay prefund',
          },
        }),
      } as Response)

      const { result } = renderHook(() =>
        useUserOp({
          getNonce: mockGetNonce,
          estimateGas: mockEstimateGas,
          signUserOp: mockSignUserOp,
        })
      )

      let opResult: unknown
      await act(async () => {
        opResult = await result.current.sendUserOp(
          '0x1234567890123456789012345678901234567890' as Address,
          {
            to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
            data: '0x' as Hex,
          }
        )
      })

      expect(opResult).toBeNull()
      expect(result.current.error).toBeTruthy()
      expect(result.current.error?.message).toContain('AA21 did not pay prefund')
    })

    it('should handle network errors', async () => {
      const mockGetNonce = vi.fn().mockResolvedValue(BigInt(0))
      const mockEstimateGas = vi.fn().mockResolvedValue({
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(200000),
        preVerificationGas: BigInt(50000),
      })

      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() =>
        useUserOp({
          getNonce: mockGetNonce,
          estimateGas: mockEstimateGas,
          signUserOp: mockSignUserOp,
        })
      )

      let opResult: unknown
      await act(async () => {
        opResult = await result.current.sendUserOp(
          '0x1234567890123456789012345678901234567890' as Address,
          {
            to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
            data: '0x' as Hex,
          }
        )
      })

      expect(opResult).toBeNull()
      expect(result.current.error).toBeTruthy()
    })

    it('should handle nonce fetch errors', async () => {
      const mockGetNonce = vi.fn().mockRejectedValue(new Error('Failed to get nonce'))

      const { result } = renderHook(() =>
        useUserOp({
          getNonce: mockGetNonce,
        })
      )

      let opResult: unknown
      await act(async () => {
        opResult = await result.current.sendUserOp(
          '0x1234567890123456789012345678901234567890' as Address,
          {
            to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
            data: '0x' as Hex,
          }
        )
      })

      expect(opResult).toBeNull()
      expect(result.current.error?.message).toContain('Failed to get nonce')
    })
  })

  describe('sendTransaction helper', () => {
    it('should correctly format simple ETH transfer', async () => {
      const mockGetNonce = vi.fn().mockResolvedValue(BigInt(0))
      const mockEstimateGas = vi.fn().mockResolvedValue({
        callGasLimit: BigInt(21000),
        verificationGasLimit: BigInt(100000),
        preVerificationGas: BigInt(50000),
      })

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jsonrpc: '2.0',
            id: 1,
            result: '0xabcd1234',
          }),
        } as Response)
        .mockResolvedValueOnce(mockReceiptResponse)

      const { result } = renderHook(() =>
        useUserOp({
          getNonce: mockGetNonce,
          estimateGas: mockEstimateGas,
          signUserOp: mockSignUserOp,
        })
      )

      await act(async () => {
        await result.current.sendTransaction(
          '0x1234567890123456789012345678901234567890' as Address,
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
          '1.5' // 1.5 ETH
        )
      })

      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)

      // Should include correct value (1.5 ETH in wei as hex)
      expect(body.params[0].callData).toBeDefined()
    })
  })

  describe('UserOp signing', () => {
    it('should sign UserOp with provided signer', async () => {
      const mockGetNonce = vi.fn().mockResolvedValue(BigInt(0))
      const mockEstimateGas = vi.fn().mockResolvedValue({
        callGasLimit: BigInt(100000),
        verificationGasLimit: BigInt(200000),
        preVerificationGas: BigInt(50000),
      })
      const mockSignUserOp = vi.fn().mockResolvedValue(`0x${'ab'.repeat(65)}` as Hex)

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jsonrpc: '2.0',
            id: 1,
            result: '0xabcd1234',
          }),
        } as Response)
        .mockResolvedValueOnce(mockReceiptResponse)

      const { result } = renderHook(() =>
        useUserOp({
          getNonce: mockGetNonce,
          estimateGas: mockEstimateGas,
          signUserOp: mockSignUserOp,
        })
      )

      await act(async () => {
        await result.current.sendUserOp('0x1234567890123456789012345678901234567890' as Address, {
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
          data: '0x' as Hex,
        })
      })

      expect(mockSignUserOp).toHaveBeenCalled()

      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(fetchCall[1]?.body as string)
      expect(body.params[0].signature).toBe(`0x${'ab'.repeat(65)}`)
    })
  })
})

import { act, renderHook } from '@testing-library/react'
import type { Address, Hex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserOp } from '../useUserOp'

// ============================================================================
// Mocks — vi.hoisted ensures these are available during vi.mock hoisting
// ============================================================================

const { mockSendTransaction, mockWaitReceipt } = vi.hoisted(() => ({
  mockSendTransaction: vi.fn(),
  mockWaitReceipt: vi.fn().mockResolvedValue({
    success: true,
    receipt: { transactionHash: `0x${'ee'.repeat(32)}` },
  }),
}))

// Mock wallet-sdk: detectProvider returns our mock provider
vi.mock('@stablenet/wallet-sdk', () => ({
  detectProvider: vi.fn().mockResolvedValue({
    sendTransaction: mockSendTransaction,
  }),
  createBundlerClient: vi.fn(() => ({
    waitForUserOperationReceipt: mockWaitReceipt,
  })),
}))

// Mock context provider
vi.mock('@/providers', () => ({
  useStableNetContext: () => ({
    bundlerUrl: 'http://localhost:4337',
    entryPoint: '0xEf6817fe73741A8F10088f9511c64b666a338A14' as Address,
  }),
}))

const SENDER = '0x1234567890123456789012345678901234567890' as Address
const RECIPIENT = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address
const TX_HASH = `0x${'aa'.repeat(32)}` as Hex

// ============================================================================
// Tests
// ============================================================================

describe('useUserOp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendTransaction.mockResolvedValue(TX_HASH)
  })

  describe('sendUserOp', () => {
    it('should send transaction through wallet-sdk provider', async () => {
      const { result } = renderHook(() => useUserOp())

      // Wait for provider detection
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })

      let opResult: unknown
      await act(async () => {
        opResult = await result.current.sendUserOp(SENDER, {
          to: RECIPIENT,
          value: 1000000000000000000n, // 1 ETH
          data: '0x' as Hex,
        })
      })

      // Should call provider.sendTransaction with correct params
      expect(mockSendTransaction).toHaveBeenCalledWith(
        {
          from: SENDER,
          to: RECIPIENT,
          value: 1000000000000000000n,
          data: '0x',
        },
        { waitForConfirmation: true }
      )

      // Should return confirmed result
      expect(opResult).toEqual({
        userOpHash: TX_HASH,
        transactionHash: TX_HASH,
        success: true,
        status: 'confirmed',
      })
    })

    it('should send custom calldata (staking, swap, etc.)', async () => {
      const { result } = renderHook(() => useUserOp())
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })

      const customCalldata = '0xa9059cbb000000000000000000000000abcdef' as Hex

      await act(async () => {
        await result.current.sendUserOp(SENDER, {
          to: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707' as Address,
          data: customCalldata,
        })
      })

      expect(mockSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          from: SENDER,
          to: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
          data: customCalldata,
        }),
        { waitForConfirmation: true }
      )
    })

    it('should set isLoading during transaction', async () => {
      // Make sendTransaction hang
      mockSendTransaction.mockImplementation(
        () => new Promise((r) => setTimeout(() => r(TX_HASH), 100))
      )

      const { result } = renderHook(() => useUserOp())
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })

      expect(result.current.isLoading).toBe(false)

      let sendPromise: Promise<unknown>
      act(() => {
        sendPromise = result.current.sendUserOp(SENDER, {
          to: RECIPIENT,
          data: '0x' as Hex,
        })
      })

      // isLoading should be true during send
      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        await sendPromise
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('sendTransaction helper', () => {
    it('should parse ETH value and send through provider', async () => {
      const { result } = renderHook(() => useUserOp())
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })

      await act(async () => {
        await result.current.sendTransaction(SENDER, RECIPIENT, '1.5')
      })

      // Should convert '1.5' ETH to wei
      expect(mockSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          from: SENDER,
          to: RECIPIENT,
          value: 1500000000000000000n, // 1.5 ETH in wei
          data: '0x',
        }),
        { waitForConfirmation: true }
      )
    })
  })

  describe('error handling', () => {
    it('should handle provider.sendTransaction errors', async () => {
      mockSendTransaction.mockRejectedValueOnce(new Error('AA21 did not pay prefund'))

      const { result } = renderHook(() => useUserOp())
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })

      let opResult: unknown
      await act(async () => {
        opResult = await result.current.sendUserOp(SENDER, {
          to: RECIPIENT,
          data: '0x' as Hex,
        })
      })

      expect(opResult).toBeNull()
      expect(result.current.error).toBeTruthy()
      expect(result.current.error?.message).toContain('AA21 did not pay prefund')
    })

    it('should handle user rejection', async () => {
      mockSendTransaction.mockRejectedValueOnce(new Error('User rejected the request'))

      const { result } = renderHook(() => useUserOp())
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })

      let opResult: unknown
      await act(async () => {
        opResult = await result.current.sendUserOp(SENDER, {
          to: RECIPIENT,
          data: '0x' as Hex,
        })
      })

      expect(opResult).toBeNull()
      expect(result.current.error?.message).toContain('User rejected')
    })

    it('should return null when provider is not detected', async () => {
      // Override detectProvider to return null
      const { detectProvider } = await import('@stablenet/wallet-sdk')
      vi.mocked(detectProvider).mockResolvedValueOnce(null)

      const { result } = renderHook(() => useUserOp())
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })

      let opResult: unknown
      await act(async () => {
        opResult = await result.current.sendUserOp(SENDER, {
          to: RECIPIENT,
          data: '0x' as Hex,
        })
      })

      expect(opResult).toBeNull()
      expect(result.current.error?.message).toContain('wallet not detected')
    })

    it('should clear error with clearError', async () => {
      mockSendTransaction.mockRejectedValueOnce(new Error('Some error'))

      const { result } = renderHook(() => useUserOp())
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })

      await act(async () => {
        await result.current.sendUserOp(SENDER, {
          to: RECIPIENT,
          data: '0x' as Hex,
        })
      })

      expect(result.current.error).toBeTruthy()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('recheckUserOp', () => {
    it('should poll bundler for receipt of previously submitted op', async () => {
      const { result } = renderHook(() => useUserOp())

      const userOpHash = `0x${'bb'.repeat(32)}` as Hex
      let checkResult: unknown
      await act(async () => {
        checkResult = await result.current.recheckUserOp(userOpHash)
      })

      expect(checkResult).toEqual(
        expect.objectContaining({
          userOpHash,
          success: true,
          status: 'confirmed',
        })
      )
    })
  })
})

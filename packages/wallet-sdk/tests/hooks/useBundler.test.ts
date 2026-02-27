import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useBundler } from '../../src/hooks/useBundler'

// Mock the bundler module
vi.mock('../../src/bundler', () => ({
  createBundlerClient: vi.fn(() => ({
    sendUserOperation: vi.fn().mockResolvedValue('0xhash123'),
    estimateUserOperationGas: vi.fn().mockResolvedValue({
      callGasLimit: 100000n,
      verificationGasLimit: 150000n,
      preVerificationGas: 50000n,
    }),
    getUserOperationReceipt: vi.fn().mockResolvedValue(null),
    getUserOperationByHash: vi.fn().mockResolvedValue(null),
    getSupportedEntryPoints: vi.fn().mockResolvedValue([]),
    getChainId: vi.fn().mockResolvedValue(1n),
    waitForUserOperationReceipt: vi.fn().mockResolvedValue({
      userOpHash: '0xhash123',
      success: true,
    }),
  })),
}))

describe('useBundler', () => {
  const defaultConfig = {
    bundlerUrl: 'https://bundler.example.com',
  }

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useBundler(defaultConfig))

    expect(result.current.client).toBeDefined()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.sendUserOp).toBe('function')
    expect(typeof result.current.estimateGas).toBe('function')
    expect(typeof result.current.getReceipt).toBe('function')
    expect(typeof result.current.waitForReceipt).toBe('function')
  })

  it('should send user operation', async () => {
    const { result } = renderHook(() => useBundler(defaultConfig))

    let hash: string | undefined
    await act(async () => {
      hash = await result.current.sendUserOp({
        sender: '0x1234567890123456789012345678901234567890',
        nonce: 0n,
        callData: '0x',
        callGasLimit: 100000n,
        verificationGasLimit: 150000n,
        preVerificationGas: 50000n,
        maxFeePerGas: 1000000000n,
        maxPriorityFeePerGas: 100000000n,
        signature: '0x',
      })
    })

    expect(hash).toBe('0xhash123')
  })

  it('should estimate gas', async () => {
    const { result } = renderHook(() => useBundler(defaultConfig))

    let gas: { callGasLimit: bigint } | undefined
    await act(async () => {
      gas = await result.current.estimateGas({
        sender: '0x1234567890123456789012345678901234567890',
        callData: '0x',
      })
    })

    expect(gas?.callGasLimit).toBe(100000n)
  })

  it('should handle errors', async () => {
    const { result } = renderHook(() => useBundler(defaultConfig))

    // Override the mock to throw
    const client = result.current.client
    ;(client.sendUserOperation as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Send failed'))

    await act(async () => {
      try {
        await result.current.sendUserOp({
          sender: '0x1234567890123456789012345678901234567890',
          nonce: 0n,
          callData: '0x',
          callGasLimit: 100000n,
          verificationGasLimit: 150000n,
          preVerificationGas: 50000n,
          maxFeePerGas: 1000000000n,
          maxPriorityFeePerGas: 100000000n,
          signature: '0x',
        })
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(result.current.error?.message).toBe('Send failed')
    })
  })
})

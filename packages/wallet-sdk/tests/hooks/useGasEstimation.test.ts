import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useGasEstimation } from '../../src/hooks/useGasEstimation'

describe('useGasEstimation', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useGasEstimation({ bundlerClient: null })
    )

    expect(result.current.gasEstimate).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.estimate).toBe('function')
  })

  it('should throw when estimating without client', async () => {
    const { result } = renderHook(() =>
      useGasEstimation({ bundlerClient: null })
    )

    await act(async () => {
      await expect(
        result.current.estimate({
          sender: '0x1234567890123456789012345678901234567890',
          callData: '0x',
        })
      ).rejects.toThrow('Bundler client not configured')
    })
  })

  it('should estimate gas with bundler client', async () => {
    const mockGas = {
      callGasLimit: 100000n,
      verificationGasLimit: 150000n,
      preVerificationGas: 50000n,
    }

    const mockClient = {
      estimateUserOperationGas: vi.fn().mockResolvedValue(mockGas),
    } as unknown as Parameters<typeof useGasEstimation>[0]['bundlerClient']

    const { result } = renderHook(() =>
      useGasEstimation({ bundlerClient: mockClient })
    )

    let gas: typeof mockGas | undefined
    await act(async () => {
      gas = await result.current.estimate({
        sender: '0x1234567890123456789012345678901234567890',
        callData: '0x',
      })
    })

    expect(gas).toEqual(mockGas)
    await waitFor(() => {
      expect(result.current.gasEstimate).toEqual(mockGas)
    })
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle estimation errors', async () => {
    const mockClient = {
      estimateUserOperationGas: vi.fn().mockRejectedValue(new Error('Estimation failed')),
    } as unknown as Parameters<typeof useGasEstimation>[0]['bundlerClient']

    const { result } = renderHook(() =>
      useGasEstimation({ bundlerClient: mockClient })
    )

    await act(async () => {
      try {
        await result.current.estimate({
          sender: '0x1234567890123456789012345678901234567890',
          callData: '0x',
        })
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(result.current.error?.message).toBe('Estimation failed')
    })
  })
})

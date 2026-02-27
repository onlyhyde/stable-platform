import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNonce } from '../../src/hooks/useNonce'

// Mock the nonce module
vi.mock('../../src/nonce', () => ({
  getNonce: vi.fn().mockResolvedValue(5n),
  parseNonce: vi.fn((nonce: bigint) => ({
    key: nonce >> 64n,
    sequence: nonce & ((1n << 64n) - 1n),
  })),
}))

describe('useNonce', () => {
  const mockPublicClient = {} as Parameters<typeof useNonce>[0]['publicClient']

  it('should start with null state when no client', () => {
    const { result } = renderHook(() =>
      useNonce({ publicClient: null, sender: null })
    )

    expect(result.current.nonce).toBeNull()
    expect(result.current.key).toBeNull()
    expect(result.current.sequence).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should fetch nonce when client and sender provided', async () => {
    const { result } = renderHook(() =>
      useNonce({
        publicClient: mockPublicClient,
        sender: '0x1234567890123456789012345678901234567890',
      })
    )

    await waitFor(() => {
      expect(result.current.nonce).toBe(5n)
    })

    expect(result.current.key).toBe(0n)
    expect(result.current.sequence).toBe(5n)
  })

  it('should provide refetch function', () => {
    const { result } = renderHook(() =>
      useNonce({
        publicClient: mockPublicClient,
        sender: '0x1234567890123456789012345678901234567890',
      })
    )

    expect(typeof result.current.refetch).toBe('function')
  })
})

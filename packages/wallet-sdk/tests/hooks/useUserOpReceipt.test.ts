import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserOpReceipt } from '../../src/hooks/useUserOpReceipt'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('useUserOpReceipt', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useUserOpReceipt({ bundlerClient: null })
    )

    expect(result.current.receipt).toBeNull()
    expect(result.current.isWaiting).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.pendingOps).toEqual([])
    expect(typeof result.current.waitForReceipt).toBe('function')
    expect(typeof result.current.addPendingOp).toBe('function')
    expect(typeof result.current.removePendingOp).toBe('function')
  })

  it('should throw when waiting without bundler client', async () => {
    const { result } = renderHook(() =>
      useUserOpReceipt({ bundlerClient: null })
    )

    await act(async () => {
      await expect(
        result.current.waitForReceipt('0xhash123')
      ).rejects.toThrow('Bundler client not configured')
    })
  })

  it('should add and remove pending operations', () => {
    const { result } = renderHook(() =>
      useUserOpReceipt({ bundlerClient: null })
    )

    act(() => {
      result.current.addPendingOp('0xhash1', 'Transfer')
    })

    expect(result.current.pendingOps).toHaveLength(1)
    expect(result.current.pendingOps[0].hash).toBe('0xhash1')
    expect(result.current.pendingOps[0].description).toBe('Transfer')

    act(() => {
      result.current.addPendingOp('0xhash2', 'Swap')
    })

    expect(result.current.pendingOps).toHaveLength(2)

    act(() => {
      result.current.removePendingOp('0xhash1')
    })

    expect(result.current.pendingOps).toHaveLength(1)
    expect(result.current.pendingOps[0].hash).toBe('0xhash2')
  })

  it('should persist pending ops to localStorage', () => {
    const { result } = renderHook(() =>
      useUserOpReceipt({ bundlerClient: null, storageKey: 'test-ops' })
    )

    act(() => {
      result.current.addPendingOp('0xhash1', 'Transfer')
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'test-ops',
      expect.stringContaining('0xhash1')
    )
  })
})

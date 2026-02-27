import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePaymaster } from '../../src/hooks/usePaymaster'

// Mock the paymaster module
vi.mock('../../src/paymaster', () => ({
  createPaymasterClient: vi.fn(() => ({
    getSponsorPolicy: vi.fn().mockResolvedValue({ sponsored: true }),
    getSponsoredPaymasterData: vi.fn().mockResolvedValue({
      paymaster: '0x1234567890123456789012345678901234567890',
      paymasterData: '0xabcd',
    }),
    getSupportedTokens: vi.fn().mockResolvedValue([]),
    estimateERC20Payment: vi.fn().mockResolvedValue({ tokenAmount: 1000n }),
    getERC20PaymasterData: vi.fn().mockResolvedValue({
      paymaster: '0x1234567890123456789012345678901234567890',
      paymasterData: '0xabcd',
      tokenAmount: 1000n,
    }),
    getPaymasterData: vi.fn().mockResolvedValue({}),
    isAvailable: vi.fn().mockResolvedValue(true),
  })),
}))

describe('usePaymaster', () => {
  const defaultConfig = {
    paymasterUrl: 'https://paymaster.example.com',
    chainId: 1,
  }

  it('should initialize with default state', () => {
    const { result } = renderHook(() => usePaymaster(defaultConfig))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.getSponsorPolicy).toBe('function')
    expect(typeof result.current.getSponsoredData).toBe('function')
    expect(typeof result.current.getSupportedTokens).toBe('function')
    expect(typeof result.current.estimateERC20).toBe('function')
    expect(typeof result.current.getERC20Data).toBe('function')
  })
})

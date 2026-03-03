import { act, renderHook } from '@testing-library/react'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// F-04: EntryPoint deposit balance query
// RED phase — useEntryPointDeposit does not exist yet
// ============================================================================

// Mock wagmi's getPublicClient
const mockReadContract = vi.fn()

vi.mock('wagmi/actions', () => ({
  getPublicClient: vi.fn(() => ({
    readContract: mockReadContract,
  })),
}))

vi.mock('@/lib/wagmi', () => ({
  wagmiConfig: {},
}))

// Mock useSmartAccount for entryPoint address
vi.mock('../useSmartAccount', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../useSmartAccount')>()
  return {
    ...actual,
    getSmartAccountAddresses: vi.fn(() => ({
      entryPoint: '0x2ef7E4897d71647502e2Fe60F707AcD9a110660C',
      kernel: '0x92458C9920376Ddd0152dbA56888ac60547408E6',
      kernelFactory: '0xA18C1d76de513FEa27127E2508de43AdC0820a72',
      ecdsaValidator: '0xFaf73bf2E642ADD50cf9d9853C44553ECCdFC670',
    })),
  }
})

vi.mock('wagmi', () => ({
  useChainId: () => 8283,
}))

const SENDER = '0x056DB290F8Ba3250ca64a45D16284D04Bc6f5FBf' as Address

describe('F-04: useEntryPointDeposit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch sender deposit balance from EntryPoint', async () => {
    // Mock EntryPoint.balanceOf returns 1 ETH
    mockReadContract.mockResolvedValueOnce(1000000000000000000n)

    const { useEntryPointDeposit } = await import('../useEntryPointDeposit')
    const { result } = renderHook(() => useEntryPointDeposit(SENDER))

    // Trigger fetch
    await act(async () => {
      await result.current.fetchDeposit()
    })

    expect(result.current.deposit).toBe(1000000000000000000n)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()

    // Verify readContract was called with correct params
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0x2ef7E4897d71647502e2Fe60F707AcD9a110660C',
        functionName: 'balanceOf',
        args: [SENDER],
      })
    )
  })

  it('should return 0n when no deposit exists', async () => {
    mockReadContract.mockResolvedValueOnce(0n)

    const { useEntryPointDeposit } = await import('../useEntryPointDeposit')
    const { result } = renderHook(() => useEntryPointDeposit(SENDER))

    await act(async () => {
      await result.current.fetchDeposit()
    })

    expect(result.current.deposit).toBe(0n)
  })

  it('should handle errors gracefully', async () => {
    mockReadContract.mockRejectedValueOnce(new Error('RPC error'))

    const { useEntryPointDeposit } = await import('../useEntryPointDeposit')
    const { result } = renderHook(() => useEntryPointDeposit(SENDER))

    await act(async () => {
      await result.current.fetchDeposit()
    })

    expect(result.current.deposit).toBeNull()
    expect(result.current.error).toBeTruthy()
  })

  it('should format deposit in ETH units', async () => {
    mockReadContract.mockResolvedValueOnce(1500000000000000000n) // 1.5 ETH

    const { useEntryPointDeposit } = await import('../useEntryPointDeposit')
    const { result } = renderHook(() => useEntryPointDeposit(SENDER))

    await act(async () => {
      await result.current.fetchDeposit()
    })

    expect(result.current.formattedDeposit).toBe('1.5')
  })
})

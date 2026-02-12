import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionKey } from '../useSessionKey'

// Mock wagmi hooks — stable references to prevent infinite re-render loops
const mockWriteContract = vi.fn().mockResolvedValue('0xtxhash')
const mockReadContract = vi.fn().mockResolvedValue([])

const mockAccountReturn = {
  address: '0x1234567890123456789012345678901234567890',
  isConnected: true,
}
const mockWalletClientData = { writeContract: mockWriteContract }
const mockWalletClientReturn = { data: mockWalletClientData }
const mockPublicClient = { readContract: mockReadContract }

vi.mock('wagmi', () => ({
  useAccount: () => mockAccountReturn,
  useChainId: () => 8283,
  useWalletClient: () => mockWalletClientReturn,
  usePublicClient: () => mockPublicClient,
}))

// Mock config
vi.mock('../../lib/config', () => ({
  getContractAddresses: () => ({
    sessionKeyManager: '0x4a679253410272dd5232B3Ff7cF5dbB88f295319',
  }),
}))

// Mock secureKeyStore
const mockStore = vi.fn()
vi.mock('@/lib/secureKeyStore', () => ({
  secureKeyStore: {
    store: (...args: unknown[]) => mockStore(...args),
  },
}))

// Mock viem/accounts
const mockGeneratePrivateKey = vi.fn()
const mockPrivateKeyToAccount = vi.fn()
vi.mock('viem/accounts', () => ({
  generatePrivateKey: (...args: unknown[]) => mockGeneratePrivateKey(...args),
  privateKeyToAccount: (...args: unknown[]) => mockPrivateKeyToAccount(...args),
}))

describe('useSessionKey - keypair generation', () => {
  const MOCK_PRIVATE_KEY = '0x' + 'ab'.repeat(32)
  const MOCK_SESSION_ADDRESS = '0x' + 'cd'.repeat(20)

  beforeEach(() => {
    vi.clearAllMocks()
    mockGeneratePrivateKey.mockReturnValue(MOCK_PRIVATE_KEY)
    mockPrivateKeyToAccount.mockReturnValue({ address: MOCK_SESSION_ADDRESS })
    mockReadContract.mockResolvedValue([])
    mockWriteContract.mockResolvedValue('0xtxhash')
  })

  it('should use generatePrivateKey to create session key', async () => {
    const { result } = renderHook(() => useSessionKey())

    // Wait for initial mount effect (refresh) to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.createSessionKey({})
    })

    expect(mockGeneratePrivateKey).toHaveBeenCalled()
  })

  it('should derive address from private key', async () => {
    const { result } = renderHook(() => useSessionKey())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.createSessionKey({})
    })

    expect(mockPrivateKeyToAccount).toHaveBeenCalledWith(MOCK_PRIVATE_KEY)
  })

  it('should store private key in secureKeyStore', async () => {
    const { result } = renderHook(() => useSessionKey())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.createSessionKey({})
    })

    expect(mockStore).toHaveBeenCalledWith(MOCK_PRIVATE_KEY)
  })

  it('should use derived address for session key registration', async () => {
    const { result } = renderHook(() => useSessionKey())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // biome-ignore lint/suspicious/noExplicitAny: test variable reassigned in act() callback
    let res: any = null
    await act(async () => {
      res = await result.current.createSessionKey({})
    })

    // The returned sessionKey address should match privateKeyToAccount result
    expect(res?.sessionKey).toBe(MOCK_SESSION_ADDRESS)
  })
})

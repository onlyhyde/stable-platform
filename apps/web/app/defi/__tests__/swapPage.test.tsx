import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSendUserOp = vi.fn()
const mockUseSwap = vi.fn(() => ({
  quote: null,
  isLoading: false,
  error: null,
  getQuote: vi.fn(),
  executeSwap: vi.fn(),
}))

vi.mock('@/hooks', () => ({
  useWallet: vi.fn(() => ({
    isConnected: true,
    address: '0x1234567890123456789012345678901234567890',
  })),
  useSwap: mockUseSwap,
  useUserOp: vi.fn(() => ({
    sendUserOp: mockSendUserOp,
  })),
  usePaymaster: vi.fn(() => ({
    checkSponsorshipEligibility: vi.fn().mockResolvedValue({ eligible: false }),
  })),
}))

// SwapPage uses useToast from @/components/common
vi.mock('@/components/common', async () => {
  const actual = await vi.importActual<typeof import('@/components/common')>('@/components/common')
  return {
    ...actual,
    useToast: vi.fn(() => ({
      toasts: [],
      addToast: vi.fn(() => 'toast-id'),
      removeToast: vi.fn(),
      updateToast: vi.fn(),
    })),
  }
})

vi.mock('@/hooks/useTokens', () => ({
  useTokens: vi.fn(() => ({
    tokens: [
      {
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
      },
      {
        address: '0x0000000000000000000000000000000000000001',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      },
    ],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  })),
}))

describe('SwapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass sendUserOp from useUserOp to useSwap', async () => {
    const SwapPage = (await import('@/app/defi/swap/page')).default
    render(<SwapPage />)

    // useSwap should have been called with config containing sendUserOp
    expect(mockUseSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        sendUserOp: mockSendUserOp,
      })
    )
  })
})

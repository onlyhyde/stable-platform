'use client'

import { render, screen, waitFor } from '@testing-library/react'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock @/components/common — useToast requires ToastProvider context.
vi.mock('@/components/common', () => {
  const React = require('react')
  const c = () => {
    return ({ children }: unknown) => React.createElement('div', null, children)
  }
  return {
    Button: ({ children, onClick, disabled }: unknown) =>
      React.createElement('button', { onClick, disabled, type: 'button' }, children),
    Card: c(),
    CardContent: c(),
    CardDescription: c(),
    CardFooter: c(),
    CardHeader: c(),
    CardTitle: c(),
    ConnectWalletCard: ({ message }: unknown) => React.createElement('div', null, message),
    InfoBanner: c(),
    Input: c(),
    Modal: c(),
    ModalActions: c(),
    NetworkSelector: c(),
    NetworkWarningBanner: c(),
    PageHeader: ({ title, description }: unknown) =>
      React.createElement(
        'div',
        null,
        React.createElement('h1', null, title),
        description ? React.createElement('p', null, description) : null
      ),
    Pagination: () => null,
    PaymasterSelector: c(),
    ToastProvider: c(),
    Toggle: c(),
    ToggleCard: c(),
    WalletSelectorModal: c(),
    useToast: vi.fn(() => ({
      toasts: [],
      addToast: vi.fn(() => 'toast-id'),
      removeToast: vi.fn(),
      updateToast: vi.fn(),
    })),
  }
})

// Mock defi components
vi.mock('@/components/defi', () => {
  const React = require('react')
  return {
    AddLiquidityModal: () => null,
    AvailablePoolsCard: () => React.createElement('div', null, 'Available Pools'),
    DefiNavigationCards: () => null,
    DefiStatsCards: () => null,
    SwapCard: () => React.createElement('div', null, 'SwapCard'),
    YourPositionsCard: () => null,
  }
})

// Mock @/lib/utils to prevent loading viem
vi.mock('@/lib/utils', () => ({
  formatAddress: (addr: string, chars = 4) => `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`,
  formatRelativeTime: () => 'just now',
  formatTokenAmount: () => '0',
  formatUSD: (v: number) => `$${v.toFixed(2)}`,
  formatPercent: () => '0%',
  formatDate: () => '2024-01-01',
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  copyToClipboard: async () => true,
  delay: (ms: number) => new Promise((r: unknown) => setTimeout(r, ms)),
  getBlockExplorerUrl: () => 'https://explorer.example.com',
  sanitizeErrorMessage: () => 'An error occurred',
  getRpcSettings: () => null,
  getRpcUrl: () => undefined,
  getBundlerUrl: () => undefined,
  getPaymasterUrl: () => undefined,
}))

vi.mock('wagmi', () => ({
  useChainId: vi.fn(() => 31337),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn(() => null),
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
  })),
}))

vi.mock('@/hooks/usePools', () => ({
  usePools: vi.fn(() => ({
    pools: [],
    positions: [],
    isLoading: false,
    isLoadingPositions: false,
    error: null,
    refresh: vi.fn(),
  })),
}))

vi.mock('@/hooks/usePoolLiquidity', () => ({
  usePoolLiquidity: vi.fn(() => ({
    addLiquidity: vi.fn(),
    removeLiquidity: vi.fn(),
    step: 'idle',
    isLoading: false,
    error: null,
    clearError: vi.fn(),
  })),
}))

vi.mock('@/hooks/useTokens', () => ({
  useTokens: vi.fn(() => ({
    tokens: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  })),
}))

vi.mock('@/hooks', () => ({
  useWallet: vi.fn(() => ({
    isConnected: true,
    address: '0x1234567890123456789012345678901234567890',
  })),
  useSwap: vi.fn(() => ({
    quote: null,
    isLoading: false,
    error: null,
    getQuote: vi.fn(),
    executeSwap: vi.fn(),
  })),
  useUserOp: vi.fn(() => ({
    sendUserOp: vi.fn(),
    sendTransaction: vi.fn(),
    recheckUserOp: vi.fn(),
    getPendingUserOps: vi.fn(() => []),
    removePendingUserOp: vi.fn(),
    isLoading: false,
    error: null,
  })),
  usePaymaster: vi.fn(() => ({
    checkSponsorshipEligibility: vi.fn().mockResolvedValue({ eligible: false }),
  })),
}))

import { usePools } from '@/hooks/usePools'
import { useTokens } from '@/hooks/useTokens'

describe('Page Integration — DeFi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PoolPage', () => {
    it('should call usePools hook on mount', async () => {
      const PoolPage = (await import('@/app/defi/pool/page')).default
      render(<PoolPage />)

      expect(usePools).toHaveBeenCalled()
    })

    it('should display loading state when fetching pools', async () => {
      vi.mocked(usePools).mockReturnValue({
        pools: [],
        positions: [],
        isLoading: true,
        isLoadingPositions: false,
        error: null,
        refresh: vi.fn(),
      })

      const PoolPage = (await import('@/app/defi/pool/page')).default
      render(<PoolPage />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should display pools from hook', async () => {
      const mockPools = [
        {
          address: '0x1234567890123456789012345678901234567890' as Address,
          token0: {
            address: '0x0000000000000000000000000000000000000000' as Address,
            symbol: 'ETH',
            name: 'Ethereum',
            decimals: 18,
          },
          token1: {
            address: '0x0000000000000000000000000000000000000001' as Address,
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
          },
          reserve0: BigInt('1000000000000000000'),
          reserve1: BigInt('2000000000'),
          fee: 0.3,
          tvl: 4000,
          apr: 12.5,
        },
      ]

      vi.mocked(usePools).mockReturnValue({
        pools: mockPools,
        positions: [],
        isLoading: false,
        isLoadingPositions: false,
        error: null,
        refresh: vi.fn(),
      })

      const PoolPage = (await import('@/app/defi/pool/page')).default
      render(<PoolPage />)

      expect(screen.getByText('Available Pools')).toBeInTheDocument()
    })
  })

  describe('SwapPage', () => {
    it('should call useTokens hook on mount', async () => {
      const SwapPage = (await import('@/app/defi/swap/page')).default
      render(<SwapPage />)

      expect(useTokens).toHaveBeenCalled()
    })

    it('should display tokens from hook in swap UI', async () => {
      const mockTokens = [
        {
          address: '0x0000000000000000000000000000000000000000' as Address,
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
        },
        {
          address: '0x0000000000000000000000000000000000000001' as Address,
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
        },
      ]

      vi.mocked(useTokens).mockReturnValue({
        tokens: mockTokens,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      const SwapPage = (await import('@/app/defi/swap/page')).default
      render(<SwapPage />)

      await waitFor(() => {
        expect(screen.getByText('Swap')).toBeInTheDocument()
      })
    })
  })
})

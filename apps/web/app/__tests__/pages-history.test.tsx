'use client'

import { cleanup, render, screen } from '@testing-library/react'
import type { Address, Hex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock @/components/common — useToast must return stable references
vi.mock('@/components/common', () => {
  const React = require('react')
  const c = () => {
    return ({ children }: unknown) => React.createElement('div', null, children)
  }
  // Stable toast functions to avoid infinite re-render
  const stableToast = {
    toasts: [],
    addToast: () => 'toast-id',
    removeToast: () => {},
    updateToast: () => {},
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
    ToastProvider: c(),
    Toggle: c(),
    ToggleCard: c(),
    WalletSelectorModal: c(),
    useToast: () => stableToast,
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
  useAccount: vi.fn(() => ({ address: '0x1234567890123456789012345678901234567890' })),
  useWalletClient: vi.fn(() => ({ data: null })),
  usePublicClient: vi.fn(() => ({ readContract: vi.fn(), waitForTransactionReceipt: vi.fn() })),
}))

vi.mock('@stablenet/wallet-sdk', () => ({
  getNativeCurrencySymbol: (chainId: number) => chainId === 8283 ? 'WKRC' : 'ETH',
  detectProvider: vi.fn(() => Promise.resolve(null)),
}))

// Stable searchParams to avoid infinite re-render
vi.mock('next/navigation', () => {
  const searchParams = { get: () => null }
  return {
    useSearchParams: () => searchParams,
    useRouter: () => ({ push: () => {}, back: () => {} }),
  }
})

// Stable useUserOp mock — getPendingUserOps is in useEffect deps,
// so vi.fn() would create new refs each render → infinite loop
const stableUserOpReturn = {
  sendUserOp: () => {},
  sendTransaction: () => {},
  recheckUserOp: async () => ({ status: 'pending' }),
  getPendingUserOps: () => [] as unknown[],
  removePendingUserOp: () => {},
  isLoading: false,
  error: null,
}

vi.mock('@/hooks/useUserOp', () => ({
  useUserOp: vi.fn(() => stableUserOpReturn),
}))

vi.mock('@/hooks/useTransactionHistory', () => ({
  useTransactionHistory: vi.fn(() => ({
    transactions: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  })),
}))

vi.mock('@/hooks/useTransactionManager', () => ({
  useTransactionManager: vi.fn(() => ({
    speedUpTransaction: vi.fn(),
    cancelTransaction: vi.fn(),
    isSpeedingUp: false,
    isCancelling: false,
  })),
}))

vi.mock('@/hooks', () => ({
  useWallet: vi.fn(() => ({
    isConnected: true,
    address: '0x1234567890123456789012345678901234567890',
  })),
  useUserOp: vi.fn(() => stableUserOpReturn),
  usePaymaster: vi.fn(() => ({
    checkSponsorshipEligibility: async () => ({ eligible: false }),
  })),
}))

import { useTransactionHistory } from '@/hooks/useTransactionHistory'

describe('Page Integration — History', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('HistoryPage', () => {
    it('should call useTransactionHistory hook on mount', async () => {
      const HistoryPage = (await import('@/app/payment/history/page')).default
      render(<HistoryPage />)

      expect(useTransactionHistory).toHaveBeenCalled()
    }, 15_000)

    it('should display loading state when fetching transactions', async () => {
      vi.mocked(useTransactionHistory).mockReturnValue({
        transactions: [],
        isLoading: true,
        error: null,
        refresh: vi.fn(),
      })

      const HistoryPage = (await import('@/app/payment/history/page')).default
      render(<HistoryPage />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should display transactions from hook', async () => {
      const mockTransactions = [
        {
          hash: '0xabc1230000000000000000000000000000000000000000000000000000000000' as Hex,
          from: '0x1234567890123456789012345678901234567890' as Address,
          to: '0x2345678901234567890123456789012345678901' as Address,
          value: BigInt('1000000000000000000'),
          chainId: 1,
          timestamp: Date.now(),
          status: 'confirmed' as const,
        },
      ]

      vi.mocked(useTransactionHistory).mockReturnValue({
        transactions: mockTransactions,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      const HistoryPage = (await import('@/app/payment/history/page')).default
      render(<HistoryPage />)

      expect(screen.getByText(/0x2345/)).toBeInTheDocument()
    })
  })
})

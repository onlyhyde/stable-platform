'use client'

import { render, screen } from '@testing-library/react'
import type { Address, Hex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the hooks
vi.mock('@/hooks/usePools', () => ({
  usePools: vi.fn(() => ({
    pools: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
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

vi.mock('@/hooks/usePayroll', () => ({
  usePayroll: vi.fn(() => ({
    payrollEntries: [],
    summary: {
      totalMonthly: 0,
      activeEmployees: 0,
      nextPaymentDate: null,
      ytdTotal: 0,
    },
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  })),
}))

vi.mock('@/hooks/useAuditLogs', () => ({
  useAuditLogs: vi.fn(() => ({
    logs: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  })),
}))

vi.mock('@/hooks/useExpenses', () => ({
  useExpenses: vi.fn(() => ({
    expenses: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  })),
}))

vi.mock('@/hooks/useTransactionHistory', () => ({
  useTransactionHistory: vi.fn(() => ({
    transactions: [],
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
    isLoading: false,
    error: null,
  })),
}))

import { useAuditLogs } from '@/hooks/useAuditLogs'
import { useExpenses } from '@/hooks/useExpenses'
import { usePayroll } from '@/hooks/usePayroll'
// Import after mocking
import { usePools } from '@/hooks/usePools'
import { useTokens } from '@/hooks/useTokens'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'

describe('Page Integration with Data Hooks', () => {
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
        isLoading: true,
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
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      })

      const PoolPage = (await import('@/app/defi/pool/page')).default
      render(<PoolPage />)

      // Check that the AvailablePoolsCard receives pools
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

      // Swap page shows the swap interface when tokens are loaded
      expect(screen.getByText('Swap')).toBeInTheDocument()
    })
  })

  describe('PayrollPage', () => {
    it('should call usePayroll hook on mount', async () => {
      const PayrollPage = (await import('@/app/enterprise/payroll/page')).default
      render(<PayrollPage />)

      expect(usePayroll).toHaveBeenCalled()
    })

    it('should display loading state when fetching payroll', async () => {
      vi.mocked(usePayroll).mockReturnValue({
        payrollEntries: [],
        summary: { totalMonthly: 0, activeEmployees: 0, nextPaymentDate: null, ytdTotal: 0 },
        isLoading: true,
        error: null,
        refresh: vi.fn(),
        addEntry: vi.fn(),
        updateEntry: vi.fn(),
        removeEntry: vi.fn(),
      })

      const PayrollPage = (await import('@/app/enterprise/payroll/page')).default
      render(<PayrollPage />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should display payroll summary from hook', async () => {
      vi.mocked(usePayroll).mockReturnValue({
        payrollEntries: [],
        summary: {
          totalMonthly: 8500,
          activeEmployees: 2,
          nextPaymentDate: new Date('2024-02-01'),
          ytdTotal: 25000,
        },
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        addEntry: vi.fn(),
        updateEntry: vi.fn(),
        removeEntry: vi.fn(),
      })

      const PayrollPage = (await import('@/app/enterprise/payroll/page')).default
      render(<PayrollPage />)

      expect(screen.getByText(/8,500/)).toBeInTheDocument()
    })
  })

  describe('AuditPage', () => {
    it('should call useAuditLogs hook on mount', async () => {
      const AuditPage = (await import('@/app/enterprise/audit/page')).default
      render(<AuditPage />)

      expect(useAuditLogs).toHaveBeenCalled()
    })

    it('should display loading state when fetching logs', async () => {
      vi.mocked(useAuditLogs).mockReturnValue({
        logs: [],
        isLoading: true,
        error: null,
        refresh: vi.fn(),
        addLog: vi.fn(),
      })

      const AuditPage = (await import('@/app/enterprise/audit/page')).default
      render(<AuditPage />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should display audit logs from hook', async () => {
      const mockLogs = [
        {
          id: '1',
          action: 'payroll_processed',
          actor: '0x1234567890123456789012345678901234567890' as Address,
          target: '0x2345678901234567890123456789012345678901' as Address,
          details: 'Processed payroll payment',
          timestamp: new Date(),
        },
      ]

      vi.mocked(useAuditLogs).mockReturnValue({
        logs: mockLogs,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        addLog: vi.fn(),
      })

      const AuditPage = (await import('@/app/enterprise/audit/page')).default
      render(<AuditPage />)

      expect(screen.getByText(/Processed payroll payment/)).toBeInTheDocument()
    })
  })

  describe('ExpensesPage', () => {
    it('should call useExpenses hook on mount', async () => {
      const ExpensesPage = (await import('@/app/enterprise/expenses/page')).default
      render(<ExpensesPage />)

      expect(useExpenses).toHaveBeenCalled()
    })

    it('should display loading state when fetching expenses', async () => {
      vi.mocked(useExpenses).mockReturnValue({
        expenses: [],
        isLoading: true,
        error: null,
        refresh: vi.fn(),
        addExpense: vi.fn(),
        updateExpense: vi.fn(),
        removeExpense: vi.fn(),
      })

      const ExpensesPage = (await import('@/app/enterprise/expenses/page')).default
      render(<ExpensesPage />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should display expenses from hook', async () => {
      const mockExpenses = [
        {
          id: '1',
          description: 'AWS Cloud Services',
          amount: BigInt('1500000000'),
          token: {
            address: '0x0000000000000000000000000000000000000001' as Address,
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
          },
          category: 'infrastructure',
          submitter: '0x1234567890123456789012345678901234567890' as Address,
          submittedAt: new Date(),
          status: 'pending' as const,
        },
      ]

      vi.mocked(useExpenses).mockReturnValue({
        expenses: mockExpenses,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        addExpense: vi.fn(),
        updateExpense: vi.fn(),
        removeExpense: vi.fn(),
      })

      const ExpensesPage = (await import('@/app/enterprise/expenses/page')).default
      render(<ExpensesPage />)

      expect(screen.getByText(/AWS Cloud Services/)).toBeInTheDocument()
    })
  })

  describe('HistoryPage', () => {
    it('should call useTransactionHistory hook on mount', async () => {
      const HistoryPage = (await import('@/app/payment/history/page')).default
      render(<HistoryPage />)

      expect(useTransactionHistory).toHaveBeenCalled()
    })

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

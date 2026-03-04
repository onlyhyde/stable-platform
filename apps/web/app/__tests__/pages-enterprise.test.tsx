'use client'

import { render, screen } from '@testing-library/react'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock @/components/common — useToast requires ToastProvider context.
vi.mock('@/components/common', () => {
  const React = require('react')
  const c = () => {
    return ({ children }: Record<string, unknown>) => React.createElement('div', null, children)
  }
  return {
    Button: ({ children, onClick, disabled }: Record<string, unknown>) =>
      React.createElement('button', { onClick, disabled, type: 'button' }, children),
    Card: c(),
    CardContent: c(),
    CardDescription: c(),
    CardFooter: c(),
    CardHeader: c(),
    CardTitle: c(),
    ConnectWalletCard: ({ message }: Record<string, unknown>) => React.createElement('div', null, message),
    InfoBanner: c(),
    Input: c(),
    Modal: c(),
    ModalActions: c(),
    NetworkSelector: c(),
    NetworkWarningBanner: c(),
    PageHeader: ({ title, description }: Record<string, unknown>) =>
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
    useToast: vi.fn(() => ({
      toasts: [],
      addToast: vi.fn(() => 'toast-id'),
      removeToast: vi.fn(),
      updateToast: vi.fn(),
    })),
  }
})

// Mock enterprise components to avoid loading heavy dependencies
vi.mock('@/components/enterprise', () => {
  const React = require('react')
  return {
    AddEmployeeModal: () => null,
    AuditFilterCard: () => null,
    AuditLogCard: ({ logs }: Record<string, unknown>) =>
      React.createElement(
        'div',
        null,
        (logs as Array<Record<string, unknown>>)?.map((l: Record<string, unknown>, i: number) => React.createElement('div', { key: i }, l.details as string))
      ),
    AuditSummaryCards: () => null,
    ComplianceInfoCard: () => null,
    ExpenseListCard: ({ expenses }: Record<string, unknown>) =>
      React.createElement(
        'div',
        null,
        (expenses as Array<Record<string, unknown>>)?.map((e: Record<string, unknown>, i: number) =>
          React.createElement('div', { key: i }, e.description as string)
        )
      ),
    ExpenseSummaryCards: () => null,
    PayrollListCard: () => null,
    PayrollQuickActionsCard: () => null,
    PayrollSummaryCards: ({ monthlyPayroll }: Record<string, unknown>) =>
      React.createElement('div', null, monthlyPayroll as string),
    SubmitExpenseModal: () => null,
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
  delay: (ms: number) => new Promise((r: (v?: unknown) => void) => setTimeout(r, ms)),
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

// HistoryPage imports useUserOp directly
vi.mock('@/hooks/useUserOp', () => ({
  useUserOp: vi.fn(() => ({
    sendUserOp: vi.fn(),
    sendTransaction: vi.fn(),
    recheckUserOp: vi.fn(),
    getPendingUserOps: vi.fn(() => []),
    removePendingUserOp: vi.fn(),
    isLoading: false,
    error: null,
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

import { useAuditLogs } from '@/hooks/useAuditLogs'
import { useExpenses } from '@/hooks/useExpenses'
import { usePayroll } from '@/hooks/usePayroll'

describe('Page Integration — Enterprise & History', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})

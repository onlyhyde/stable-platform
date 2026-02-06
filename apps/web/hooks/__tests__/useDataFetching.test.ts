import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuditLogs } from '../useAuditLogs'
import { useExpenses } from '../useExpenses'
import { usePayroll } from '../usePayroll'
import { usePools } from '../usePools'
import { useTokens } from '../useTokens'
import { useTransactionHistory } from '../useTransactionHistory'

// Mock context
vi.mock('@/providers', () => ({
  useStableNetContext: () => ({
    chainId: 31337,
    publicClient: {
      readContract: vi.fn(),
      multicall: vi.fn(),
    },
  }),
}))

describe('usePools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch pools from contract', async () => {
    const mockPools = [
      {
        address: '0x1234567890123456789012345678901234567890',
        token0: { address: '0x0', symbol: 'ETH', name: 'Ether', decimals: 18 },
        token1: { address: '0x1', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        reserve0: BigInt('1000000000000000000000'),
        reserve1: BigInt('2500000000000'),
        fee: 0.3,
        tvl: 5000000,
        apr: 12.5,
      },
    ]

    const mockFetchPools = vi.fn().mockResolvedValue(mockPools)

    const { result } = renderHook(() =>
      usePools({
        fetchPools: mockFetchPools,
      })
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.pools).toHaveLength(1)
    expect(result.current.pools[0].token0.symbol).toBe('ETH')
    expect(mockFetchPools).toHaveBeenCalled()
  })

  it('should handle fetch errors', async () => {
    const mockFetchPools = vi.fn().mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() =>
      usePools({
        fetchPools: mockFetchPools,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.pools).toHaveLength(0)
  })

  it('should allow manual refresh', async () => {
    const mockFetchPools = vi.fn().mockResolvedValue([])

    const { result } = renderHook(() =>
      usePools({
        fetchPools: mockFetchPools,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFetchPools).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.refresh()
    })

    expect(mockFetchPools).toHaveBeenCalledTimes(2)
  })
})

describe('useTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch tokens from registry', async () => {
    const mockTokens = [
      { address: '0x0', symbol: 'ETH', name: 'Ether', decimals: 18 },
      { address: '0x1', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    ]

    const mockFetchTokens = vi.fn().mockResolvedValue(mockTokens)

    const { result } = renderHook(() =>
      useTokens({
        fetchTokens: mockFetchTokens,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.tokens).toHaveLength(2)
    expect(mockFetchTokens).toHaveBeenCalled()
  })
})

describe('usePayroll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch payroll entries', async () => {
    const mockPayroll = [
      {
        id: '1',
        recipient: '0x1234567890123456789012345678901234567890',
        amount: BigInt('1000000000'),
        token: { address: '0x1', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        frequency: 'monthly',
        nextPaymentDate: new Date('2025-02-01'),
        status: 'active',
      },
    ]

    const mockFetchPayroll = vi.fn().mockResolvedValue(mockPayroll)

    const { result } = renderHook(() =>
      usePayroll({
        fetchPayroll: mockFetchPayroll,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.payrollEntries).toHaveLength(1)
    expect(result.current.payrollEntries[0].frequency).toBe('monthly')
  })

  it('should calculate summary statistics', async () => {
    const mockPayroll = [
      {
        id: '1',
        recipient: '0x1234',
        amount: BigInt('1000000000'), // 1000 USDC
        token: { address: '0x1', symbol: 'USDC', decimals: 6 },
        frequency: 'monthly',
        nextPaymentDate: new Date('2025-02-01'),
        status: 'active',
      },
      {
        id: '2',
        recipient: '0x5678',
        amount: BigInt('500000000'), // 500 USDC
        token: { address: '0x1', symbol: 'USDC', decimals: 6 },
        frequency: 'monthly',
        nextPaymentDate: new Date('2025-02-01'),
        status: 'active',
      },
    ]

    const mockFetchPayroll = vi.fn().mockResolvedValue(mockPayroll)

    const { result } = renderHook(() =>
      usePayroll({
        fetchPayroll: mockFetchPayroll,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.summary.totalMonthly).toBe(1500) // 1000 + 500
    expect(result.current.summary.activeEmployees).toBe(2)
  })
})

describe('useAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch audit logs from blockchain events', async () => {
    const mockLogs = [
      {
        id: '1',
        action: 'PayrollExecuted',
        actor: '0x1234567890123456789012345678901234567890',
        target: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        details: 'Paid 1000 USDC',
        timestamp: new Date('2025-01-20'),
        txHash: '0xabc123',
      },
    ]

    const mockFetchLogs = vi.fn().mockResolvedValue(mockLogs)

    const { result } = renderHook(() =>
      useAuditLogs({
        fetchLogs: mockFetchLogs,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.logs).toHaveLength(1)
    expect(result.current.logs[0].action).toBe('PayrollExecuted')
  })

  it('should support filtering by action type', async () => {
    const mockLogs = [
      { id: '1', action: 'PayrollExecuted', actor: '0x1234', timestamp: new Date() },
      { id: '2', action: 'ExpenseApproved', actor: '0x5678', timestamp: new Date() },
    ]

    const mockFetchLogs = vi.fn().mockResolvedValue(mockLogs)

    const { result } = renderHook(() =>
      useAuditLogs({
        fetchLogs: mockFetchLogs,
        filter: { action: 'PayrollExecuted' },
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.logs).toHaveLength(1)
    expect(result.current.logs[0].action).toBe('PayrollExecuted')
  })
})

describe('useExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch expenses', async () => {
    const mockExpenses = [
      {
        id: '1',
        description: 'Cloud services',
        amount: BigInt('500000000'),
        token: { address: '0x1', symbol: 'USDC', decimals: 6 },
        category: 'infrastructure',
        submitter: '0x1234567890123456789012345678901234567890',
        status: 'pending',
        submittedAt: new Date('2025-01-15'),
      },
    ]

    const mockFetchExpenses = vi.fn().mockResolvedValue(mockExpenses)

    const { result } = renderHook(() =>
      useExpenses({
        fetchExpenses: mockFetchExpenses,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.expenses).toHaveLength(1)
    expect(result.current.expenses[0].category).toBe('infrastructure')
  })

  it('should filter by status', async () => {
    const mockExpenses = [
      { id: '1', status: 'pending', category: 'software' },
      { id: '2', status: 'approved', category: 'travel' },
    ]

    const mockFetchExpenses = vi.fn().mockResolvedValue(mockExpenses)

    const { result } = renderHook(() =>
      useExpenses({
        fetchExpenses: mockFetchExpenses,
        filter: { status: 'pending' },
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.expenses).toHaveLength(1)
    expect(result.current.expenses[0].status).toBe('pending')
  })
})

describe('useTransactionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch transaction history', async () => {
    const mockTransactions = [
      {
        hash: '0xabc123',
        from: '0x1234567890123456789012345678901234567890',
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: BigInt('1000000000000000000'),
        chainId: 31337,
        status: 'confirmed',
        timestamp: 1705881600,
      },
    ]

    const mockFetchTransactions = vi.fn().mockResolvedValue(mockTransactions)

    const { result } = renderHook(() =>
      useTransactionHistory({
        address: '0x1234567890123456789012345678901234567890',
        fetchTransactions: mockFetchTransactions,
      })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.transactions).toHaveLength(1)
    expect(result.current.transactions[0].status).toBe('confirmed')
  })

  it('should return empty array when no address provided', async () => {
    const mockFetchTransactions = vi.fn().mockResolvedValue([])

    const { result } = renderHook(() =>
      useTransactionHistory({
        address: undefined,
        fetchTransactions: mockFetchTransactions,
      })
    )

    expect(result.current.transactions).toHaveLength(0)
    expect(mockFetchTransactions).not.toHaveBeenCalled()
  })
})

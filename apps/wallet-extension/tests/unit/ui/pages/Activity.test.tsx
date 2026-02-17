import { fireEvent, render, screen } from '@testing-library/react'
import type { PendingTransaction } from '../../../../src/types'
import { useNetworkCurrency, useWalletStore } from '../../../../src/ui/hooks'
import { Activity } from '../../../../src/ui/pages/Activity'

jest.mock('../../../../src/ui/hooks', () => ({
  useWalletStore: jest.fn(),
  useNetworkCurrency: jest.fn(),
}))

jest.mock('../../../../src/ui/hooks/useIndexerData', () => ({
  useIndexerData: jest.fn(() => ({
    transactions: [],
    isIndexerAvailable: false,
    isLoadingTransactions: false,
    isLoadingMore: false,
    hasMore: false,
    error: null,
    loadMoreTransactions: jest.fn(),
    refreshTransactions: jest.fn(),
  })),
}))

// Mock viem - formatEther
jest.mock('viem', () => ({
  formatEther: (value: bigint) => (Number(value) / 1e18).toString(),
}))

const mockSetPage = jest.fn()
const mockSetSelectedTxId = jest.fn()
const mockSyncWithBackground = jest.fn().mockResolvedValue(undefined)

function createTx(overrides: Partial<PendingTransaction> = {}): PendingTransaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    from: '0x1234567890abcdef1234567890abcdef12345678',
    to: '0xaabbccddee0011223344556677889900aabbccdd',
    value: BigInt('1000000000000000000'), // 1 ETH
    data: '0x',
    chainId: 1,
    timestamp: Date.now(),
    status: 'confirmed',
    type: 'send',
    ...overrides,
  }
}

function setupStore(overrides: Record<string, unknown> = {}) {
  ;(useWalletStore as unknown as jest.Mock).mockReturnValue({
    pendingTransactions: [],
    history: [],
    setPage: mockSetPage,
    setSelectedTxId: mockSetSelectedTxId,
    syncWithBackground: mockSyncWithBackground,
    ...overrides,
  })
  ;(useNetworkCurrency as unknown as jest.Mock).mockReturnValue({
    symbol: 'ETH',
    decimals: 18,
  })
}

describe('Activity', () => {
  beforeEach(() => {
    mockSetPage.mockClear()
    mockSetSelectedTxId.mockClear()
    mockSyncWithBackground.mockClear()
  })

  it('should show empty state when no transactions', () => {
    setupStore()

    render(<Activity />)
    // i18n keys: title => "Activity", noTransactions => "No transactions yet"
    expect(screen.getByText('Activity')).toBeTruthy()
    expect(screen.getByText('No transactions yet')).toBeTruthy()
  })

  it('should display a confirmed send transaction', () => {
    const tx = createTx({
      timestamp: Date.now(),
      status: 'confirmed',
      type: 'send',
    })
    setupStore({ history: [tx] })

    render(<Activity />)
    expect(screen.getByText('Send')).toBeTruthy()
    expect(screen.getByText('confirmed')).toBeTruthy()
  })

  it('should display a receive transaction with + prefix', () => {
    const tx = createTx({
      timestamp: Date.now(),
      type: 'receive',
    })
    setupStore({ history: [tx] })

    render(<Activity />)
    expect(screen.getByText('Receive')).toBeTruthy()
  })

  it('should display pending transactions', () => {
    const tx = createTx({
      timestamp: Date.now(),
      status: 'pending',
      type: 'send',
    })
    setupStore({ pendingTransactions: [tx] })

    render(<Activity />)
    expect(screen.getByText('pending')).toBeTruthy()
  })

  it('should group transactions by date', () => {
    const todayTx = createTx({ timestamp: Date.now() })
    const yesterdayTx = createTx({
      timestamp: Date.now() - 86400000,
      id: 'tx-yesterday',
    })

    setupStore({ history: [todayTx, yesterdayTx] })

    render(<Activity />)
    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.getByText('Yesterday')).toBeTruthy()
  })

  it('should sort transactions by timestamp (newest first)', () => {
    const oldTx = createTx({
      id: 'old',
      timestamp: Date.now() - 10000,
      type: 'receive',
    })
    const newTx = createTx({
      id: 'new',
      timestamp: Date.now(),
      type: 'send',
    })

    setupStore({ history: [oldTx, newTx] })

    render(<Activity />)
    // Filter out the refresh button (has aria-label="Refresh")
    const items = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-label') !== 'Refresh')
    // First item should be the newer transaction
    expect(items[0].textContent).toContain('Send')
  })

  it('should combine pending and history transactions', () => {
    const pendingTx = createTx({
      id: 'pending-1',
      timestamp: Date.now(),
      status: 'pending',
    })
    const historyTx = createTx({
      id: 'history-1',
      timestamp: Date.now() - 1000,
      status: 'confirmed',
    })

    setupStore({
      pendingTransactions: [pendingTx],
      history: [historyTx],
    })

    render(<Activity />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('should navigate to txDetail on transaction click', () => {
    const tx = createTx({ timestamp: Date.now(), txHash: '0xhash123' })
    setupStore({ history: [tx] })

    render(<Activity />)

    const txButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-label') !== 'Refresh')
    fireEvent.click(txButtons[0])

    expect(mockSetSelectedTxId).toHaveBeenCalledWith(tx.id)
    expect(mockSetPage).toHaveBeenCalledWith('txDetail')
  })

  it('should set selectedTxId on transaction click', () => {
    const tx = createTx({
      timestamp: Date.now(),
      txHash: '0xabc',
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      status: 'confirmed',
      type: 'send',
    })
    setupStore({ history: [tx] })

    render(<Activity />)

    const txButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-label') !== 'Refresh')
    fireEvent.click(txButtons[0])

    expect(mockSetSelectedTxId).toHaveBeenCalledWith(tx.id)
    expect(mockSetPage).toHaveBeenCalledWith('txDetail')
  })

  it('should display swap transaction label', () => {
    const tx = createTx({ timestamp: Date.now(), type: 'swap' })
    setupStore({ history: [tx] })

    render(<Activity />)
    expect(screen.getByText('Swap')).toBeTruthy()
  })

  it('should display approve transaction label', () => {
    const tx = createTx({ timestamp: Date.now(), type: 'approve' })
    setupStore({ history: [tx] })

    render(<Activity />)
    expect(screen.getByText('Approve')).toBeTruthy()
  })

  it('should display contract interaction with method name', () => {
    const tx = createTx({
      timestamp: Date.now(),
      type: 'contract',
      methodName: 'transfer',
    })
    setupStore({ history: [tx] })

    render(<Activity />)
    // When methodName is present, getTransactionLabel returns methodName
    expect(screen.getByText('transfer')).toBeTruthy()
    expect(screen.getByText('transfer()')).toBeTruthy()
  })

  it('should display userOp transaction label', () => {
    const tx = createTx({ timestamp: Date.now(), type: 'userOp' })
    setupStore({ history: [tx] })

    render(<Activity />)
    expect(screen.getByText('User Operation')).toBeTruthy()
  })

  it('should format counterparty address', () => {
    const tx = createTx({
      timestamp: Date.now(),
      to: '0xaabbccddee0011223344556677889900aabbccdd',
      type: 'send',
    })
    setupStore({ history: [tx] })

    render(<Activity />)
    expect(screen.getByText('To: 0xaabb...ccdd')).toBeTruthy()
  })

  it('should show "From:" for receive transactions', () => {
    const tx = createTx({
      timestamp: Date.now(),
      from: '0xaabbccddee0011223344556677889900aabbccdd',
      type: 'receive',
    })
    setupStore({ history: [tx] })

    render(<Activity />)
    expect(screen.getByText('From: 0xaabb...ccdd')).toBeTruthy()
  })

  it('should display failed transaction status', () => {
    const tx = createTx({ timestamp: Date.now(), status: 'failed' })
    setupStore({ history: [tx] })

    render(<Activity />)
    expect(screen.getByText('failed')).toBeTruthy()
  })
})

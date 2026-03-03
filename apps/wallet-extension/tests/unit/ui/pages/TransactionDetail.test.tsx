import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PendingTransaction } from '../../../../src/types'
import { useWalletStore } from '../../../../src/ui/hooks/useWalletStore'
import { TransactionDetail } from '../../../../src/ui/pages/TransactionDetail'

const mockSetPage = jest.fn()
const mockSelectedNetwork = jest.fn()
const mockSyncWithBackground = jest.fn().mockResolvedValue(undefined)

function getSendMessage() {
  return chrome.runtime.sendMessage as jest.Mock
}

jest.mock('../../../../src/ui/hooks/useWalletStore', () => ({
  useWalletStore: jest.fn(),
}))

jest.mock('../../../../src/ui/hooks', () => ({
  useSelectedNetwork: () => mockSelectedNetwork(),
  useNetworkCurrency: () => ({ symbol: 'ETH', decimals: 18 }),
}))

const MOCK_TX: PendingTransaction = {
  id: 'tx-1234',
  txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  from: '0x1234567890abcdef1234567890abcdef12345678',
  to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  value: BigInt('1000000000000000000'), // 1 ETH
  chainId: 1,
  status: 'confirmed',
  type: 'send',
  gasUsed: BigInt(21000),
  gasPrice: BigInt(20000000000),
  blockNumber: BigInt(12345678),
  timestamp: 1700000000000,
}

function setupWalletStore(overrides: Record<string, unknown> = {}) {
  ;(useWalletStore as unknown as jest.Mock).mockReturnValue({
    setPage: mockSetPage,
    pendingTransactions: [],
    history: [],
    selectedTxId: null,
    selectedAccount: '0x1234567890abcdef1234567890abcdef12345678',
    syncWithBackground: mockSyncWithBackground,
    ...overrides,
  })
}

describe('TransactionDetail', () => {
  beforeEach(() => {
    mockSetPage.mockClear()
    mockSyncWithBackground.mockClear()
    getSendMessage().mockReset()
    mockSelectedNetwork.mockReturnValue({
      chainId: 1,
      name: 'Ethereum Mainnet',
      rpcUrl: 'https://eth.example.com',
      explorerUrl: 'https://etherscan.io',
      currency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    })
  })

  it('should show "No transaction selected" when no selectedTxId', () => {
    setupWalletStore()

    render(<TransactionDetail />)
    expect(screen.getByText('No transaction selected')).toBeTruthy()
    expect(screen.getByText('Transaction Detail')).toBeTruthy()
  })

  it('should display transaction details from store', () => {
    setupWalletStore({ selectedTxId: MOCK_TX.id, history: [MOCK_TX] })

    render(<TransactionDetail />)
    // Transaction Hash appears in both stepper and details card
    expect(screen.getAllByText('Transaction Hash').length).toBeGreaterThanOrEqual(1)
    // Status shown via TransactionStepper
    expect(screen.getByText('Transaction Confirmed')).toBeTruthy()
    expect(screen.getByText('From')).toBeTruthy()
    expect(screen.getByText('To')).toBeTruthy()
    expect(screen.getByText('Value')).toBeTruthy()
  })

  it('should show confirmed status badge', () => {
    setupWalletStore({ selectedTxId: MOCK_TX.id, history: [MOCK_TX] })

    render(<TransactionDetail />)
    expect(screen.getByText('Transaction Confirmed')).toBeTruthy()
  })

  it('should show pending status badge', () => {
    const pendingTx = { ...MOCK_TX, status: 'pending' as const }
    setupWalletStore({ selectedTxId: MOCK_TX.id, pendingTransactions: [pendingTx] })

    render(<TransactionDetail />)
    // Stepper shows "Waiting to be included in a block..." for pending status
    expect(screen.getByText('Waiting to be included in a block...')).toBeTruthy()
  })

  it('should show submitted status badge', () => {
    const submittedTx = { ...MOCK_TX, status: 'submitted' as const }
    setupWalletStore({ selectedTxId: MOCK_TX.id, pendingTransactions: [submittedTx] })

    render(<TransactionDetail />)
    // Stepper shows "Waiting to be included in a block..." for submitted status
    expect(screen.getByText('Waiting to be included in a block...')).toBeTruthy()
  })

  it('should show failed status badge', () => {
    const failedTx = { ...MOCK_TX, status: 'failed' as const }
    setupWalletStore({ selectedTxId: MOCK_TX.id, history: [failedTx] })

    render(<TransactionDetail />)
    // Stepper shows "Transaction Failed" for failed status
    expect(screen.getAllByText('Transaction Failed').length).toBeGreaterThanOrEqual(1)
  })

  it('should show Speed Up and Cancel buttons for pending transactions', () => {
    const pendingTx = { ...MOCK_TX, status: 'pending' as const }
    setupWalletStore({ selectedTxId: MOCK_TX.id, pendingTransactions: [pendingTx] })

    render(<TransactionDetail />)
    expect(screen.getByText('Speed Up')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
  })

  it('should show Speed Up and Cancel buttons for submitted transactions', () => {
    const submittedTx = { ...MOCK_TX, status: 'submitted' as const }
    setupWalletStore({ selectedTxId: MOCK_TX.id, pendingTransactions: [submittedTx] })

    render(<TransactionDetail />)
    expect(screen.getByText('Speed Up')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
  })

  it('should NOT show Speed Up and Cancel for confirmed transactions', () => {
    setupWalletStore({ selectedTxId: MOCK_TX.id, history: [MOCK_TX] })

    render(<TransactionDetail />)
    expect(screen.queryByText('Speed Up')).toBeNull()
    expect(screen.queryByText('Cancel')).toBeNull()
  })

  it('should display gas info when available', () => {
    setupWalletStore({ selectedTxId: MOCK_TX.id, history: [MOCK_TX] })

    render(<TransactionDetail />)
    expect(screen.getByText('Gas Used')).toBeTruthy()
    expect(screen.getByText('21000')).toBeTruthy()
    expect(screen.getByText('Gas Price')).toBeTruthy()
  })

  it('should display block number', () => {
    setupWalletStore({ selectedTxId: MOCK_TX.id, history: [MOCK_TX] })

    render(<TransactionDetail />)
    expect(screen.getByText('Block')).toBeTruthy()
    expect(screen.getByText('12345678')).toBeTruthy()
  })

  it('should display UserOp hash when present', () => {
    const txWithUserOp = {
      ...MOCK_TX,
      userOpHash: '0x9999888877776666555544443333222211110000aaaa' as `0x${string}`,
    }
    setupWalletStore({ selectedTxId: MOCK_TX.id, history: [txWithUserOp] })

    render(<TransactionDetail />)
    expect(screen.getByText('UserOp Hash')).toBeTruthy()
  })

  it('should show View on Explorer link', () => {
    setupWalletStore({ selectedTxId: MOCK_TX.id, history: [MOCK_TX] })

    render(<TransactionDetail />)
    // View on Explorer appears as title attribute on buttons in stepper and details card
    const buttons = screen.getAllByTitle('View on Explorer')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('should not show explorer link when no explorerUrl', () => {
    setupWalletStore({ selectedTxId: MOCK_TX.id, history: [MOCK_TX] })
    mockSelectedNetwork.mockReturnValue({
      chainId: 1,
      name: 'Local',
      rpcUrl: 'http://localhost:8545',
      currency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    })

    render(<TransactionDetail />)
    expect(screen.queryByTitle('View on Explorer')).toBeNull()
  })

  it('should navigate to activity when back button is clicked', () => {
    setupWalletStore()

    render(<TransactionDetail />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(mockSetPage).toHaveBeenCalledWith('activity')
  })

  it('should call speed up RPC when Speed Up button is clicked', async () => {
    const pendingTx = { ...MOCK_TX, status: 'pending' as const }
    setupWalletStore({ selectedTxId: MOCK_TX.id, pendingTransactions: [pendingTx] })
    getSendMessage().mockResolvedValue({})

    render(<TransactionDetail />)
    fireEvent.click(screen.getByText('Speed Up'))

    await waitFor(() => {
      expect(getSendMessage()).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RPC_REQUEST',
          payload: expect.objectContaining({
            method: 'stablenet_speedUpTransaction',
            params: [{ hash: MOCK_TX.txHash }],
          }),
        })
      )
    })
  })

  it('should call cancel RPC when Cancel button is clicked', async () => {
    const pendingTx = { ...MOCK_TX, status: 'pending' as const }
    setupWalletStore({ selectedTxId: MOCK_TX.id, pendingTransactions: [pendingTx] })
    getSendMessage().mockResolvedValue({})

    render(<TransactionDetail />)
    fireEvent.click(screen.getByText('Cancel'))

    await waitFor(() => {
      expect(getSendMessage()).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RPC_REQUEST',
          payload: expect.objectContaining({
            method: 'stablenet_cancelTransaction',
            params: [{ hash: MOCK_TX.txHash }],
          }),
        })
      )
    })
  })

  it('should display formatted ETH value', () => {
    setupWalletStore({ selectedTxId: MOCK_TX.id, history: [MOCK_TX] })

    render(<TransactionDetail />)
    // 1000000000000000000 wei = 1 ETH
    expect(screen.getByText(/1\.000000 ETH/)).toBeTruthy()
  })

  it('should find tx in pendingTransactions first, then history', () => {
    const pendingTx = { ...MOCK_TX, status: 'submitted' as const }
    setupWalletStore({
      selectedTxId: MOCK_TX.id,
      pendingTransactions: [pendingTx],
      history: [MOCK_TX],
    })

    render(<TransactionDetail />)
    // Should find the pending (submitted) version first - stepper shows waiting message
    expect(screen.getByText('Waiting to be included in a block...')).toBeTruthy()
  })
})

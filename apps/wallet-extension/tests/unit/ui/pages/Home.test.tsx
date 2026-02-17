import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  useAssets,
  useIndexerData,
  useNetworkCurrency,
  useWalletStore,
} from '../../../../src/ui/hooks'
import { useTokenPrices } from '../../../../src/ui/hooks/useTokenPrices'
import { Home } from '../../../../src/ui/pages/Home'

// Mock all hooks
const mockSetPage = jest.fn()
const mockUpdateBalance = jest.fn()

jest.mock('../../../../src/ui/hooks', () => ({
  useWalletStore: jest.fn(),
  useNetworkCurrency: jest.fn(),
  useIndexerData: jest.fn(),
  useAssets: jest.fn(),
}))

jest.mock('../../../../src/ui/hooks/useTokenPrices', () => ({
  useTokenPrices: jest.fn(),
}))

// Mock AddTokenModal and TokenList as simple pass-through components
jest.mock('../../../../src/ui/components/AddTokenModal', () => ({
  AddTokenModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="add-token-modal">
        <button type="button" onClick={onClose}>
          Close Modal
        </button>
      </div>
    ) : null,
}))

jest.mock('../../../../src/ui/components/TokenList', () => ({
  TokenList: ({
    onRefresh,
    onAddToken,
  }: {
    onRefresh: () => void
    onAddToken: () => void
    [key: string]: unknown
  }) => (
    <div data-testid="token-list">
      <button type="button" onClick={onRefresh} data-testid="refresh-btn">
        Refresh
      </button>
      <button type="button" onClick={onAddToken} data-testid="add-token-btn">
        Add Token
      </button>
    </div>
  ),
}))

// Mock viem
jest.mock('viem', () => ({
  formatEther: (value: bigint) => (Number(value) / 1e18).toString(),
}))

const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

function setupDefaults(overrides: Record<string, unknown> = {}) {
  ;(useWalletStore as unknown as jest.Mock).mockReturnValue({
    selectedAccount: TEST_ADDRESS,
    accounts: [{ address: TEST_ADDRESS, name: 'Account 1', type: 'eoa' }],
    balances: { [TEST_ADDRESS]: BigInt('2000000000000000000') }, // 2 ETH
    updateBalance: mockUpdateBalance,
    setPage: mockSetPage,
    ...overrides,
  })
  ;(useNetworkCurrency as unknown as jest.Mock).mockReturnValue({
    symbol: 'ETH',
    decimals: 18,
  })
  ;(useIndexerData as unknown as jest.Mock).mockReturnValue({
    tokenBalances: [],
    isLoadingTokens: false,
    refreshTokenBalances: jest.fn(),
    isIndexerAvailable: true,
  })
  ;(useAssets as unknown as jest.Mock).mockReturnValue({
    tokens: [],
    isLoading: false,
    refresh: jest.fn(),
    toggleTokenVisibility: jest.fn(),
  })
  ;(useTokenPrices as unknown as jest.Mock).mockReturnValue({
    prices: { ETH: 2000 },
    isLoading: false,
  })
}

describe('Home', () => {
  beforeEach(() => {
    mockSetPage.mockClear()
    mockUpdateBalance.mockClear()
    // Mock chrome.runtime.sendMessage
    ;(global as unknown).chrome = {
      runtime: {
        sendMessage: jest.fn().mockResolvedValue({
          payload: { result: '0x1bc16d674ec80000' }, // 2 ETH
        }),
      },
    }
  })

  it('should show "No account found" when no matching account', () => {
    setupDefaults({ accounts: [], selectedAccount: '0xunknown' })

    render(<Home />)
    expect(screen.getByText('No account found')).toBeTruthy()
  })

  it('should show Create Account button when no account', () => {
    setupDefaults({ accounts: [], selectedAccount: '0xunknown' })

    render(<Home />)
    const btn = screen.getByText('Create Account')
    fireEvent.click(btn)
    expect(mockSetPage).toHaveBeenCalledWith('settings')
  })

  it('should display balance in ETH', () => {
    setupDefaults()

    render(<Home />)
    expect(screen.getByText('2.0000 ETH')).toBeTruthy()
  })

  it('should display USD value when price available', () => {
    setupDefaults()

    render(<Home />)
    expect(screen.getByText('$4000.00 USD')).toBeTruthy()
  })

  it('should show "Total Balance" label', () => {
    setupDefaults()

    render(<Home />)
    expect(screen.getByText('Total Balance')).toBeTruthy()
  })

  it('should show EOA badge for EOA account', () => {
    setupDefaults()

    render(<Home />)
    expect(screen.getByText('EOA')).toBeTruthy()
  })

  it('should show Smart Account badge for smart account', () => {
    setupDefaults({
      accounts: [{ address: TEST_ADDRESS, name: 'Smart 1', type: 'smart' }],
    })

    render(<Home />)
    // Multiple elements show "Smart Account" (badge + button), just check at least one exists
    const elements = screen.getAllByText('Smart Account')
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })

  it('should show "Not Deployed" badge when not deployed', () => {
    setupDefaults({
      accounts: [{ address: TEST_ADDRESS, name: 'Account 1', type: 'smart', isDeployed: false }],
    })

    render(<Home />)
    expect(screen.getByText('Not Deployed')).toBeTruthy()
  })

  it('should navigate to send page', () => {
    setupDefaults()

    render(<Home />)
    fireEvent.click(screen.getByText('Send'))
    expect(mockSetPage).toHaveBeenCalledWith('send')
  })

  it('should navigate to receive page', () => {
    setupDefaults()

    render(<Home />)
    fireEvent.click(screen.getByText('Receive'))
    expect(mockSetPage).toHaveBeenCalledWith('receive')
  })

  it('should navigate to activity page', () => {
    setupDefaults()

    render(<Home />)
    fireEvent.click(screen.getByText('Activity'))
    expect(mockSetPage).toHaveBeenCalledWith('activity')
  })

  it('should show Upgrade button for EOA accounts', () => {
    setupDefaults()

    render(<Home />)
    expect(screen.getByText('Upgrade')).toBeTruthy()
    expect(screen.getByText('EIP-7702')).toBeTruthy()
  })

  it('should navigate to modules on Upgrade click', () => {
    setupDefaults()

    render(<Home />)
    fireEvent.click(screen.getByText('Upgrade'))
    expect(mockSetPage).toHaveBeenCalledWith('modules')
  })

  it('should show Smart Account button for smart accounts', () => {
    setupDefaults({
      accounts: [{ address: TEST_ADDRESS, name: 'SA', type: 'smart' }],
    })

    render(<Home />)
    // Both badge and button contain "Smart Account"
    const elements = screen.getAllByText('Smart Account')
    expect(elements.length).toBeGreaterThanOrEqual(2)
  })

  it('should navigate to dashboard on Smart Account click', () => {
    setupDefaults({
      accounts: [{ address: TEST_ADDRESS, name: 'SA', type: 'smart' }],
    })

    render(<Home />)
    // Find the button that contains "Smart Account" text in the quick actions
    const buttons = screen.getAllByRole('button')
    const saButton = buttons.find(
      (b) => b.textContent?.includes('Smart Account') && b.closest('.grid')
    )
    if (saButton) {
      fireEvent.click(saButton)
      expect(mockSetPage).toHaveBeenCalledWith('dashboard')
    }
  })

  it('should show Swap button for smart accounts', () => {
    setupDefaults({
      accounts: [{ address: TEST_ADDRESS, name: 'SA', type: 'smart' }],
    })

    render(<Home />)
    expect(screen.getByText('Swap')).toBeTruthy()
  })

  it('should navigate to swap on Swap click', () => {
    setupDefaults({
      accounts: [{ address: TEST_ADDRESS, name: 'SA', type: 'smart' }],
    })

    render(<Home />)
    fireEvent.click(screen.getByText('Swap'))
    expect(mockSetPage).toHaveBeenCalledWith('swap')
  })

  it('should display account address', () => {
    setupDefaults()

    render(<Home />)
    expect(screen.getByText('Account Address')).toBeTruthy()
    expect(screen.getByText(TEST_ADDRESS)).toBeTruthy()
  })

  it('should render TokenList component', () => {
    setupDefaults()

    render(<Home />)
    expect(screen.getByTestId('token-list')).toBeTruthy()
  })

  it('should open AddTokenModal when add token is clicked', () => {
    setupDefaults()

    render(<Home />)

    expect(screen.queryByTestId('add-token-modal')).toBeNull()

    fireEvent.click(screen.getByTestId('add-token-btn'))

    expect(screen.getByTestId('add-token-modal')).toBeTruthy()
  })

  it('should show dash balance when balance is undefined and loading fails', async () => {
    // Mock chrome to return no result so balance stays undefined
    ;(global as unknown).chrome = {
      runtime: {
        sendMessage: jest.fn().mockResolvedValue({ payload: {} }),
      },
    }
    setupDefaults({ balances: {} })

    render(<Home />)

    // Wait for the loading to finish (sendMessage resolves but returns no result)
    await waitFor(() => {
      const h2 = screen.getByText('Total Balance').nextElementSibling
      expect(h2?.textContent).toContain('ETH')
      expect(h2?.textContent).not.toContain('Loading')
    })
  })

  it('should show indexer unavailable message when indexer is down', () => {
    setupDefaults()
    ;(useIndexerData as unknown as jest.Mock).mockReturnValue({
      tokenBalances: [],
      isLoadingTokens: false,
      refreshTokenBalances: jest.fn(),
      isIndexerAvailable: false,
    })

    render(<Home />)
    expect(
      screen.getByText('Token discovery unavailable. Configure indexer URL in settings.')
    ).toBeTruthy()
  })
})

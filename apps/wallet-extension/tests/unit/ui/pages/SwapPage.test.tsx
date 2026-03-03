import { fireEvent, render, screen } from '@testing-library/react'
import { useWalletStore } from '../../../../src/ui/hooks/useWalletStore'
import { SwapPage } from '../../../../src/ui/pages/SwapPage'

const mockSetPage = jest.fn()
const mockAssets = jest.fn()
const mockSelectedNetwork = jest.fn()
const mockTokenPrices = jest.fn()

jest.mock('../../../../src/ui/hooks/useWalletStore', () => ({
  useWalletStore: jest.fn(),
}))

jest.mock('../../../../src/ui/hooks', () => ({
  useAssets: () => mockAssets(),
  useSelectedNetwork: () => mockSelectedNetwork(),
  useNetworkCurrency: () => ({ symbol: 'ETH', decimals: 18 }),
}))

jest.mock('../../../../src/ui/hooks/useNetworkCurrency', () => ({
  useNetworkCurrency: () => ({ symbol: 'ETH', decimals: 18 }),
  useSelectedNetwork: () => mockSelectedNetwork(),
}))

jest.mock('../../../../src/ui/hooks/useTokenPrices', () => ({
  useTokenPrices: () => mockTokenPrices(),
}))

const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

function setupWalletStore(overrides: Record<string, unknown> = {}) {
  ;(useWalletStore as unknown as jest.Mock).mockReturnValue({
    selectedAccount: TEST_ADDRESS,
    accounts: [{ address: TEST_ADDRESS, type: 'smart', name: 'Account 1' }],
    balances: { [TEST_ADDRESS]: BigInt('2000000000000000000') }, // 2 ETH
    setPage: mockSetPage,
    ...overrides,
  })
}

function setupAssets(tokens: { address: string; symbol: string }[] = []) {
  mockAssets.mockReturnValue({
    tokens: tokens.map((t) => ({
      ...t,
      name: t.symbol,
      decimals: 18,
      balance: '0',
      formattedBalance: '0',
      isVisible: true,
    })),
  })
}

function setupNetwork(network = { chainId: 1, name: 'Mainnet' }) {
  mockSelectedNetwork.mockReturnValue(network)
}

function setupPrices(prices: Record<string, number> = {}) {
  mockTokenPrices.mockReturnValue({ prices, isLoading: false, totalValueUsd: 0 })
}

function getSendMessage() {
  return chrome.runtime.sendMessage as jest.Mock
}

describe('SwapPage', () => {
  beforeEach(() => {
    mockSetPage.mockClear()
    mockAssets.mockReset()
    mockSelectedNetwork.mockReset()
    mockTokenPrices.mockReset()
    setupNetwork()
    setupPrices({ ETH: 3000 })
    getSendMessage().mockResolvedValue({
      payload: { result: { modules: [] } },
    })
  })

  it('should render the swap page with header', () => {
    setupWalletStore()
    setupAssets()

    render(<SwapPage />)
    expect(screen.getByText('Swap')).toBeTruthy()
  })

  it('should show From and To sections', () => {
    setupWalletStore()
    setupAssets()

    render(<SwapPage />)
    expect(screen.getByText('From')).toBeTruthy()
    expect(screen.getByText('To (estimated)')).toBeTruthy()
  })

  it('should display slippage options', () => {
    setupWalletStore()
    setupAssets()

    render(<SwapPage />)
    expect(screen.getByText('Slippage Tolerance')).toBeTruthy()
    expect(screen.getByText('0.5%')).toBeTruthy()
    expect(screen.getByText('1%')).toBeTruthy()
    expect(screen.getByText('2%')).toBeTruthy()
  })

  it('should show "Swap module not installed" when no swap executor found', () => {
    setupWalletStore()
    setupAssets()

    render(<SwapPage />)
    expect(screen.getByText('Swap module not installed')).toBeTruthy()
  })

  it('should navigate back to home when back button clicked', () => {
    setupWalletStore()
    setupAssets()

    render(<SwapPage />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0]) // Back button
    expect(mockSetPage).toHaveBeenCalledWith('home')
  })

  it('should display available tokens in from/to selects', () => {
    setupWalletStore()
    setupAssets([
      { address: '0xUSDC', symbol: 'USDC' },
      { address: '0xDAI', symbol: 'DAI' },
    ])

    render(<SwapPage />)
    // Both selects should have the token options
    const options = screen.getAllByRole('option')
    const optionTexts = options.map((o) => o.textContent)
    expect(optionTexts).toContain('ETH')
    expect(optionTexts).toContain('USDC')
    expect(optionTexts).toContain('DAI')
  })

  it('should update from amount on input', () => {
    setupWalletStore()
    setupAssets()

    render(<SwapPage />)
    const inputs = screen.getAllByRole('textbox')
    const fromInput = inputs[0]
    fireEvent.change(fromInput, { target: { value: '1.5' } })
    expect(fromInput).toHaveValue('1.5')
  })

  it('should show smart account warning for non-smart accounts', () => {
    setupWalletStore({
      accounts: [{ address: TEST_ADDRESS, type: 'eoa', name: 'Account 1' }],
    })
    setupAssets()

    render(<SwapPage />)
    expect(screen.getByText(/Swap requires a Smart Account/)).toBeTruthy()
  })

  it('should not show smart account warning for smart accounts', () => {
    setupWalletStore()
    setupAssets()

    render(<SwapPage />)
    expect(screen.queryByText(/Swap requires a Smart Account/)).toBeNull()
  })

  it('should show Max button with balance when ETH selected', () => {
    setupWalletStore()
    setupAssets()

    render(<SwapPage />)
    // Max button shows balance: "Max: 2.0000"
    expect(screen.getByText(/Max:/)).toBeTruthy()
  })

  it('should disable swap button when no amount entered', () => {
    setupWalletStore()
    setupAssets()

    render(<SwapPage />)
    const swapButton = screen
      .getAllByRole('button')
      .find(
        (b) =>
          b.textContent === 'Swap module not installed' ||
          b.textContent === 'Smart Account required' ||
          b.textContent === 'Select a token' ||
          b.textContent === 'Enter an amount' ||
          b.textContent === 'Swap'
      )
    expect(swapButton).toBeTruthy()
    expect(swapButton).toBeDisabled()
  })
})

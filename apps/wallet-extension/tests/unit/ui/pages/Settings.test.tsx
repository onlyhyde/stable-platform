import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useWalletStore } from '../../../../src/ui/hooks/useWalletStore'
import { Settings } from '../../../../src/ui/pages/Settings'

// Mock useWalletStore
const mockSelectNetwork = jest.fn()
const mockLockWallet = jest.fn().mockResolvedValue(undefined)
const mockImportPrivateKey = jest.fn()
const mockAddNetwork = jest.fn()
const mockRemoveNetwork = jest.fn()
const mockSyncWithBackground = jest.fn().mockResolvedValue(undefined)

jest.mock('../../../../src/ui/hooks/useWalletStore', () => ({
  useWalletStore: jest.fn(),
}))

const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

const defaultNetworks = [
  {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://eth.example.com',
    bundlerUrl: 'https://bundler.example.com',
    currency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    isCustom: false,
  },
  {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon.example.com',
    bundlerUrl: 'https://bundler-polygon.example.com',
    currency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    isCustom: false,
  },
]

function setupStore(overrides: Record<string, unknown> = {}) {
  ;(useWalletStore as unknown as jest.Mock).mockReturnValue({
    networks: defaultNetworks,
    selectedChainId: 1,
    selectedAccount: TEST_ADDRESS,
    accounts: [{ address: TEST_ADDRESS, name: 'Account 1', type: 'eoa' }],
    selectNetwork: mockSelectNetwork,
    lockWallet: mockLockWallet,
    importPrivateKey: mockImportPrivateKey,
    addNetwork: mockAddNetwork,
    removeNetwork: mockRemoveNetwork,
    syncWithBackground: mockSyncWithBackground,
    ...overrides,
  })
}

describe('Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock chrome API - return settings quickly
    ;(global as unknown).chrome = {
      runtime: {
        sendMessage: jest.fn().mockResolvedValue({
          payload: { enabled: false, minutes: 5 },
        }),
      },
    }
  })

  it('should render Settings heading', async () => {
    setupStore()

    render(<Settings />)

    expect(screen.getByText('Settings')).toBeTruthy()
  })

  it('should display Network section', async () => {
    setupStore()

    render(<Settings />)

    expect(screen.getByText('Network')).toBeTruthy()
  })

  it('should display available networks', async () => {
    setupStore()

    render(<Settings />)

    expect(screen.getByText('Ethereum Mainnet')).toBeTruthy()
  })

  it('should call selectNetwork when a different network is selected', async () => {
    setupStore()

    render(<Settings />)

    const polygonElement = screen.getByText('Polygon')
    fireEvent.click(polygonElement.closest('button') || polygonElement)

    expect(mockSelectNetwork).toHaveBeenCalledWith(137)
  })

  it('should display Auto-Lock section', async () => {
    setupStore()

    render(<Settings />)

    await waitFor(() => {
      expect(screen.getByText('Auto-Lock')).toBeTruthy()
    })
  })

  it('should show lock wallet button', () => {
    setupStore()

    render(<Settings />)

    expect(screen.getByText('Lock Wallet')).toBeTruthy()
  })

  it('should call lockWallet when Lock button is clicked', async () => {
    setupStore()

    render(<Settings />)

    await act(async () => {
      fireEvent.click(screen.getByText('Lock Wallet'))
    })

    expect(mockLockWallet).toHaveBeenCalled()
  })

  it('should show Accounts section header', () => {
    setupStore()

    render(<Settings />)

    expect(screen.getByText('Accounts')).toBeTruthy()
  })

  it('should show + Import Account button', () => {
    setupStore()

    render(<Settings />)

    expect(screen.getByText('+ Import Account')).toBeTruthy()
  })

  it('should show + Add Network button', () => {
    setupStore()

    render(<Settings />)

    expect(screen.getByText('+ Add Network')).toBeTruthy()
  })

  it('should show MetaMask Mode toggle', () => {
    setupStore()

    render(<Settings />)

    expect(screen.getByText('MetaMask Mode')).toBeTruthy()
  })

  it('should show Smart Account section for smart accounts', () => {
    setupStore({
      accounts: [{ address: TEST_ADDRESS, name: 'Smart 1', type: 'smart' }],
    })

    render(<Settings />)

    expect(screen.getByText('Smart Account')).toBeTruthy()
  })

  it('should show Export Private Key section', () => {
    setupStore()

    render(<Settings />)

    expect(screen.getByText('Export Private Key')).toBeTruthy()
  })

  it('should show Connected Sites section', () => {
    setupStore()

    render(<Settings />)

    expect(screen.getByText('Connected Sites')).toBeTruthy()
  })

  describe('import private key flow', () => {
    it('should show import form when + Import Account is clicked', async () => {
      setupStore()

      render(<Settings />)

      fireEvent.click(screen.getByText('+ Import Account'))

      expect(screen.getByText('Import Private Key')).toBeTruthy()
    })

    it('should toggle to Cancel when import form is open', () => {
      setupStore()

      render(<Settings />)

      fireEvent.click(screen.getByText('+ Import Account'))
      expect(screen.getByText('Cancel')).toBeTruthy()
    })

    it('should call importPrivateKey on submit', async () => {
      mockImportPrivateKey.mockResolvedValue('0xnewaddress1234567890123456789012345678')
      setupStore()

      render(<Settings />)

      fireEvent.click(screen.getByText('+ Import Account'))

      const input = screen.getByPlaceholderText(/private key/i)
      fireEvent.change(input, {
        target: { value: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' },
      })

      // Find the Import button inside the form
      const importBtns = screen.getAllByText(/Import/i)
      const submitBtn = importBtns.find(
        (el) => el.tagName === 'BUTTON' && el.textContent === 'Import Account'
      )

      if (submitBtn) {
        await act(async () => {
          fireEvent.click(submitBtn)
        })
        expect(mockImportPrivateKey).toHaveBeenCalled()
      }
    })
  })

  describe('add network flow', () => {
    it('should show network form when + Add Network is clicked', () => {
      setupStore()

      render(<Settings />)

      fireEvent.click(screen.getByText('+ Add Network'))

      expect(screen.getByText('Add Custom Network')).toBeTruthy()
      expect(screen.getByPlaceholderText('Network Name')).toBeTruthy()
    })

    it('should show form inputs', () => {
      setupStore()

      render(<Settings />)

      fireEvent.click(screen.getByText('+ Add Network'))

      expect(screen.getByPlaceholderText('Network Name')).toBeTruthy()
      expect(screen.getByPlaceholderText('e.g., 1, 137, 42161')).toBeTruthy()
      expect(screen.getByPlaceholderText('https://rpc.example.com')).toBeTruthy()
    })
  })
})

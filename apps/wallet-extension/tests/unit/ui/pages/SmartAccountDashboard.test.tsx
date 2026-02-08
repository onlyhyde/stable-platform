import { fireEvent, render, screen } from '@testing-library/react'
import { useWalletStore } from '../../../../src/ui/hooks/useWalletStore'
import { SmartAccountDashboard } from '../../../../src/ui/pages/SmartAccountDashboard'

// Mock the hooks used by the dashboard
const mockSetPage = jest.fn()
const mockSmartAccountInfo = jest.fn()
const mockModulesData = jest.fn()

jest.mock('../../../../src/ui/hooks/useWalletStore', () => ({
  useWalletStore: jest.fn(),
}))

jest.mock('../../../../src/ui/pages/Modules/hooks/useSmartAccountInfo', () => ({
  useSmartAccountInfo: (...args: unknown[]) => mockSmartAccountInfo(...args),
}))

jest.mock('../../../../src/ui/pages/Modules/hooks/useModules', () => ({
  useModules: (...args: unknown[]) => mockModulesData(...args),
}))

const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

function setupWalletStore(overrides: Record<string, unknown> = {}) {
  ;(useWalletStore as unknown as jest.Mock).mockReturnValue({
    selectedAccount: TEST_ADDRESS,
    accounts: [{ address: TEST_ADDRESS, type: 'smart', name: 'Account 1' }],
    setPage: mockSetPage,
    ...overrides,
  })
}

describe('SmartAccountDashboard', () => {
  beforeEach(() => {
    mockSetPage.mockClear()
    mockSmartAccountInfo.mockReset()
    mockModulesData.mockReset()
  })

  it('should show "No account selected" when no current account', () => {
    setupWalletStore({ accounts: [], selectedAccount: '0xnonexistent' })
    mockSmartAccountInfo.mockReturnValue({ info: null, isLoading: false })
    mockModulesData.mockReturnValue({ installedModules: null, isLoading: false })

    render(<SmartAccountDashboard />)
    expect(screen.getByText('No account selected')).toBeTruthy()
  })

  it('should display Smart Account Active badge when type is smart', () => {
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'smart',
        isDeployed: true,
        rootValidator: '0xvalidator',
        accountId: 'kernel.v0.3.3',
        delegationTarget: null,
        isDelegated: false,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({ installedModules: [], isLoading: false })

    render(<SmartAccountDashboard />)
    expect(screen.getByText('Smart Account Active')).toBeTruthy()
    expect(screen.getByText('Deployed')).toBeTruthy()
  })

  it('should display EOA badge when account type is eoa', () => {
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'eoa',
        isDeployed: false,
        rootValidator: null,
        accountId: null,
        delegationTarget: null,
        isDelegated: false,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({ installedModules: null, isLoading: false })

    render(<SmartAccountDashboard />)
    expect(screen.getByText('EOA')).toBeTruthy()
  })

  it('should display Delegated badge for delegated accounts', () => {
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'delegated',
        isDeployed: false,
        rootValidator: null,
        accountId: null,
        delegationTarget: '0xdelegate',
        isDelegated: true,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({ installedModules: [], isLoading: false })

    render(<SmartAccountDashboard />)
    expect(screen.getByText('Delegated (EIP-7702)')).toBeTruthy()
  })

  it('should show loading state', () => {
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({ info: null, isLoading: true })
    mockModulesData.mockReturnValue({ installedModules: null, isLoading: true })

    render(<SmartAccountDashboard />)
    expect(screen.getByText('...')).toBeTruthy()
  })

  it('should count installed modules by type', () => {
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'smart',
        isDeployed: true,
        rootValidator: '0xv',
        accountId: null,
        delegationTarget: null,
        isDelegated: false,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({
      installedModules: [
        { type: 1n },
        { type: 1n }, // 2 validators
        { type: 2n }, // 1 executor
        { type: 4n },
        { type: 4n },
        { type: 4n }, // 3 hooks
        // 0 fallbacks
      ],
      isLoading: false,
    })

    render(<SmartAccountDashboard />)
    expect(screen.getByText('Validators')).toBeTruthy()
    expect(screen.getByText('Executors')).toBeTruthy()
    expect(screen.getByText('Hooks')).toBeTruthy()
    expect(screen.getByText('Fallbacks')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy() // validators
    expect(screen.getByText('1')).toBeTruthy() // executors
    expect(screen.getByText('3')).toBeTruthy() // hooks
  })

  it('should navigate to home when back button is clicked', () => {
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'eoa',
        isDeployed: false,
        rootValidator: null,
        accountId: null,
        delegationTarget: null,
        isDelegated: false,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({ installedModules: null, isLoading: false })

    render(<SmartAccountDashboard />)
    // The back button is the first button element
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(mockSetPage).toHaveBeenCalledWith('home')
  })

  it('should navigate to modules when Install Module is clicked', () => {
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'smart',
        isDeployed: true,
        rootValidator: '0xv',
        accountId: null,
        delegationTarget: null,
        isDelegated: false,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({ installedModules: [], isLoading: false })

    render(<SmartAccountDashboard />)
    fireEvent.click(screen.getByText('Install Module'))
    expect(mockSetPage).toHaveBeenCalledWith('modules')
  })

  it('should navigate to activity when View Activity is clicked', () => {
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'smart',
        isDeployed: true,
        rootValidator: '0xv',
        accountId: null,
        delegationTarget: null,
        isDelegated: false,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({ installedModules: [], isLoading: false })

    render(<SmartAccountDashboard />)
    fireEvent.click(screen.getByText('View Activity'))
    expect(mockSetPage).toHaveBeenCalledWith('activity')
  })

  it('should show Enable Delegation button for EOA accounts', () => {
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'eoa',
        isDeployed: false,
        rootValidator: null,
        accountId: null,
        delegationTarget: null,
        isDelegated: false,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({ installedModules: null, isLoading: false })

    render(<SmartAccountDashboard />)
    expect(screen.getByText('Enable Delegation')).toBeTruthy()
    expect(screen.getByText('Upgrade via EIP-7702')).toBeTruthy()
  })

  it('should display account address', () => {
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'eoa',
        isDeployed: false,
        rootValidator: null,
        accountId: null,
        delegationTarget: null,
        isDelegated: false,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({ installedModules: null, isLoading: false })

    render(<SmartAccountDashboard />)
    expect(screen.getByText(TEST_ADDRESS)).toBeTruthy()
  })

  it('should display delegation target when delegated', () => {
    const delegationTarget = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'delegated',
        isDeployed: false,
        rootValidator: null,
        accountId: null,
        delegationTarget,
        isDelegated: true,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({ installedModules: [], isLoading: false })

    render(<SmartAccountDashboard />)
    expect(screen.getByText('Delegation Target')).toBeTruthy()
    // Truncated address: 0xabcd...abcd
    expect(screen.getByText('0xabcd...abcd')).toBeTruthy()
  })

  it('should display root validator info', () => {
    const rootValidator = '0x1111222233334444555566667777888899990000'
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'smart',
        isDeployed: true,
        rootValidator,
        accountId: null,
        delegationTarget: null,
        isDelegated: false,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({ installedModules: [], isLoading: false })

    render(<SmartAccountDashboard />)
    expect(screen.getByText('Root Validator')).toBeTruthy()
    expect(screen.getByText('0x1111...0000')).toBeTruthy()
    expect(screen.getByText('Change')).toBeTruthy()
  })

  it('should navigate to settings when Change validator is clicked', () => {
    const rootValidator = '0x1111222233334444555566667777888899990000'
    setupWalletStore()
    mockSmartAccountInfo.mockReturnValue({
      info: {
        accountType: 'smart',
        isDeployed: true,
        rootValidator,
        accountId: null,
        delegationTarget: null,
        isDelegated: false,
      },
      isLoading: false,
    })
    mockModulesData.mockReturnValue({ installedModules: [], isLoading: false })

    render(<SmartAccountDashboard />)
    fireEvent.click(screen.getByText('Change'))
    expect(mockSetPage).toHaveBeenCalledWith('settings')
  })
})

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useWalletStore } from '../../../../src/ui/hooks/useWalletStore'
import { Receive } from '../../../../src/ui/pages/Receive'

jest.mock('../../../../src/ui/hooks/useWalletStore', () => ({
  useWalletStore: jest.fn(),
}))

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mock'),
}))

const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

function setupStore(overrides: Record<string, unknown> = {}) {
  ;(useWalletStore as unknown as jest.Mock).mockReturnValue({
    selectedAccount: TEST_ADDRESS,
    accounts: [{ address: TEST_ADDRESS, name: 'Account 1', type: 'eoa' }],
    ...overrides,
  })
}

describe('Receive', () => {
  let mockWriteText: jest.Mock

  beforeEach(() => {
    mockWriteText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    })
  })

  it('should show "No account selected" when no matching account', () => {
    setupStore({ accounts: [], selectedAccount: '0xunknown' })

    render(<Receive />)
    expect(screen.getByText('No account found')).toBeTruthy()
  })

  it('should display Receive heading', () => {
    setupStore()

    render(<Receive />)
    expect(screen.getByText('Receive')).toBeTruthy()
  })

  it('should display the account address', () => {
    setupStore()

    render(<Receive />)
    expect(screen.getByText(TEST_ADDRESS)).toBeTruthy()
  })

  it('should display QR Code image', async () => {
    setupStore()

    render(<Receive />)
    await waitFor(() => {
      expect(screen.getByAltText('Wallet address QR code')).toBeTruthy()
    })
  })

  it('should display "Account Address" label', () => {
    setupStore()

    render(<Receive />)
    expect(screen.getByText('Account Address')).toBeTruthy()
  })

  it('should show copy address button', () => {
    setupStore()

    render(<Receive />)
    expect(screen.getByText('Copy address')).toBeTruthy()
  })

  it('should copy address to clipboard when button is clicked', async () => {
    setupStore()
    jest.useFakeTimers()

    render(<Receive />)

    fireEvent.click(screen.getByText('Copy address'))

    expect(mockWriteText).toHaveBeenCalledWith(TEST_ADDRESS)

    jest.useRealTimers()
  })

  it('should show "Copied!" after clicking copy', async () => {
    setupStore()

    render(<Receive />)

    await act(async () => {
      fireEvent.click(screen.getByText('Copy address'))
    })

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeTruthy()
    })
  })

  it('should show network warning message', () => {
    setupStore()

    render(<Receive />)
    expect(
      screen.getByText(
        'Only send assets on the same network. Sending to a different network may result in loss of funds.'
      )
    ).toBeTruthy()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Lock } from '../../../../src/ui/pages/Lock'

// Mock the common components
jest.mock('../../../../src/ui/components/common', () => ({
  Button: ({
    children,
    type,
    fullWidth,
    isLoading,
    disabled,
    ...rest
  }: {
    children: React.ReactNode
    type?: string
    fullWidth?: boolean
    isLoading?: boolean
    disabled?: boolean
  }) => (
    <button type={type as 'submit'} disabled={disabled || isLoading} {...rest}>
      {isLoading ? 'Loading...' : children}
    </button>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Input: ({
    type,
    value,
    onChange,
    placeholder,
    error,
    rightElement,
    ...rest
  }: {
    type?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    error?: string
    rightElement?: React.ReactNode
    autoFocus?: boolean
  }) => (
    <div>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        data-testid="password-input"
        {...rest}
      />
      {rightElement}
      {error && <span data-testid="input-error">{error}</span>}
    </div>
  ),
}))

describe('Lock', () => {
  const mockOnUnlock = jest.fn()

  beforeEach(() => {
    mockOnUnlock.mockReset()
  })

  it('should render the lock screen with branding', () => {
    render(<Lock onUnlock={mockOnUnlock} />)

    expect(screen.getByText('Welcome Back')).toBeTruthy()
    expect(screen.getByText('Enter your password to unlock')).toBeTruthy()
    expect(screen.getByText('S')).toBeTruthy() // Logo
  })

  it('should render password input', () => {
    render(<Lock onUnlock={mockOnUnlock} />)

    const input = screen.getByTestId('password-input')
    expect(input).toBeTruthy()
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('placeholder', 'Enter password')
  })

  it('should disable submit button when password is empty', () => {
    render(<Lock onUnlock={mockOnUnlock} />)

    const button = screen.getByText('Unlock')
    expect(button).toBeDisabled()
  })

  it('should enable submit button when password is entered', () => {
    render(<Lock onUnlock={mockOnUnlock} />)

    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'mypassword' },
    })

    const button = screen.getByText('Unlock')
    expect(button).not.toBeDisabled()
  })

  it('should call onUnlock when form is submitted', async () => {
    mockOnUnlock.mockResolvedValue(undefined)

    render(<Lock onUnlock={mockOnUnlock} />)

    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'testpassword' },
    })

    fireEvent.submit(screen.getByTestId('password-input').closest('form')!)

    await waitFor(() => {
      expect(mockOnUnlock).toHaveBeenCalledWith('testpassword')
    })
  })

  it('should not submit when password is empty', () => {
    render(<Lock onUnlock={mockOnUnlock} />)

    fireEvent.submit(screen.getByTestId('password-input').closest('form')!)

    expect(mockOnUnlock).not.toHaveBeenCalled()
  })

  it('should display error from onUnlock failure', async () => {
    mockOnUnlock.mockRejectedValue(new Error('Wrong password'))

    render(<Lock onUnlock={mockOnUnlock} />)

    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'wrongpass' },
    })

    fireEvent.submit(screen.getByTestId('password-input').closest('form')!)

    await waitFor(() => {
      expect(screen.getByTestId('input-error')).toBeTruthy()
      expect(screen.getByText('Wrong password')).toBeTruthy()
    })
  })

  it('should display prop error', () => {
    render(<Lock onUnlock={mockOnUnlock} error="Account locked" />)

    expect(screen.getByText('Account locked')).toBeTruthy()
  })

  it('should toggle password visibility', () => {
    render(<Lock onUnlock={mockOnUnlock} />)

    const input = screen.getByTestId('password-input')
    expect(input).toHaveAttribute('type', 'password')

    // Click the show/hide toggle button
    const toggleButtons = screen.getAllByRole('button')
    const toggleBtn = toggleButtons.find(
      (b) => b.getAttribute('type') === 'button' && b.closest('div')?.contains(input)
    )
    if (toggleBtn) {
      fireEvent.click(toggleBtn)
      expect(input).toHaveAttribute('type', 'text')
    }
  })

  it('should show forgot password link', () => {
    render(<Lock onUnlock={mockOnUnlock} />)
    expect(screen.getByText('Forgot password?')).toBeTruthy()
  })

  it('should show recovery phrase info', () => {
    render(<Lock onUnlock={mockOnUnlock} />)
    expect(
      screen.getByText(
        'If you forgot your password, you can restore your wallet using your recovery phrase.'
      )
    ).toBeTruthy()
  })
})

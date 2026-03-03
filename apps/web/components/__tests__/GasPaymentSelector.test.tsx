import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// ============================================================================
// F-03: GasPaymentSelector UI component
// RED phase — component does not exist yet
// ============================================================================

vi.mock('wagmi', () => ({
  useChainId: () => 8283,
}))

describe('F-03: GasPaymentSelector', () => {
  it('should render all 3 gas payment options for Smart Account', async () => {
    const { GasPaymentSelector } = await import(
      '@/components/payment/GasPaymentSelector'
    )
    const onModeChange = vi.fn()

    render(
      <GasPaymentSelector
        selectedMode="sponsored"
        availableModes={['self-pay', 'erc20-paymaster', 'sponsored']}
        onModeChange={onModeChange}
        depositBalance="0.5"
      />
    )

    expect(screen.getByText('Self-Pay')).toBeDefined()
    expect(screen.getByText('Pay with Token')).toBeDefined()
    expect(screen.getByText('Sponsored')).toBeDefined()
  })

  it('should disable unavailable modes for EOA', async () => {
    const { GasPaymentSelector } = await import(
      '@/components/payment/GasPaymentSelector'
    )
    const onModeChange = vi.fn()

    render(
      <GasPaymentSelector
        selectedMode="self-pay"
        availableModes={['self-pay']}
        onModeChange={onModeChange}
      />
    )

    // Self-pay should be enabled
    const selfPayOption = screen.getByTestId('gas-mode-self-pay')
    expect(selfPayOption).toBeDefined()
    expect(selfPayOption.getAttribute('aria-disabled')).not.toBe('true')

    // ERC-20 and sponsored should be disabled
    const erc20Option = screen.getByTestId('gas-mode-erc20-paymaster')
    expect(erc20Option.getAttribute('aria-disabled')).toBe('true')

    const sponsoredOption = screen.getByTestId('gas-mode-sponsored')
    expect(sponsoredOption.getAttribute('aria-disabled')).toBe('true')
  })

  it('should call onModeChange when option clicked', async () => {
    const { GasPaymentSelector } = await import(
      '@/components/payment/GasPaymentSelector'
    )
    const onModeChange = vi.fn()
    const user = userEvent.setup()

    render(
      <GasPaymentSelector
        selectedMode="sponsored"
        availableModes={['self-pay', 'erc20-paymaster', 'sponsored']}
        onModeChange={onModeChange}
      />
    )

    await user.click(screen.getByTestId('gas-mode-self-pay'))

    expect(onModeChange).toHaveBeenCalledWith('self-pay')
  })

  it('should NOT call onModeChange when disabled option clicked', async () => {
    const { GasPaymentSelector } = await import(
      '@/components/payment/GasPaymentSelector'
    )
    const onModeChange = vi.fn()
    const user = userEvent.setup()

    render(
      <GasPaymentSelector
        selectedMode="self-pay"
        availableModes={['self-pay']}
        onModeChange={onModeChange}
      />
    )

    await user.click(screen.getByTestId('gas-mode-erc20-paymaster'))

    expect(onModeChange).not.toHaveBeenCalled()
  })

  it('should show deposit balance when provided', async () => {
    const { GasPaymentSelector } = await import(
      '@/components/payment/GasPaymentSelector'
    )

    render(
      <GasPaymentSelector
        selectedMode="self-pay"
        availableModes={['self-pay', 'erc20-paymaster', 'sponsored']}
        onModeChange={vi.fn()}
        depositBalance="1.5"
      />
    )

    expect(screen.getByText(/1\.5/)).toBeDefined()
  })

  it('should highlight selected mode', async () => {
    const { GasPaymentSelector } = await import(
      '@/components/payment/GasPaymentSelector'
    )

    render(
      <GasPaymentSelector
        selectedMode="erc20-paymaster"
        availableModes={['self-pay', 'erc20-paymaster', 'sponsored']}
        onModeChange={vi.fn()}
      />
    )

    const erc20Option = screen.getByTestId('gas-mode-erc20-paymaster')
    expect(erc20Option.getAttribute('aria-selected')).toBe('true')

    const selfPayOption = screen.getByTestId('gas-mode-self-pay')
    expect(selfPayOption.getAttribute('aria-selected')).toBe('false')
  })
})

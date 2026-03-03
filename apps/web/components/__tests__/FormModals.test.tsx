import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pool, Token } from '@/types'
import { AddLiquidityModal } from '../defi/cards/AddLiquidityModal'
import { AddEmployeeModal } from '../enterprise/cards/AddEmployeeModal'
import { SubmitExpenseModal } from '../enterprise/cards/SubmitExpenseModal'

describe('AddEmployeeModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should capture wallet address input', async () => {
    render(<AddEmployeeModal {...defaultProps} />)

    const input = screen.getByLabelText(/wallet address/i)
    await userEvent.type(input, '0x1234567890123456789012345678901234567890')

    expect(input).toHaveValue('0x1234567890123456789012345678901234567890')
  })

  it('should capture payment amount input', async () => {
    render(<AddEmployeeModal {...defaultProps} />)

    const input = screen.getByLabelText(/payment amount/i)
    await userEvent.type(input, '1000')

    expect(input).toHaveValue(1000)
  })

  it('should capture frequency selection', async () => {
    render(<AddEmployeeModal {...defaultProps} />)

    const select = screen.getByLabelText(/payment frequency/i)
    await userEvent.selectOptions(select, 'monthly')

    expect(select).toHaveValue('monthly')
  })

  it('should submit form with captured data', async () => {
    const onSubmit = vi.fn()
    render(<AddEmployeeModal {...defaultProps} onSubmit={onSubmit} />)

    const walletInput = screen.getByLabelText(/wallet address/i)
    const amountInput = screen.getByLabelText(/payment amount/i)
    const frequencySelect = screen.getByLabelText(/payment frequency/i)

    // Use valid Ethereum address (40 hex chars after 0x)
    await userEvent.type(walletInput, '0x1234567890123456789012345678901234567890')
    await userEvent.type(amountInput, '500')
    await userEvent.selectOptions(frequencySelect, 'biweekly')

    const submitButton = screen.getByRole('button', { name: /add employee/i })
    await userEvent.click(submitButton)

    expect(onSubmit).toHaveBeenCalledWith({
      walletAddress: '0x1234567890123456789012345678901234567890',
      amount: '500',
      frequency: 'biweekly',
    })
  })

  it('should validate wallet address format', async () => {
    render(<AddEmployeeModal {...defaultProps} />)

    const walletInput = screen.getByLabelText(/wallet address/i)
    await userEvent.type(walletInput, 'invalid')

    const submitButton = screen.getByRole('button', { name: /add employee/i })
    await userEvent.click(submitButton)

    // Should show validation error or not call onSubmit
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('should clear form on close', async () => {
    const { rerender } = render(<AddEmployeeModal {...defaultProps} />)

    const walletInput = screen.getByLabelText(/wallet address/i)
    await userEvent.type(walletInput, '0x1234')

    // Close and reopen
    rerender(<AddEmployeeModal {...defaultProps} isOpen={false} />)
    rerender(<AddEmployeeModal {...defaultProps} isOpen={true} />)

    const newWalletInput = screen.getByLabelText(/wallet address/i)
    expect(newWalletInput).toHaveValue('')
  })
})

describe('SubmitExpenseModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should capture description input', async () => {
    render(<SubmitExpenseModal {...defaultProps} />)

    const input = screen.getByLabelText(/description/i)
    await userEvent.type(input, 'Office supplies')

    expect(input).toHaveValue('Office supplies')
  })

  it('should capture amount input', async () => {
    render(<SubmitExpenseModal {...defaultProps} />)

    const input = screen.getByLabelText(/amount/i)
    await userEvent.type(input, '250.50')

    expect(input).toHaveValue(250.5)
  })

  it('should capture category selection', async () => {
    render(<SubmitExpenseModal {...defaultProps} />)

    const select = screen.getByLabelText(/category/i)
    await userEvent.selectOptions(select, 'software')

    expect(select).toHaveValue('software')
  })

  it('should capture documentation URL input', async () => {
    render(<SubmitExpenseModal {...defaultProps} />)

    const input = screen.getByLabelText(/receipt|documentation/i)
    await userEvent.type(input, 'https://example.com/receipt.pdf')

    expect(input).toHaveValue('https://example.com/receipt.pdf')
  })

  it('should submit form with captured data', async () => {
    const onSubmit = vi.fn()
    render(<SubmitExpenseModal {...defaultProps} onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText(/description/i), 'Test expense')
    await userEvent.type(screen.getByLabelText(/amount/i), '100')
    await userEvent.selectOptions(screen.getByLabelText(/category/i), 'travel')
    await userEvent.type(screen.getByLabelText(/receipt|documentation/i), 'https://receipt.com')

    await userEvent.click(screen.getByRole('button', { name: /submit expense/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      description: 'Test expense',
      amount: '100',
      category: 'travel',
      documentationUrl: 'https://receipt.com',
    })
  })

  it('should require description', async () => {
    render(<SubmitExpenseModal {...defaultProps} />)

    await userEvent.type(screen.getByLabelText(/amount/i), '100')
    await userEvent.click(screen.getByRole('button', { name: /submit expense/i }))

    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })
})

describe('AddLiquidityModal', () => {
  const mockToken0: Token = {
    address: '0x0000000000000000000000000000000000000000',
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  }

  const mockToken1: Token = {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
  }

  const mockPool: Pool = {
    address: '0x1234567890123456789012345678901234567890',
    token0: mockToken0,
    token1: mockToken1,
    reserve0: BigInt('1000000000000000000000'),
    reserve1: BigInt('2500000000000'),
    fee: 0.3,
    tvl: 5000000,
    apr: 12.5,
  }

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    selectedPool: mockPool,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should capture token0 amount input', async () => {
    render(<AddLiquidityModal {...defaultProps} />)

    const input = screen.getByLabelText(/eth amount/i)
    await userEvent.type(input, '1.5')

    expect(input).toHaveValue(1.5)
  })

  it('should capture token1 amount input', async () => {
    render(<AddLiquidityModal {...defaultProps} />)

    const input = screen.getByLabelText(/usdc amount/i)
    await userEvent.type(input, '2500')

    expect(input).toHaveValue(2500)
  })

  it('should calculate pool share when amounts entered', async () => {
    render(<AddLiquidityModal {...defaultProps} />)

    await userEvent.type(screen.getByLabelText(/eth amount/i), '10')
    await userEvent.type(screen.getByLabelText(/usdc amount/i), '25000')

    // Pool share should be calculated and displayed
    const poolShareElement = screen.getByText(/pool share/i).nextElementSibling
    expect(poolShareElement?.textContent).not.toBe('0.00%')
  })

  it('should submit form with captured liquidity data', async () => {
    const onSubmit = vi.fn()
    render(<AddLiquidityModal {...defaultProps} onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText(/eth amount/i), '1')
    await userEvent.type(screen.getByLabelText(/usdc amount/i), '2500')

    await userEvent.click(screen.getByRole('button', { name: /add liquidity/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      token0Amount: '1',
      token1Amount: '2500',
      poolAddress: mockPool.address,
      slippageBps: 50,
    })
  })

  it('should show loading state during submission', async () => {
    const onSubmit = vi
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)))
    render(<AddLiquidityModal {...defaultProps} onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText(/eth amount/i), '1')
    await userEvent.type(screen.getByLabelText(/usdc amount/i), '2500')

    const submitButton = screen.getByRole('button', { name: /add liquidity/i })
    await userEvent.click(submitButton)

    expect(submitButton).toBeDisabled()
  })

  it('should disable submit when amounts are empty', () => {
    render(<AddLiquidityModal {...defaultProps} />)

    const submitButton = screen.getByRole('button', { name: /add liquidity/i })
    expect(submitButton).toBeDisabled()
  })

  it('should not render form when no pool selected', () => {
    render(<AddLiquidityModal {...defaultProps} selectedPool={null} />)

    expect(screen.queryByLabelText(/eth amount/i)).not.toBeInTheDocument()
    expect(screen.getByText(/select a pool/i)).toBeInTheDocument()
  })
})

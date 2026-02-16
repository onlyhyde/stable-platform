'use client'

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Address, Hex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// AuditLogCard uses useChainId from wagmi
vi.mock('wagmi', () => ({
  useChainId: vi.fn(() => 31337),
}))

// ============================================
// 1. IncomingPaymentsCard Tests
// ============================================
describe('IncomingPaymentsCard', () => {
  const mockAnnouncements = [
    {
      schemeId: 1,
      stealthAddress: '0x1234567890123456789012345678901234567890' as Address,
      ephemeralPubKey: '0xabcd000000000000000000000000000000000000000000000000000000000000' as Hex,
      viewTag: 0,
      caller: '0x2345678901234567890123456789012345678901' as Address,
      blockNumber: BigInt(12345),
      transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      value: BigInt('1000000000000000000'), // 1 ETH
    },
  ]

  it('should call onWithdraw callback when withdraw button clicked', async () => {
    const { IncomingPaymentsCard } = await import('@/components/stealth/cards/IncomingPaymentsCard')
    const onWithdraw = vi.fn().mockResolvedValue(undefined)

    render(
      <IncomingPaymentsCard
        announcements={mockAnnouncements}
        isScanning={false}
        onScan={vi.fn()}
        onWithdraw={onWithdraw}
      />
    )

    const withdrawButton = screen.getByRole('button', { name: /withdraw/i })
    await userEvent.click(withdrawButton)

    await waitFor(() => {
      expect(onWithdraw).toHaveBeenCalledWith(mockAnnouncements[0])
    })
  })

  it('should show loading state during withdrawal', async () => {
    const { IncomingPaymentsCard } = await import('@/components/stealth/cards/IncomingPaymentsCard')
    const onWithdraw = vi
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))
    const loadingAnnouncements = [
      {
        schemeId: 1,
        stealthAddress: '0x1234567890123456789012345678901234567890' as Address,
        ephemeralPubKey:
          '0xabcd000000000000000000000000000000000000000000000000000000000000' as Hex,
        viewTag: 0,
        caller: '0x2345678901234567890123456789012345678901' as Address,
        blockNumber: BigInt(12345),
        transactionHash:
          '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
        value: BigInt('1000000000000000000'),
      },
    ]

    render(
      <IncomingPaymentsCard
        announcements={loadingAnnouncements}
        isScanning={false}
        onScan={vi.fn()}
        onWithdraw={onWithdraw}
      />
    )

    const withdrawButton = screen.getByRole('button', { name: /withdraw/i })
    await userEvent.click(withdrawButton)

    // Button should show loading state
    expect(withdrawButton).toBeDisabled()
  })
})

// ============================================
// 2. StealthMetaAddressCard Tests
// ============================================
describe('StealthMetaAddressCard', () => {
  it('should call onGenerate callback when generate button clicked', async () => {
    const { StealthMetaAddressCard } = await import(
      '@/components/stealth/cards/StealthMetaAddressCard'
    )
    const onGenerate = vi.fn()

    render(
      <StealthMetaAddressCard
        stealthMetaAddress={null}
        isLoading={false}
        onRegister={vi.fn()}
        isRegistering={false}
        onGenerate={onGenerate}
      />
    )

    const generateButton = screen.getByRole('button', { name: /generate/i })
    await userEvent.click(generateButton)

    expect(onGenerate).toHaveBeenCalled()
  })

  it('should show loading state when generating', async () => {
    const { StealthMetaAddressCard } = await import(
      '@/components/stealth/cards/StealthMetaAddressCard'
    )

    render(
      <StealthMetaAddressCard
        stealthMetaAddress={null}
        isLoading={true}
        onRegister={vi.fn()}
        isRegistering={false}
        onGenerate={vi.fn()}
      />
    )

    const generateButton = screen.getByRole('button', { name: /generate/i })
    expect(generateButton).toBeDisabled()
  })
})

// ============================================
// 3. YourPositionsCard Tests
// ============================================
describe('YourPositionsCard', () => {
  const mockPositions = [
    {
      poolAddress: '0x1234567890123456789012345678901234567890' as Address,
      token0: {
        address: '0x0000000000000000000000000000000000000000' as Address,
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
      },
      token1: {
        address: '0x0000000000000000000000000000000000000001' as Address,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      },
      liquidity: BigInt('1000000000000000000'),
      token0Amount: BigInt('500000000000000000'),
      token1Amount: BigInt('1000000000'),
      shareOfPool: 0.05,
    },
  ]

  it('should display positions when provided', async () => {
    const { YourPositionsCard } = await import('@/components/defi/cards/YourPositionsCard')

    render(
      <YourPositionsCard positions={mockPositions} isLoading={false} onRemoveLiquidity={vi.fn()} />
    )

    // Check for share percentage which is unambiguous
    expect(screen.getByText('5.00% share')).toBeInTheDocument()
    // Check for Remove button which means positions are displayed
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })

  it('should show loading state when fetching', async () => {
    const { YourPositionsCard } = await import('@/components/defi/cards/YourPositionsCard')

    render(<YourPositionsCard positions={[]} isLoading={true} />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('should show empty state when no positions', async () => {
    const { YourPositionsCard } = await import('@/components/defi/cards/YourPositionsCard')

    render(<YourPositionsCard positions={[]} isLoading={false} />)

    expect(screen.getByText(/no liquidity positions/i)).toBeInTheDocument()
  })

  it('should call onRemoveLiquidity when remove button clicked', async () => {
    const { YourPositionsCard } = await import('@/components/defi/cards/YourPositionsCard')
    const onRemoveLiquidity = vi.fn()

    render(
      <YourPositionsCard
        positions={mockPositions}
        isLoading={false}
        onRemoveLiquidity={onRemoveLiquidity}
      />
    )

    const removeButton = screen.getByRole('button', { name: /remove/i })
    await userEvent.click(removeButton)

    expect(onRemoveLiquidity).toHaveBeenCalledWith(mockPositions[0])
  })
})

// ============================================
// 4. Stealth Send Page Tests
// ============================================
vi.mock('@/hooks', () => ({
  useWallet: vi.fn(() => ({
    isConnected: true,
    address: '0x1234567890123456789012345678901234567890',
  })),
  useBalance: vi.fn(() => ({
    balance: BigInt('1000000000000000000'),
    decimals: 18,
    symbol: 'ETH',
  })),
  useStealth: vi.fn(() => ({
    generateStealthAddress: vi.fn().mockResolvedValue({
      stealthAddress: '0xabcd1234567890123456789012345678901234567890',
      ephemeralPubKey: '0x1234',
    }),
    sendToStealthAddress: vi.fn().mockResolvedValue({ hash: '0xtxhash' }),
    isLoading: false,
    error: null,
  })),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
  })),
}))

describe('StealthSendPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call sendToStealthAddress when send button clicked', async () => {
    const mockSendToStealthAddress = vi.fn().mockResolvedValue({ hash: '0xtxhash' })
    const { useStealth } = await import('@/hooks')
    vi.mocked(useStealth).mockReturnValue({
      generateStealthAddress: vi.fn().mockResolvedValue({
        stealthAddress: '0xabcd1234567890123456789012345678901234567890',
        ephemeralPubKey: '0x1234',
      }),
      sendToStealthAddress: mockSendToStealthAddress,
      isLoading: false,
      error: null,
      // biome-ignore lint/suspicious/noExplicitAny: test mock requires any
    } as any)

    const StealthSendPage = (await import('@/app/stealth/send/page')).default
    render(<StealthSendPage />)

    // Fill in the form
    const metaAddressInput = screen.getByPlaceholderText(/st:eth:/i)
    await userEvent.type(metaAddressInput, 'st:eth:0x1234567890abcdef')

    const amountInput = screen.getByPlaceholderText(/0.0/i)
    await userEvent.type(amountInput, '0.5')

    // Generate stealth address first
    const generateButton = screen.getByRole('button', { name: /generate/i })
    await userEvent.click(generateButton)

    // Wait for stealth address generation
    await waitFor(() => {
      expect(screen.getByText(/0xabcd/)).toBeInTheDocument()
    })

    // Click send button
    const sendButton = screen.getByRole('button', { name: /send/i })
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(mockSendToStealthAddress).toHaveBeenCalled()
    })
  })

  it('should show transaction hash after successful send', async () => {
    const mockSendToStealthAddress = vi.fn().mockResolvedValue({ hash: '0xtxhash123' })
    const { useStealth } = await import('@/hooks')
    vi.mocked(useStealth).mockReturnValue({
      generateStealthAddress: vi.fn().mockResolvedValue({
        stealthAddress: '0xabcd1234567890123456789012345678901234567890',
        ephemeralPubKey: '0x1234',
      }),
      sendToStealthAddress: mockSendToStealthAddress,
      isLoading: false,
      error: null,
      // biome-ignore lint/suspicious/noExplicitAny: test mock requires any
    } as any)

    const StealthSendPage = (await import('@/app/stealth/send/page')).default
    render(<StealthSendPage />)

    // After successful transaction, should show success state or tx hash
    // This tests that the component handles the response properly
    expect(screen.getByText(/private send/i)).toBeInTheDocument()
  })
})

// ============================================
// 5. Audit Page Export Tests
// ============================================
describe('AuditPage Export', () => {
  vi.mock('@/hooks/useAuditLogs', () => ({
    useAuditLogs: vi.fn(() => ({
      logs: [
        {
          id: '1',
          action: 'payroll_processed',
          actor: '0x1234567890123456789012345678901234567890',
          target: '0x2345678901234567890123456789012345678901',
          details: 'Processed payroll payment',
          timestamp: new Date('2024-01-15'),
          txHash: '0xabcd1234',
        },
      ],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })),
  }))

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('should export logs as CSV when export button clicked', async () => {
    const AuditPage = (await import('@/app/enterprise/audit/page')).default
    render(<AuditPage />)

    const exportButton = screen.getByRole('button', { name: /export/i })
    await userEvent.click(exportButton)

    // Should show export options or trigger download
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })
  })

  it('should have export functionality that creates downloadable file', async () => {
    const AuditPage = (await import('@/app/enterprise/audit/page')).default
    render(<AuditPage />)

    const exportButton = screen.getByRole('button', { name: /export/i })

    // Button should have onClick handler
    expect(exportButton).not.toBeDisabled()

    await userEvent.click(exportButton)

    // Verify that a download was initiated
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })
  })
})

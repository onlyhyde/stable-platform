'use client'

import type { Address } from 'viem'
import type { SupportedToken } from '@/hooks'
import type { ApprovalStatus } from '@/hooks/useTokenApproval'

// ============================================================================
// Types
// ============================================================================

/**
 * Gas payment mode — aligned with wallet-extension's GasPayment component.
 *
 * - 'native': Self-pay from EntryPoint deposit
 * - 'sponsor': Free gas via sponsorship
 * - 'erc20': Pay gas with ERC-20 token (e.g. USDC)
 */
export type GasPaymentMode = 'native' | 'sponsor' | 'erc20'

interface PaymasterSelectorProps {
  /** Currently selected gas payment mode */
  selectedMode: GasPaymentMode
  /** Mode change handler */
  onModeChange: (mode: GasPaymentMode) => void

  // --- Native (Self-Pay) ---
  /** EntryPoint deposit balance (formatted ETH string) */
  depositBalance?: string | null
  /** Callback to deposit ETH to EntryPoint */
  onDepositTopUp?: () => void
  /** Whether deposit top-up is in progress */
  isDepositing?: boolean

  // --- Sponsor ---
  /** Whether sponsorship is available */
  sponsorAvailable?: boolean | null
  /** Reason if sponsorship is unavailable */
  sponsorUnavailableReason?: string

  // --- ERC-20 ---
  /** Supported tokens for ERC-20 gas payment */
  supportedTokens?: SupportedToken[] | null
  /** Currently selected token address */
  selectedTokenAddress?: Address
  /** Token selection handler */
  onTokenSelect?: (address: Address) => void
  /** Whether tokens are loading */
  isLoadingTokens?: boolean
  /** Token gas estimate display */
  tokenGasEstimate?: { formattedCost: string; symbol: string } | null
  /** Whether gas is being estimated */
  isEstimatingGas?: boolean
  /** ERC-20 approval status */
  erc20ApprovalStatus?: ApprovalStatus
  /** ERC-20 approval handler */
  onErc20Approve?: () => void
  /** ERC-20 approval error */
  erc20ApprovalError?: string | null

  // --- Health ---
  /** Paymaster service health */
  paymasterHealthy?: boolean | null

  // --- State ---
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string | null
}

// ============================================================================
// Mode Config
// ============================================================================

interface ModeConfig {
  label: string
  description: string
  icon: string
}

const MODE_CONFIG: Record<GasPaymentMode, ModeConfig> = {
  native: {
    label: 'Self-Pay',
    description: 'Pay gas from EntryPoint deposit',
    icon: 'Ξ',
  },
  sponsor: {
    label: 'Sponsored',
    description: 'Free gas sponsorship',
    icon: '🎁',
  },
  erc20: {
    label: 'ERC-20',
    description: 'Pay gas with USDC',
    icon: '💵',
  },
}

const MODE_ORDER: GasPaymentMode[] = ['native', 'sponsor', 'erc20']

// ============================================================================
// Sub-components
// ============================================================================

function DepositInfo({
  balance,
  onTopUp,
  isDepositing,
}: {
  balance: string | null
  onTopUp?: () => void
  isDepositing?: boolean
}) {
  if (balance === null || balance === undefined) return null

  const isZero = balance === '0'
  const isLow = !isZero && Number(balance) < 0.001

  return (
    <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            EntryPoint Deposit
          </p>
          <p className="font-medium font-mono" style={{ color: 'rgb(var(--foreground))' }}>
            {balance} ETH
          </p>
        </div>
        {onTopUp && (
          <button
            type="button"
            onClick={onTopUp}
            disabled={isDepositing}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'rgb(var(--primary))',
              color: 'rgb(var(--primary-foreground))',
            }}
          >
            {isDepositing ? 'Depositing...' : 'Top Up'}
          </button>
        )}
      </div>
      {isZero && (
        <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
          No deposit — fund your EntryPoint deposit to send transactions
        </p>
      )}
      {isLow && (
        <p className="text-xs mt-1" style={{ color: 'rgb(var(--warning, 234 179 8))' }}>
          Low deposit — consider topping up to avoid failed transactions
        </p>
      )}
    </div>
  )
}

function SponsorInfo({
  available,
  reason,
}: {
  available: boolean | null | undefined
  reason?: string
}) {
  if (available === null || available === undefined) {
    return (
      <div
        className="flex items-center gap-2 p-3 rounded-lg"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        <div
          className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgb(var(--muted-foreground))', borderTopColor: 'transparent' }}
        />
        <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          Checking sponsorship...
        </span>
      </div>
    )
  }

  if (!available) {
    return (
      <div
        className="p-3 rounded-lg border"
        style={{
          backgroundColor: 'rgb(var(--destructive) / 0.1)',
          borderColor: 'rgb(var(--destructive) / 0.3)',
        }}
      >
        <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
          Sponsorship unavailable
        </p>
        {reason && (
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
            {reason}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 p-3 rounded-lg"
      style={{ backgroundColor: 'rgb(var(--success, 34 197 94) / 0.1)' }}
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
        style={{
          backgroundColor: 'rgb(var(--success, 34 197 94) / 0.2)',
          color: 'rgb(var(--success, 34 197 94))',
        }}
      >
        ✓
      </span>
      <span className="text-sm font-medium" style={{ color: 'rgb(var(--success, 34 197 94))' }}>
        Gas: Free (Sponsored)
      </span>
    </div>
  )
}

function TokenSelector({
  tokens,
  selectedAddress,
  onSelect,
  isLoading,
  gasEstimate,
  isEstimatingGas,
}: {
  tokens?: SupportedToken[] | null
  selectedAddress?: Address
  onSelect?: (address: Address) => void
  isLoading?: boolean
  gasEstimate?: { formattedCost: string; symbol: string } | null
  isEstimatingGas?: boolean
}) {
  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 p-3 rounded-lg"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        <div
          className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgb(var(--muted-foreground))', borderTopColor: 'transparent' }}
        />
        <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          Loading tokens...
        </span>
      </div>
    )
  }

  if (!tokens || tokens.length === 0) {
    return (
      <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          No supported tokens available
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium" style={{ color: 'rgb(var(--muted-foreground))' }}>
        Select Token
      </span>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tokens.map((token) => (
          <button
            key={token.address}
            type="button"
            onClick={() => onSelect?.(token.address)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg border text-left transition-all ${
              selectedAddress === token.address ? 'ring-2' : ''
            }`}
            style={{
              backgroundColor:
                selectedAddress === token.address
                  ? 'rgb(var(--primary) / 0.1)'
                  : 'rgb(var(--secondary))',
              borderColor:
                selectedAddress === token.address ? 'rgb(var(--primary))' : 'rgb(var(--border))',
              ...(selectedAddress === token.address &&
                ({ '--tw-ring-color': 'rgb(var(--primary) / 0.3)' } as React.CSSProperties)),
            }}
          >
            <p className="font-medium text-sm" style={{ color: 'rgb(var(--foreground))' }}>
              {token.symbol}
            </p>
            {token.exchangeRate && (
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Rate: {token.exchangeRate}
              </p>
            )}
          </button>
        ))}
      </div>
      {selectedAddress && (
        <div
          className="flex items-center justify-between p-2 rounded-lg"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Estimated Gas Cost
          </span>
          {isEstimatingGas ? (
            <div className="flex items-center gap-1">
              <div
                className="w-3 h-3 border-2 rounded-full animate-spin"
                style={{
                  borderColor: 'rgb(var(--muted-foreground))',
                  borderTopColor: 'transparent',
                }}
              />
              <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Estimating...
              </span>
            </div>
          ) : gasEstimate ? (
            <span
              className="text-xs font-mono font-medium"
              style={{ color: 'rgb(var(--foreground))' }}
            >
              ~{gasEstimate.formattedCost} {gasEstimate.symbol}
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Select to estimate
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function TokenApprovalSection({
  status,
  onApprove,
  error,
}: {
  status?: ApprovalStatus
  onApprove?: () => void
  error?: string | null
}) {
  if (!status || status === 'unknown') return null

  if (status === 'checking') {
    return (
      <div
        className="flex items-center gap-2 p-3 rounded-lg"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        <div
          className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgb(var(--muted-foreground))', borderTopColor: 'transparent' }}
        />
        <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          Checking token allowance...
        </span>
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div
        className="flex items-center gap-2 p-3 rounded-lg"
        style={{
          backgroundColor: 'rgb(var(--success, 34 197 94) / 0.1)',
          border: '1px solid rgb(var(--success, 34 197 94) / 0.2)',
        }}
      >
        <span style={{ color: 'rgb(var(--success, 34 197 94))' }}>✓</span>
        <span className="text-xs" style={{ color: 'rgb(var(--success, 34 197 94))' }}>
          Token approved for paymaster
        </span>
      </div>
    )
  }

  if (status === 'needs-approval') {
    return (
      <div
        className="p-3 rounded-lg space-y-2"
        style={{
          backgroundColor: 'rgb(var(--warning, 234 179 8) / 0.1)',
          border: '1px solid rgb(var(--warning, 234 179 8) / 0.2)',
        }}
      >
        <div className="flex items-start gap-2">
          <span className="text-sm">⚠️</span>
          <div className="flex-1">
            <p className="text-xs font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              Token approval required
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
              The paymaster needs approval to use your tokens for gas payment.
            </p>
          </div>
        </div>
        {error && (
          <p className="text-xs" style={{ color: 'rgb(var(--destructive))' }}>
            {error}
          </p>
        )}
        {onApprove && (
          <button
            type="button"
            onClick={onApprove}
            className="w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'rgb(var(--primary))',
              color: 'rgb(var(--primary-foreground))',
            }}
          >
            Approve Token
          </button>
        )}
      </div>
    )
  }

  if (status === 'approving') {
    return (
      <div
        className="flex items-center gap-2 p-3 rounded-lg"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        <div
          className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
        />
        <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          Approving token...
        </span>
      </div>
    )
  }

  return null
}

// ============================================================================
// Main Component
// ============================================================================

export function PaymasterSelector({
  selectedMode,
  onModeChange,
  depositBalance,
  onDepositTopUp,
  isDepositing,
  sponsorAvailable,
  sponsorUnavailableReason,
  supportedTokens,
  selectedTokenAddress,
  onTokenSelect,
  isLoadingTokens,
  tokenGasEstimate,
  isEstimatingGas,
  erc20ApprovalStatus,
  onErc20Approve,
  erc20ApprovalError,
  paymasterHealthy,
  isLoading: _isLoading,
  error,
}: PaymasterSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="block text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          Gas Payment
        </span>
        {paymasterHealthy !== null && paymasterHealthy !== undefined && (
          <span className="flex items-center gap-1 text-xs">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{
                backgroundColor: paymasterHealthy
                  ? 'rgb(var(--success, 34 197 94))'
                  : 'rgb(var(--destructive))',
              }}
            />
            <span style={{ color: 'rgb(var(--muted-foreground))' }}>
              {paymasterHealthy ? 'Paymaster Online' : 'Paymaster Offline'}
            </span>
          </span>
        )}
      </div>

      {/* 3-Mode Selection — aligned with wallet-extension */}
      <div className="space-y-2">
        {MODE_ORDER.map((mode) => {
          const config = MODE_CONFIG[mode]
          const isSelected = selectedMode === mode
          const isDisabled = mode === 'sponsor' && sponsorAvailable === false

          return (
            <button
              key={mode}
              type="button"
              onClick={() => {
                if (!isDisabled) onModeChange(mode)
              }}
              disabled={isDisabled}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
              style={{
                borderColor: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                backgroundColor: isSelected
                  ? 'rgb(var(--primary) / 0.05)'
                  : isDisabled
                    ? 'rgb(var(--secondary))'
                    : 'transparent',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{config.icon}</span>
                  <div>
                    <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                      {config.label}
                    </span>
                    <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      {config.description}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {mode === 'sponsor' && sponsorAvailable && (
                    <span
                      className="font-mono"
                      style={{ color: 'rgb(var(--success, 34 197 94))', fontWeight: 500 }}
                    >
                      Free
                    </span>
                  )}
                  {mode === 'sponsor' && isDisabled && (
                    <span className="text-xs" style={{ color: 'rgb(var(--destructive))' }}>
                      {sponsorUnavailableReason ?? 'Unavailable'}
                    </span>
                  )}
                  {isSelected && (
                    <span className="text-sm ml-1" style={{ color: 'rgb(var(--primary))' }}>
                      ✓
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Mode-specific content */}
      {selectedMode === 'native' && (
        <DepositInfo
          balance={depositBalance ?? null}
          onTopUp={onDepositTopUp}
          isDepositing={isDepositing}
        />
      )}

      {selectedMode === 'sponsor' && (
        <SponsorInfo available={sponsorAvailable} reason={sponsorUnavailableReason} />
      )}

      {selectedMode === 'erc20' && (
        <>
          <TokenSelector
            tokens={supportedTokens}
            selectedAddress={selectedTokenAddress}
            onSelect={onTokenSelect}
            isLoading={isLoadingTokens}
            gasEstimate={tokenGasEstimate}
            isEstimatingGas={isEstimatingGas}
          />
          {selectedTokenAddress && (
            <TokenApprovalSection
              status={erc20ApprovalStatus}
              onApprove={onErc20Approve}
              error={erc20ApprovalError}
            />
          )}
        </>
      )}

      {/* Error Banner */}
      {error && (
        <div
          className="p-3 rounded-lg border"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            borderColor: 'rgb(var(--destructive) / 0.3)',
          }}
        >
          <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
            {error}
          </p>
        </div>
      )}
    </div>
  )
}

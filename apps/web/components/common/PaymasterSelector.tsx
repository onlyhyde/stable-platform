'use client'

import type { Address } from 'viem'
import type { PaymasterType, SponsorshipPolicy, SupportedToken } from '@/hooks'

// ============================================================================
// Types
// ============================================================================

interface PaymasterSelectorProps {
  selectedType: PaymasterType | 'none'
  onTypeChange: (type: PaymasterType | 'none') => void
  // Token sub-selector (erc20/permit2)
  supportedTokens?: SupportedToken[] | null
  selectedTokenAddress?: Address
  onTokenSelect?: (address: Address) => void
  isLoadingTokens?: boolean
  // Token gas estimate
  tokenGasEstimate?: { formattedCost: string; symbol: string } | null
  isEstimatingGas?: boolean
  // Sponsor sub-selector
  sponsorshipPolicies?: SponsorshipPolicy[] | null
  selectedPolicyId?: string
  onPolicySelect?: (id: string) => void
  isLoadingPolicies?: boolean
  sponsorEligible?: boolean | null
  sponsorIneligibleReason?: string
  // Self-pay (no paymaster)
  depositBalance?: string | null
  /** Callback to deposit ETH to EntryPoint */
  onDepositTopUp?: () => void
  isDepositing?: boolean
  // Health
  paymasterHealthy?: boolean | null
  // Permit2
  permit2Signed?: boolean
  permit2Signing?: boolean
  onPermit2Sign?: () => void
  permit2Error?: string | null
  // State
  isLoading?: boolean
  error?: string | null
}

// ============================================================================
// Constants
// ============================================================================

const PAYMASTER_TYPES: Record<PaymasterType | 'none', { label: string; description: string }> = {
  none: { label: 'Self-Pay', description: 'Pay gas from EntryPoint deposit' },
  verifying: { label: 'Verifying', description: 'Standard gas validation' },
  sponsor: { label: 'Sponsored', description: 'Free gas sponsorship' },
  erc20: { label: 'ERC-20', description: 'Pay gas with tokens' },
  permit2: { label: 'Permit2', description: 'Gasless token approval' },
}

const TYPE_ORDER: (PaymasterType | 'none')[] = ['none', 'verifying', 'sponsor', 'erc20', 'permit2']

// ============================================================================
// Sub-components
// ============================================================================

function TokenSubSelector({
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
      {/* Token gas estimate */}
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
              --
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function SponsorSubSelector({
  eligible,
  ineligibleReason,
  policies,
  selectedPolicyId,
  onPolicySelect,
  isLoading,
}: {
  eligible?: boolean | null
  ineligibleReason?: string
  policies?: SponsorshipPolicy[] | null
  selectedPolicyId?: string
  onPolicySelect?: (id: string) => void
  isLoading?: boolean
}) {
  if (eligible === null || eligible === undefined) {
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
          Checking eligibility...
        </span>
      </div>
    )
  }

  if (eligible === false) {
    return (
      <div
        className="p-3 rounded-lg border"
        style={{
          backgroundColor: 'rgb(var(--destructive) / 0.1)',
          borderColor: 'rgb(var(--destructive) / 0.3)',
        }}
      >
        <p className="text-sm font-medium" style={{ color: 'rgb(var(--destructive))' }}>
          Not eligible for sponsorship
        </p>
        {ineligibleReason && (
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
            {ineligibleReason}
          </p>
        )}
      </div>
    )
  }

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
          Loading policies...
        </span>
      </div>
    )
  }

  if (!policies || policies.length === 0) {
    return (
      <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <p className="text-sm" style={{ color: 'rgb(var(--success, 34 197 94))' }}>
          Default policy applied — gas will be sponsored
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium" style={{ color: 'rgb(var(--muted-foreground))' }}>
        Select Policy
      </span>
      <div className="space-y-1">
        {policies
          .filter((p) => p.active)
          .map((policy) => (
            <button
              key={policy.id}
              type="button"
              onClick={() => onPolicySelect?.(policy.id)}
              className={`w-full px-3 py-2 rounded-lg border text-left transition-all ${
                selectedPolicyId === policy.id ? 'ring-2' : ''
              }`}
              style={{
                backgroundColor:
                  selectedPolicyId === policy.id
                    ? 'rgb(var(--primary) / 0.1)'
                    : 'rgb(var(--secondary))',
                borderColor:
                  selectedPolicyId === policy.id ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                ...(selectedPolicyId === policy.id &&
                  ({ '--tw-ring-color': 'rgb(var(--primary) / 0.3)' } as React.CSSProperties)),
              }}
            >
              <p className="font-medium text-sm" style={{ color: 'rgb(var(--foreground))' }}>
                {policy.name}
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Max {policy.maxOpsPerDay} ops/day
              </p>
            </button>
          ))}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function PaymasterSelector({
  selectedType,
  onTypeChange,
  supportedTokens,
  selectedTokenAddress,
  onTokenSelect,
  isLoadingTokens,
  tokenGasEstimate,
  isEstimatingGas,
  sponsorshipPolicies,
  selectedPolicyId,
  onPolicySelect,
  isLoadingPolicies,
  sponsorEligible,
  sponsorIneligibleReason,
  depositBalance,
  onDepositTopUp,
  isDepositing,
  paymasterHealthy,
  permit2Signed,
  permit2Signing,
  onPermit2Sign,
  permit2Error,
  isLoading: _isLoading,
  error,
}: PaymasterSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="block text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          Gas Payment
        </span>
        {/* Paymaster health indicator */}
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

      {/* 2x2 Type Grid */}
      <div className="grid grid-cols-2 gap-2">
        {TYPE_ORDER.map((type) => {
          const config = PAYMASTER_TYPES[type]
          return (
            <button
              key={type}
              type="button"
              onClick={() => onTypeChange(type)}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedType === type ? 'ring-2' : ''
              }`}
              style={{
                backgroundColor:
                  selectedType === type ? 'rgb(var(--primary) / 0.1)' : 'rgb(var(--secondary))',
                borderColor: selectedType === type ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                ...(selectedType === type &&
                  ({ '--tw-ring-color': 'rgb(var(--primary) / 0.3)' } as React.CSSProperties)),
              }}
            >
              <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                {config.label}
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {config.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Self-Pay deposit info */}
      {selectedType === 'none' && depositBalance != null && (
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                EntryPoint Deposit
              </p>
              <p className="font-medium font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                {depositBalance} ETH
              </p>
            </div>
            {onDepositTopUp && (
              <button
                type="button"
                onClick={onDepositTopUp}
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
          {depositBalance === '0' && (
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
              No deposit — you need to fund your EntryPoint deposit to send transactions
            </p>
          )}
        </div>
      )}

      {/* Token Sub-selector */}
      {(selectedType === 'erc20' || selectedType === 'permit2') && (
        <TokenSubSelector
          tokens={supportedTokens}
          selectedAddress={selectedTokenAddress}
          onSelect={onTokenSelect}
          isLoading={isLoadingTokens}
          gasEstimate={tokenGasEstimate}
          isEstimatingGas={isEstimatingGas}
        />
      )}

      {/* Permit2 Approval */}
      {selectedType === 'permit2' && selectedTokenAddress && onPermit2Sign && (
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
          {permit2Signed ? (
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                style={{
                  backgroundColor: 'rgb(var(--success, 34 197 94) / 0.2)',
                  color: 'rgb(var(--success, 34 197 94))',
                }}
              >
                ✓
              </span>
              <span className="text-sm" style={{ color: 'rgb(var(--success, 34 197 94))' }}>
                Permit2 signature approved
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Permit2 requires a one-time signature to authorize the paymaster to use your tokens
                for gas payment. No on-chain transaction needed.
              </p>
              <button
                type="button"
                onClick={onPermit2Sign}
                disabled={permit2Signing}
                className="w-full px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'rgb(var(--primary))',
                  color: 'rgb(var(--primary-foreground))',
                }}
              >
                {permit2Signing ? 'Waiting for signature...' : 'Sign Permit2 Approval'}
              </button>
              {permit2Error && (
                <p className="text-xs" style={{ color: 'rgb(var(--destructive))' }}>
                  {permit2Error}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sponsor Sub-selector */}
      {selectedType === 'sponsor' && (
        <SponsorSubSelector
          eligible={sponsorEligible}
          ineligibleReason={sponsorIneligibleReason}
          policies={sponsorshipPolicies}
          selectedPolicyId={selectedPolicyId}
          onPolicySelect={onPolicySelect}
          isLoading={isLoadingPolicies}
        />
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

import {
  GAS_PAYMENT_TYPE,
  type GasEstimate,
  type GasPaymentConfig,
  type SponsorPolicy,
} from '@stablenet/core'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { formatEther, formatUnits } from 'viem'

import { usePaymasterClient } from './hooks/usePaymasterClient'

// ============================================================================
// Types
// ============================================================================

interface GasPaymentSelectorProps {
  /** Current gas payment configuration */
  gasPayment: GasPaymentConfig

  /** Gas payment change handler */
  onGasPaymentChange: (config: GasPaymentConfig) => void

  /** Gas estimate for current transaction */
  gasEstimate: GasEstimate | null

  /** Loading state */
  isLoading?: boolean

  /** Smart Account address (for policy check) */
  accountAddress?: Address
}

interface PaymentOption {
  type: GasPaymentConfig['type']
  label: string
  description: string
  icon: string
  available: boolean
  unavailableReason?: string
  cost?: string
  savings?: string
  logoUrl?: string
  tokenAddress?: Address
  tokenSymbol?: string
  tokenDecimals?: number
}

// ============================================================================
// Component
// ============================================================================

export function GasPaymentSelector({
  gasPayment,
  onGasPaymentChange,
  gasEstimate,
  isLoading = false,
  accountAddress,
}: GasPaymentSelectorProps) {
  const {
    supportedTokens,
    sponsorPolicy,
    erc20Estimate,
    isLoadingTokens,
    isLoadingPolicy,
    isLoadingEstimate,
    fetchERC20Estimate,
  } = usePaymasterClient(accountAddress)

  // Build payment options
  const paymentOptions = useMemo<PaymentOption[]>(() => {
    const nativeCost = gasEstimate?.estimatedCost ?? 0n

    const options: PaymentOption[] = [
      // Native ETH
      {
        type: GAS_PAYMENT_TYPE.NATIVE,
        label: 'Pay with ETH',
        description: 'Use ETH from your wallet for gas',
        icon: 'Ξ',
        available: true,
        cost: nativeCost > 0n ? `${formatEther(nativeCost)} ETH` : 'Calculating...',
      },

      // Sponsored
      {
        type: GAS_PAYMENT_TYPE.SPONSOR,
        label: 'Free (Sponsored)',
        description: 'Gas sponsored by StableNet',
        icon: '🎁',
        available: sponsorPolicy?.isAvailable ?? false,
        unavailableReason: sponsorPolicy?.reason,
        cost: 'Free',
        savings: nativeCost > 0n ? `Save ${formatEther(nativeCost)} ETH` : undefined,
      },
    ]

    // ERC20 Tokens
    if (supportedTokens) {
      supportedTokens.forEach((token) => {
        options.push({
          type: GAS_PAYMENT_TYPE.ERC20,
          label: `Pay with ${token.symbol}`,
          description: `Use ${token.symbol} for gas payment`,
          icon: '💰',
          logoUrl: token.logoUrl,
          available: true,
          tokenAddress: token.address,
          tokenSymbol: token.symbol,
          tokenDecimals: token.decimals,
          cost:
            gasPayment.tokenAddress === token.address && erc20Estimate
              ? `${formatUnits(erc20Estimate.estimatedAmount, token.decimals)} ${token.symbol}`
              : 'Select to estimate',
        })
      })
    }

    return options
  }, [gasEstimate, sponsorPolicy, supportedTokens, gasPayment, erc20Estimate])

  // Handle option selection
  const handleOptionSelect = (option: PaymentOption) => {
    if (!option.available) return

    if (option.type === GAS_PAYMENT_TYPE.ERC20 && option.tokenAddress) {
      onGasPaymentChange({
        type: GAS_PAYMENT_TYPE.ERC20,
        tokenAddress: option.tokenAddress,
        tokenSymbol: option.tokenSymbol,
        tokenDecimals: option.tokenDecimals,
      })

      // Fetch estimate for selected token
      fetchERC20Estimate(option.tokenAddress)
    } else {
      onGasPaymentChange({ type: option.type })
    }
  }

  // Loading state
  if (isLoading || isLoadingTokens || isLoadingPolicy) {
    return (
      <div
        className="gas-payment-selector p-4 rounded-lg"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
          />
          <span style={{ color: 'rgb(var(--muted-foreground))' }}>Loading gas options...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="gas-payment-selector">
      <label
        className="block text-sm font-medium mb-2"
        style={{ color: 'rgb(var(--foreground-secondary))' }}
      >
        Gas Payment
      </label>

      {/* Payment Options */}
      <div className="payment-options space-y-2">
        {paymentOptions.map((option, index) => (
          <PaymentOptionCard
            key={`${option.type}-${index}`}
            option={option}
            isSelected={
              gasPayment.type === option.type &&
              (option.type !== GAS_PAYMENT_TYPE.ERC20 ||
                gasPayment.tokenAddress === option.tokenAddress)
            }
            onSelect={() => handleOptionSelect(option)}
          />
        ))}
      </div>

      {/* Sponsor Info */}
      {gasPayment.type === GAS_PAYMENT_TYPE.SPONSOR && sponsorPolicy && (
        <SponsorInfo policy={sponsorPolicy} />
      )}

      {/* ERC20 Estimate Loading */}
      {gasPayment.type === GAS_PAYMENT_TYPE.ERC20 && isLoadingEstimate && (
        <div className="mt-2 text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          Estimating token amount...
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

interface PaymentOptionCardProps {
  option: PaymentOption
  isSelected: boolean
  onSelect: () => void
}

function PaymentOptionCard({ option, isSelected, onSelect }: PaymentOptionCardProps) {
  const isDisabled = !option.available

  return (
    <button
      type="button"
      className={`
        payment-option w-full p-3 rounded-lg border-2 text-left transition-all
        ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
      `}
      style={{
        borderColor: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--border))',
        backgroundColor: isSelected
          ? 'rgb(var(--primary) / 0.05)'
          : isDisabled
            ? 'rgb(var(--secondary))'
            : 'transparent',
      }}
      onClick={onSelect}
      disabled={isDisabled}
    >
      <div className="flex items-center justify-between">
        {/* Left: Icon and Label */}
        <div className="flex items-center gap-3">
          {option.logoUrl ? (
            <img src={option.logoUrl} alt={option.label} className="w-8 h-8 rounded-full" />
          ) : (
            <span className="text-2xl">{option.icon}</span>
          )}
          <div>
            <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              {option.label}
            </span>
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {option.description}
            </p>
          </div>
        </div>

        {/* Right: Cost and Selection */}
        <div className="text-right">
          {option.available ? (
            <>
              <span
                className="font-mono"
                style={{
                  color:
                    option.type === GAS_PAYMENT_TYPE.SPONSOR
                      ? 'rgb(var(--success))'
                      : 'rgb(var(--foreground))',
                  fontWeight: option.type === GAS_PAYMENT_TYPE.SPONSOR ? 500 : 400,
                }}
              >
                {option.cost}
              </span>
              {option.savings && (
                <p className="text-xs" style={{ color: 'rgb(var(--success))' }}>
                  {option.savings}
                </p>
              )}
              {isSelected && (
                <span className="text-sm ml-1" style={{ color: 'rgb(var(--primary))' }}>
                  ✓
                </span>
              )}
            </>
          ) : (
            <span className="text-xs" style={{ color: 'rgb(var(--destructive))' }}>
              {option.unavailableReason || 'Unavailable'}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

interface SponsorInfoProps {
  policy: SponsorPolicy
}

function SponsorInfo({ policy }: SponsorInfoProps) {
  return (
    <div
      className="sponsor-info mt-3 p-3 rounded-lg"
      style={{
        backgroundColor: 'rgb(var(--success) / 0.1)',
        borderWidth: 1,
        borderColor: 'rgb(var(--success) / 0.2)',
      }}
    >
      <div className="flex items-start gap-2">
        <span style={{ color: 'rgb(var(--success))' }}>✓</span>
        <div className="text-sm">
          <p className="font-medium" style={{ color: 'rgb(var(--success))' }}>
            Gas Sponsorship Active
          </p>
          {policy.dailyLimitRemaining !== undefined && (
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Daily limit remaining: {formatEther(policy.dailyLimitRemaining)} ETH
            </p>
          )}
          {policy.perTxLimit !== undefined && (
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Per-transaction limit: {formatEther(policy.perTxLimit)} ETH
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Compact Gas Payment Display
// ============================================================================

interface GasPaymentDisplayProps {
  gasPayment: GasPaymentConfig
  gasEstimate: GasEstimate | null
}

export function GasPaymentDisplay({ gasPayment, gasEstimate }: GasPaymentDisplayProps) {
  const displayText = useMemo(() => {
    if (!gasEstimate) return 'Estimating...'

    switch (gasPayment.type) {
      case GAS_PAYMENT_TYPE.SPONSOR:
        return 'Free (Sponsored)'

      case GAS_PAYMENT_TYPE.ERC20:
        if (gasPayment.estimatedAmount && gasPayment.tokenSymbol) {
          return `${formatUnits(gasPayment.estimatedAmount, gasPayment.tokenDecimals ?? 18)} ${gasPayment.tokenSymbol}`
        }
        return `Pay with ${gasPayment.tokenSymbol || 'Token'}`

      case GAS_PAYMENT_TYPE.NATIVE:
      default:
        return `${formatEther(gasEstimate.estimatedCost)} ETH`
    }
  }, [gasPayment, gasEstimate])

  const icon = useMemo(() => {
    switch (gasPayment.type) {
      case GAS_PAYMENT_TYPE.SPONSOR:
        return '🎁'
      case GAS_PAYMENT_TYPE.ERC20:
        return '💰'
      default:
        return 'Ξ'
    }
  }, [gasPayment.type])

  return (
    <div className="gas-payment-display inline-flex items-center gap-1 text-sm">
      <span>{icon}</span>
      <span className="font-mono">{displayText}</span>
    </div>
  )
}

// ============================================================================
// Gas Payment Summary
// ============================================================================

interface GasPaymentSummaryProps {
  gasPayment: GasPaymentConfig
  gasEstimate: GasEstimate | null
  tokenBalance?: bigint
}

export function GasPaymentSummary({
  gasPayment,
  gasEstimate,
  tokenBalance,
}: GasPaymentSummaryProps) {
  const isSponsored = gasPayment.type === GAS_PAYMENT_TYPE.SPONSOR
  const isERC20 = gasPayment.type === GAS_PAYMENT_TYPE.ERC20

  return (
    <div
      className="gas-payment-summary p-3 rounded-lg"
      style={{ backgroundColor: 'rgb(var(--secondary))' }}
    >
      <h4 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--foreground))' }}>
        Gas Payment
      </h4>

      <div className="space-y-1 text-sm">
        {/* Payment Method */}
        <div className="flex justify-between">
          <span style={{ color: 'rgb(var(--muted-foreground))' }}>Method:</span>
          <span style={{ color: 'rgb(var(--foreground))' }}>
            {isSponsored ? 'Sponsored' : isERC20 ? `${gasPayment.tokenSymbol}` : 'ETH'}
          </span>
        </div>

        {/* Cost */}
        <div className="flex justify-between">
          <span style={{ color: 'rgb(var(--muted-foreground))' }}>Cost:</span>
          <span
            className="font-mono"
            style={{ color: isSponsored ? 'rgb(var(--success))' : 'rgb(var(--foreground))' }}
          >
            <GasPaymentDisplay gasPayment={gasPayment} gasEstimate={gasEstimate} />
          </span>
        </div>

        {/* Balance Check (for ERC20) */}
        {isERC20 && tokenBalance !== undefined && gasPayment.estimatedAmount && (
          <div className="flex justify-between">
            <span style={{ color: 'rgb(var(--muted-foreground))' }}>Your balance:</span>
            <span
              className="font-mono"
              style={{
                color:
                  tokenBalance >= gasPayment.estimatedAmount
                    ? 'rgb(var(--success))'
                    : 'rgb(var(--destructive))',
              }}
            >
              {formatUnits(tokenBalance, gasPayment.tokenDecimals ?? 18)} {gasPayment.tokenSymbol}
            </span>
          </div>
        )}
      </div>

      {/* Insufficient Balance Warning */}
      {isERC20 &&
        tokenBalance !== undefined &&
        gasPayment.estimatedAmount &&
        tokenBalance < gasPayment.estimatedAmount && (
          <div
            className="mt-2 p-2 rounded text-xs"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              color: 'rgb(var(--destructive))',
            }}
          >
            Insufficient {gasPayment.tokenSymbol} balance for gas
          </div>
        )}
    </div>
  )
}

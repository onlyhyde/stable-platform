import { ENTRY_POINT_ADDRESS, getEntryPoint, isChainSupported } from '@stablenet/contracts'
import {
  GAS_PAYMENT_TYPE,
  type GasEstimate,
  type GasPaymentConfig,
  type SponsorPolicy,
} from '@stablenet/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address } from 'viem'
import { formatEther, formatUnits } from 'viem'

import { useNetworkCurrency, useSelectedNetwork } from '../../hooks/useNetworkCurrency'
import { usePaymasterClient } from './hooks/usePaymasterClient'

// ============================================================================
// Types
// ============================================================================

interface CustomGasSettings {
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
}

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

  /** Custom gas settings change handler */
  onCustomGasChange?: (settings: CustomGasSettings) => void

  /** Whether token approval is in progress */
  isSendingApprove?: boolean

  /** Whether token allowance is sufficient for ERC-20 paymaster */
  isAllowanceSufficient?: boolean

  /** Whether allowance is being checked */
  isCheckingAllowance?: boolean

  /** Approve error message */
  approveError?: string | null

  /** Handler to send approve transaction */
  onApproveToken?: (tokenAddress: Address) => void
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
  /** EntryPoint deposit status for native payment */
  depositStatus?: 'sufficient' | 'insufficient'
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
  onCustomGasChange,
  isSendingApprove = false,
  isAllowanceSufficient,
  isCheckingAllowance = false,
  approveError,
  onApproveToken,
}: GasPaymentSelectorProps) {
  const { t } = useTranslation('send')
  const { symbol: nativeSymbol } = useNetworkCurrency()
  const currentNetwork = useSelectedNetwork()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customMaxFee, setCustomMaxFee] = useState('')
  const [customPriorityFee, setCustomPriorityFee] = useState('')
  const [entryPointDeposit, setEntryPointDeposit] = useState<bigint | null>(null)

  const {
    supportedTokens,
    sponsorPolicy,
    erc20Estimate,
    isLoadingTokens,
    isLoadingPolicy,
    isLoadingEstimate,
    fetchERC20Estimate,
  } = usePaymasterClient(accountAddress)

  // Fetch EntryPoint deposit for native gas payment check
  const fetchEntryPointDeposit = useCallback(async () => {
    if (!accountAddress || !currentNetwork) return

    try {
      const entryPoint = isChainSupported(currentNetwork.chainId)
        ? getEntryPoint(currentNetwork.chainId)
        : ENTRY_POINT_ADDRESS
      const paddedAddress = accountAddress.toLowerCase().replace('0x', '').padStart(64, '0')

      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `ep-deposit-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          // balanceOf(address) selector: 0x70a08231
          params: [{ to: entryPoint, data: `0x70a08231${paddedAddress}` }, 'latest'],
        },
      })

      if (response?.payload?.result && response.payload.result !== '0x') {
        setEntryPointDeposit(BigInt(response.payload.result))
      } else {
        setEntryPointDeposit(0n)
      }
    } catch {
      setEntryPointDeposit(null)
    }
  }, [accountAddress, currentNetwork])

  useEffect(() => {
    fetchEntryPointDeposit()
  }, [fetchEntryPointDeposit])

  // Build payment options
  const paymentOptions = useMemo<PaymentOption[]>(() => {
    const nativeCost = gasEstimate?.estimatedCost ?? 0n

    // Check if EntryPoint deposit is sufficient for native gas payment
    const hasDeposit = entryPointDeposit !== null && entryPointDeposit > 0n
    const depositSufficient = hasDeposit && nativeCost > 0n && entryPointDeposit >= nativeCost

    const options: PaymentOption[] = [
      // Native currency
      {
        type: GAS_PAYMENT_TYPE.NATIVE,
        label: t('payWithNative', { symbol: nativeSymbol }),
        description:
          entryPointDeposit !== null
            ? `${t('useNativeForGas', { symbol: nativeSymbol })} (Deposit: ${formatEther(entryPointDeposit)} ${nativeSymbol})`
            : t('useNativeForGas', { symbol: nativeSymbol }),
        icon: 'Ξ',
        available: true,
        cost: nativeCost > 0n ? `${formatEther(nativeCost)} ${nativeSymbol}` : t('calculating'),
        depositStatus:
          entryPointDeposit !== null
            ? depositSufficient
              ? 'sufficient'
              : 'insufficient'
            : undefined,
      },

      // Sponsored
      {
        type: GAS_PAYMENT_TYPE.SPONSOR,
        label: t('freeSponsored'),
        description: t('gasSponsoredByStableNet'),
        icon: '🎁',
        available: sponsorPolicy?.isAvailable ?? false,
        unavailableReason: sponsorPolicy?.reason,
        cost: 'Free',
        savings: nativeCost > 0n ? `Save ${formatEther(nativeCost)} ${nativeSymbol}` : undefined,
      },
    ]

    // ERC20 Token — only USDC (Paymaster pays gas, user reimburses in USDC)
    if (supportedTokens) {
      const usdcToken = supportedTokens.find(
        (token) => token.symbol === 'USDC' || token.symbol === 'usdc'
      )
      if (usdcToken) {
        options.push({
          type: GAS_PAYMENT_TYPE.ERC20,
          label: t('payWithUsdc'),
          description: t('usdcPaymasterDesc'),
          icon: '💵',
          logoUrl: usdcToken.logoUrl,
          available: true,
          tokenAddress: usdcToken.address,
          tokenSymbol: usdcToken.symbol,
          tokenDecimals: usdcToken.decimals,
          cost:
            gasPayment.tokenAddress === usdcToken.address && erc20Estimate
              ? `${formatUnits(erc20Estimate.estimatedAmount, usdcToken.decimals)} USDC`
              : t('selectToEstimate'),
        })
      }
    }

    return options
  }, [gasEstimate, sponsorPolicy, supportedTokens, gasPayment, erc20Estimate, t, nativeSymbol, entryPointDeposit])

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
          <span style={{ color: 'rgb(var(--muted-foreground))' }}>{t('loadingGasOptions')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="gas-payment-selector">
      <span
        className="block text-sm font-medium mb-2"
        style={{ color: 'rgb(var(--foreground-secondary))' }}
      >
        {t('gasPayment')}
      </span>

      {/* Payment Options */}
      <div className="payment-options space-y-2">
        {paymentOptions.map((option, index) => (
          <PaymentOptionCard
            // biome-ignore lint/suspicious/noArrayIndexKey: type alone may not be unique
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
          {t('estimatingTokenAmount')}
        </div>
      )}

      {/* ERC20 Token Approval Status */}
      {gasPayment.type === GAS_PAYMENT_TYPE.ERC20 && gasPayment.tokenAddress && (
        <TokenApprovalStatus
          isCheckingAllowance={isCheckingAllowance}
          isAllowanceSufficient={isAllowanceSufficient}
          isSendingApprove={isSendingApprove}
          approveError={approveError ?? undefined}
          tokenSymbol={gasPayment.tokenSymbol ?? 'Token'}
          onApprove={() => onApproveToken?.(gasPayment.tokenAddress as Address)}
        />
      )}

      {/* Advanced Gas Settings */}
      {gasPayment.type === GAS_PAYMENT_TYPE.NATIVE && onCustomGasChange && (
        <div className="mt-3">
          <button
            type="button"
            className="text-xs flex items-center gap-1"
            style={{ color: 'rgb(var(--muted-foreground))' }}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <svg
              className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {t('advancedGasSettings')}
          </button>

          {showAdvanced && (
            <div
              className="mt-2 p-3 rounded-lg space-y-2"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <div>
                <label
                  htmlFor="max-fee-per-gas"
                  className="text-xs block mb-1"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                  {t('maxFeePerGas')}
                </label>
                <input
                  id="max-fee-per-gas"
                  type="text"
                  placeholder={
                    gasEstimate
                      ? (
                          Number(gasEstimate.estimatedCost) /
                          1e9 /
                          Number(gasEstimate.gasLimit || 21000n)
                        ).toFixed(2)
                      : t('auto')
                  }
                  value={customMaxFee}
                  onChange={(e) => {
                    setCustomMaxFee(e.target.value)
                    onCustomGasChange({
                      maxFeePerGas: e.target.value || undefined,
                      maxPriorityFeePerGas: customPriorityFee || undefined,
                    })
                  }}
                  className="input-base w-full p-1.5 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label
                  htmlFor="max-priority-fee"
                  className="text-xs block mb-1"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                  {t('maxPriorityFee')}
                </label>
                <input
                  id="max-priority-fee"
                  type="text"
                  placeholder={t('auto')}
                  value={customPriorityFee}
                  onChange={(e) => {
                    setCustomPriorityFee(e.target.value)
                    onCustomGasChange({
                      maxFeePerGas: customMaxFee || undefined,
                      maxPriorityFeePerGas: e.target.value || undefined,
                    })
                  }}
                  className="input-base w-full p-1.5 rounded text-xs font-mono"
                />
              </div>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('leaveEmptyForNetwork')}
              </p>
            </div>
          )}
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
              {option.depositStatus && (
                <span
                  className="text-xs font-medium"
                  style={{
                    color:
                      option.depositStatus === 'sufficient'
                        ? 'rgb(var(--success))'
                        : 'rgb(var(--destructive))',
                  }}
                >
                  {option.depositStatus === 'sufficient' ? '● Available' : '● Insufficient deposit'}
                </span>
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

// ============================================================================
// Token Approval Status
// ============================================================================

interface TokenApprovalStatusProps {
  isCheckingAllowance: boolean
  isAllowanceSufficient?: boolean
  isSendingApprove: boolean
  approveError?: string
  tokenSymbol: string
  onApprove: () => void
}

function TokenApprovalStatus({
  isCheckingAllowance,
  isAllowanceSufficient,
  isSendingApprove,
  approveError,
  tokenSymbol,
  onApprove,
}: TokenApprovalStatusProps) {
  const { t } = useTranslation('send')

  if (isCheckingAllowance) {
    return (
      <div
        className="mt-2 p-3 rounded-lg flex items-center gap-2"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        <div
          className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
        />
        <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('checkingAllowance', { symbol: tokenSymbol })}
        </span>
      </div>
    )
  }

  if (isAllowanceSufficient === true) {
    return (
      <div
        className="mt-2 p-3 rounded-lg flex items-center gap-2"
        style={{
          backgroundColor: 'rgb(var(--success) / 0.1)',
          border: '1px solid rgb(var(--success) / 0.2)',
        }}
      >
        <span style={{ color: 'rgb(var(--success))' }}>✓</span>
        <span className="text-xs" style={{ color: 'rgb(var(--success))' }}>
          {t('approvalActive', { symbol: tokenSymbol })}
        </span>
      </div>
    )
  }

  if (isAllowanceSufficient === false) {
    return (
      <div
        className="mt-2 p-3 rounded-lg space-y-2"
        style={{
          backgroundColor: 'rgb(var(--warning) / 0.1)',
          border: '1px solid rgb(var(--warning) / 0.2)',
        }}
      >
        <div className="flex items-start gap-2">
          <span className="text-sm">⚠️</span>
          <div className="flex-1">
            <p className="text-xs font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              {t('approvalRequired', { symbol: tokenSymbol })}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('approvalRequiredDesc', { symbol: tokenSymbol })}
            </p>
          </div>
        </div>

        {approveError && (
          <p className="text-xs" style={{ color: 'rgb(var(--destructive))' }}>
            {approveError}
          </p>
        )}

        <button
          type="button"
          className="w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: isSendingApprove ? 'rgb(var(--secondary))' : 'rgb(var(--primary))',
            color: isSendingApprove ? 'rgb(var(--muted-foreground))' : 'rgb(var(--primary-foreground))',
          }}
          onClick={onApprove}
          disabled={isSendingApprove}
        >
          {isSendingApprove ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}
              />
              {t('approvingToken', { symbol: tokenSymbol })}
            </span>
          ) : (
            t('approveToken', { symbol: tokenSymbol })
          )}
        </button>
      </div>
    )
  }

  return null
}

interface SponsorInfoProps {
  policy: SponsorPolicy
}

function SponsorInfo({ policy }: SponsorInfoProps) {
  const { t } = useTranslation('send')
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
            {t('gasSponsorshipActive')}
          </p>
          {policy.dailyLimitRemaining !== undefined && (
            <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('dailyLimitRemaining', { amount: formatEther(policy.dailyLimitRemaining) })}
            </p>
          )}
          {policy.perTxLimit !== undefined && (
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('perTxLimit', { amount: formatEther(policy.perTxLimit) })}
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
  const { t } = useTranslation('send')
  const { symbol: nativeSymbol } = useNetworkCurrency()
  const displayText = useMemo(() => {
    if (!gasEstimate) return t('estimating')

    switch (gasPayment.type) {
      case GAS_PAYMENT_TYPE.SPONSOR:
        return t('freeSponsored')

      case GAS_PAYMENT_TYPE.ERC20:
        if (gasPayment.estimatedAmount && gasPayment.tokenSymbol) {
          return `${formatUnits(gasPayment.estimatedAmount, gasPayment.tokenDecimals ?? 18)} ${gasPayment.tokenSymbol}`
        }
        return t('payWithToken', { symbol: gasPayment.tokenSymbol || 'Token' })
      default:
        return `${formatEther(gasEstimate.estimatedCost)} ${nativeSymbol}`
    }
  }, [gasPayment, gasEstimate, nativeSymbol, t])

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
  const { t } = useTranslation('send')
  const { symbol: nativeSymbol } = useNetworkCurrency()
  const isSponsored = gasPayment.type === GAS_PAYMENT_TYPE.SPONSOR
  const isERC20 = gasPayment.type === GAS_PAYMENT_TYPE.ERC20

  return (
    <div
      className="gas-payment-summary p-3 rounded-lg"
      style={{ backgroundColor: 'rgb(var(--secondary))' }}
    >
      <h4 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--foreground))' }}>
        {t('gasPayment')}
      </h4>

      <div className="space-y-1 text-sm">
        {/* Payment Method */}
        <div className="flex justify-between">
          <span style={{ color: 'rgb(var(--muted-foreground))' }}>{t('method')}</span>
          <span style={{ color: 'rgb(var(--foreground))' }}>
            {isSponsored ? t('sponsored') : isERC20 ? `${gasPayment.tokenSymbol}` : nativeSymbol}
          </span>
        </div>

        {/* Cost */}
        <div className="flex justify-between">
          <span style={{ color: 'rgb(var(--muted-foreground))' }}>{t('cost')}</span>
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
            <span style={{ color: 'rgb(var(--muted-foreground))' }}>{t('yourBalance')}</span>
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
            {t('insufficientBalance', { symbol: gasPayment.tokenSymbol })}
          </div>
        )}
    </div>
  )
}

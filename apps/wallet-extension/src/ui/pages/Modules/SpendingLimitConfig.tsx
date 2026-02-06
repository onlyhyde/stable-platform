import {
  PERIOD_PRESETS,
  type SpendingLimitHookConfig,
  encodeSpendingLimitInit,
  validateSpendingLimitConfig,
} from '@stablenet/core'
import { useCallback, useMemo, useState } from 'react'
import type { Address, Hex } from 'viem'
import { formatEther, parseEther } from 'viem'

// ============================================================================
// Types
// ============================================================================

interface SpendingLimitConfigProps {
  accountAddress: string
  onSubmit: (initData: Hex, config: SpendingLimitHookConfig) => void
  onBack: () => void
}

type Step = 'token' | 'limit' | 'period' | 'review'

interface FormState {
  tokenType: 'native' | 'erc20'
  customToken: string
  limitAmount: string
  period: number
}

// ============================================================================
// Constants
// ============================================================================

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

const PERIOD_OPTIONS = [
  { label: 'Hourly', value: PERIOD_PRESETS.HOURLY, description: 'Resets every hour' },
  { label: 'Daily', value: PERIOD_PRESETS.DAILY, description: 'Resets every 24 hours' },
  { label: 'Weekly', value: PERIOD_PRESETS.WEEKLY, description: 'Resets every 7 days' },
  { label: 'Monthly', value: PERIOD_PRESETS.MONTHLY, description: 'Resets every 30 days' },
]

const LIMIT_PRESETS = ['0.1', '0.5', '1', '5', '10', '50']

// ============================================================================
// Component
// ============================================================================

export function SpendingLimitConfigUI({
  accountAddress,
  onSubmit,
  onBack,
}: SpendingLimitConfigProps) {
  const [step, setStep] = useState<Step>('token')
  const [form, setForm] = useState<FormState>({
    tokenType: 'native',
    customToken: '',
    limitAmount: '1',
    period: PERIOD_PRESETS.DAILY,
  })
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  // Get token address based on selection
  const tokenAddress = useMemo(() => {
    if (form.tokenType === 'native') {
      return ZERO_ADDRESS
    }
    return (form.customToken || ZERO_ADDRESS) as Address
  }, [form.tokenType, form.customToken])

  // Get period name
  const periodName = useMemo(() => {
    const option = PERIOD_OPTIONS.find((p) => p.value === form.period)
    return option?.label || 'Custom'
  }, [form.period])

  // Validate and submit
  const handleSubmit = useCallback(() => {
    const config: SpendingLimitHookConfig = {
      token: tokenAddress,
      limit: parseEther(form.limitAmount || '0'),
      period: form.period,
    }

    const validation = validateSpendingLimitConfig(config)
    if (!validation.valid) {
      setErrors(validation.errors)
      setWarnings(validation.warnings || [])
      return
    }

    if (validation.warnings && validation.warnings.length > 0) {
      setWarnings(validation.warnings)
    }

    const initData = encodeSpendingLimitInit(config)
    onSubmit(initData, config)
  }, [form, tokenAddress, onSubmit])

  // Navigation
  const canProceed = () => {
    switch (step) {
      case 'token':
        if (form.tokenType === 'erc20') {
          return form.customToken.length === 42 && form.customToken.startsWith('0x')
        }
        return true
      case 'limit':
        return Number.parseFloat(form.limitAmount) > 0
      case 'period':
        return form.period > 0
      default:
        return true
    }
  }

  const nextStep = () => {
    const steps: Step[] = ['token', 'limit', 'period', 'review']
    const currentIndex = steps.indexOf(step)
    const next = steps[currentIndex + 1]
    if (currentIndex < steps.length - 1 && next) {
      setStep(next)
    }
  }

  const prevStep = () => {
    const steps: Step[] = ['token', 'limit', 'period', 'review']
    const currentIndex = steps.indexOf(step)
    const prev = steps[currentIndex - 1]
    if (currentIndex > 0 && prev) {
      setStep(prev)
    } else {
      onBack()
    }
  }

  return (
    <div className="spending-limit-config">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">💰</span>
        <div>
          <h3 className="text-lg font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            Spending Limit Hook
          </h3>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Set transaction limits per time period
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {['token', 'limit', 'period', 'review'].map((s, i) => (
          <div
            key={s}
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor:
                ['token', 'limit', 'period', 'review'].indexOf(step) >= i
                  ? 'rgb(var(--primary))'
                  : 'rgb(var(--border))',
            }}
          />
        ))}
      </div>

      {/* Step: Token Selection */}
      {step === 'token' && (
        <div className="step-token">
          <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
            Select Token
          </h4>

          <div
            className="info-card p-3 rounded-lg mb-4"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Choose which token to limit. The spending limit will reset after each period.
            </p>
          </div>

          <div className="space-y-3">
            <button
              className="w-full p-4 rounded-lg text-left flex items-center gap-3"
              style={{
                backgroundColor:
                  form.tokenType === 'native'
                    ? 'rgb(var(--primary) / 0.1)'
                    : 'rgb(var(--secondary))',
                borderWidth: 1,
                borderColor: form.tokenType === 'native' ? 'rgb(var(--primary))' : 'transparent',
              }}
              onClick={() => setForm((prev) => ({ ...prev, tokenType: 'native' }))}
            >
              <span className="text-2xl">⟠</span>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  Native ETH
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Limit outgoing ETH transactions
                </p>
              </div>
            </button>

            <button
              className="w-full p-4 rounded-lg text-left flex items-center gap-3"
              style={{
                backgroundColor:
                  form.tokenType === 'erc20'
                    ? 'rgb(var(--primary) / 0.1)'
                    : 'rgb(var(--secondary))',
                borderWidth: 1,
                borderColor: form.tokenType === 'erc20' ? 'rgb(var(--primary))' : 'transparent',
              }}
              onClick={() => setForm((prev) => ({ ...prev, tokenType: 'erc20' }))}
            >
              <span className="text-2xl">🪙</span>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  ERC-20 Token
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Limit specific token transfers
                </p>
              </div>
            </button>

            {form.tokenType === 'erc20' && (
              <div className="mt-4">
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'rgb(var(--foreground-secondary))' }}
                >
                  Token Contract Address
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg input-base font-mono text-sm"
                  placeholder="0x..."
                  value={form.customToken}
                  onChange={(e) => setForm((prev) => ({ ...prev, customToken: e.target.value }))}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step: Limit Amount */}
      {step === 'limit' && (
        <div className="step-limit">
          <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
            Set Limit Amount
          </h4>

          <div
            className="info-card p-3 rounded-lg mb-4"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Maximum amount that can be spent during each period.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground-secondary))' }}
              >
                Limit Amount ({form.tokenType === 'native' ? 'ETH' : 'Tokens'})
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 rounded-lg input-base text-lg"
                placeholder="1.0"
                value={form.limitAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, limitAmount: e.target.value }))}
                step="0.1"
                min="0"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {LIMIT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor:
                      form.limitAmount === preset ? 'rgb(var(--primary))' : 'rgb(var(--secondary))',
                    color: form.limitAmount === preset ? 'white' : 'rgb(var(--foreground))',
                  }}
                  onClick={() => setForm((prev) => ({ ...prev, limitAmount: preset }))}
                >
                  {preset} {form.tokenType === 'native' ? 'ETH' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step: Period Selection */}
      {step === 'period' && (
        <div className="step-period">
          <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
            Reset Period
          </h4>

          <div
            className="info-card p-3 rounded-lg mb-4"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              How often the spending limit resets.
            </p>
          </div>

          <div className="space-y-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                className="w-full p-4 rounded-lg text-left"
                style={{
                  backgroundColor:
                    form.period === option.value
                      ? 'rgb(var(--primary) / 0.1)'
                      : 'rgb(var(--secondary))',
                  borderWidth: 1,
                  borderColor: form.period === option.value ? 'rgb(var(--primary))' : 'transparent',
                }}
                onClick={() => setForm((prev) => ({ ...prev, period: option.value }))}
              >
                <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  {option.label}
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div className="step-review">
          <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
            Review Spending Limit
          </h4>

          {errors.length > 0 && (
            <div
              className="p-3 rounded-lg mb-4"
              style={{
                backgroundColor: 'rgb(var(--destructive) / 0.1)',
                color: 'rgb(var(--destructive))',
              }}
            >
              {errors.map((err, i) => (
                <p key={i} className="text-sm">
                  {err}
                </p>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div
              className="p-3 rounded-lg mb-4"
              style={{
                backgroundColor: 'rgb(var(--warning) / 0.1)',
                color: 'rgb(var(--warning))',
              }}
            >
              {warnings.map((warn, i) => (
                <p key={i} className="text-sm">
                  {warn}
                </p>
              ))}
            </div>
          )}

          <div
            className="space-y-3 p-4 rounded-lg"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <div className="flex justify-between">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>Token</span>
              <span style={{ color: 'rgb(var(--foreground))' }}>
                {form.tokenType === 'native' ? (
                  <span className="flex items-center gap-1">
                    <span>⟠</span> Native ETH
                  </span>
                ) : (
                  <span className="font-mono text-xs">
                    {form.customToken.slice(0, 8)}...{form.customToken.slice(-6)}
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>Limit</span>
              <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                {form.limitAmount} {form.tokenType === 'native' ? 'ETH' : 'tokens'}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>Reset Period</span>
              <span style={{ color: 'rgb(var(--foreground))' }}>{periodName}</span>
            </div>
          </div>

          <div
            className="info-card p-3 rounded-lg mt-4"
            style={{
              backgroundColor: 'rgb(var(--info) / 0.1)',
              borderWidth: 1,
              borderColor: 'rgb(var(--info) / 0.3)',
            }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--foreground))' }}>
              <strong>How it works:</strong> Any transaction exceeding the remaining allowance will
              be blocked until the period resets.
            </p>
          </div>

          <div
            className="warning-card p-3 rounded-lg mt-4"
            style={{
              backgroundColor: 'rgb(var(--warning) / 0.1)',
              borderWidth: 1,
              borderColor: 'rgb(var(--warning) / 0.3)',
            }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--warning))' }}>
              <strong>Note:</strong> The hook will be applied to all transactions. Make sure the
              limit is high enough for your normal usage.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button className="btn-ghost flex-1 py-3 rounded-lg font-medium" onClick={prevStep}>
          {step === 'token' ? 'Cancel' : 'Back'}
        </button>
        {step === 'review' ? (
          <button className="btn-primary flex-1 py-3 rounded-lg font-medium" onClick={handleSubmit}>
            Install Hook
          </button>
        ) : (
          <button
            className="btn-primary flex-1 py-3 rounded-lg font-medium"
            onClick={nextStep}
            disabled={!canProceed()}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Spending Limit Status Display Component
// ============================================================================

interface SpendingLimitDisplayProps {
  token: Address
  tokenSymbol: string
  limit: bigint
  spent: bigint
  period: number
  resetTime: number
}

export function SpendingLimitDisplay({
  token,
  tokenSymbol,
  limit,
  spent,
  period,
  resetTime,
}: SpendingLimitDisplayProps) {
  const remaining = limit > spent ? limit - spent : 0n
  const usedPercentage = limit > 0n ? Number((spent * 100n) / limit) : 0
  const isExceeded = spent >= limit

  const now = Math.floor(Date.now() / 1000)
  const secondsUntilReset = Math.max(0, resetTime - now)

  let resetIn: string
  if (secondsUntilReset === 0) {
    resetIn = 'Now'
  } else if (secondsUntilReset < 3600) {
    resetIn = `${Math.floor(secondsUntilReset / 60)}m`
  } else if (secondsUntilReset < 86400) {
    resetIn = `${Math.floor(secondsUntilReset / 3600)}h`
  } else {
    resetIn = `${Math.floor(secondsUntilReset / 86400)}d`
  }

  const getPeriodLabel = () => {
    if (period === PERIOD_PRESETS.HOURLY) return 'hourly'
    if (period === PERIOD_PRESETS.DAILY) return 'daily'
    if (period === PERIOD_PRESETS.WEEKLY) return 'weekly'
    if (period === PERIOD_PRESETS.MONTHLY) return 'monthly'
    return 'per period'
  }

  return (
    <div
      className="spending-limit-display p-4 rounded-lg"
      style={{
        backgroundColor: 'rgb(var(--card))',
        borderWidth: 1,
        borderColor: isExceeded ? 'rgb(var(--destructive))' : 'rgb(var(--border))',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💰</span>
          <div>
            <p className="font-medium text-sm" style={{ color: 'rgb(var(--foreground))' }}>
              Spending Limit
            </p>
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {tokenSymbol} ({getPeriodLabel()})
            </p>
          </div>
        </div>
        <div
          className="text-xs px-2 py-1 rounded"
          style={{
            backgroundColor: isExceeded
              ? 'rgb(var(--destructive) / 0.1)'
              : 'rgb(var(--success) / 0.1)',
            color: isExceeded ? 'rgb(var(--destructive))' : 'rgb(var(--success))',
          }}
        >
          {isExceeded ? 'Exceeded' : 'Active'}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, usedPercentage)}%`,
              backgroundColor: isExceeded
                ? 'rgb(var(--destructive))'
                : usedPercentage > 80
                  ? 'rgb(var(--warning))'
                  : 'rgb(var(--success))',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {formatEther(spent)} used
          </span>
          <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {formatEther(limit)} limit
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2 rounded" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Remaining
          </p>
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            {formatEther(remaining)} {tokenSymbol}
          </p>
        </div>
        <div className="p-2 rounded" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Resets in
          </p>
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            {resetIn}
          </p>
        </div>
      </div>
    </div>
  )
}

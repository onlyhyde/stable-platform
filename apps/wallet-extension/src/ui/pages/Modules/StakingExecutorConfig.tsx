/**
 * Staking Executor Configuration UI
 * Wizard-based configuration for DeFi staking executor module
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address, Hex } from 'viem'
import { formatEther, parseEther } from 'viem'

// ============================================================================
// Types
// ============================================================================

interface StakingExecutorConfigProps {
  accountAddress: Address
  onSubmit: (initData: Hex) => void
  onBack: () => void
}

interface FormState {
  maxStakePerPoolEth: string
  dailyStakeLimitEth: string
}

type Step = 'pool-limit' | 'daily-limit' | 'review'

// ============================================================================
// Constants
// ============================================================================

const POOL_LIMIT_PRESETS = [
  { label: '1 ETH', value: '1' },
  { label: '5 ETH', value: '5' },
  { label: '10 ETH', value: '10' },
  { label: '32 ETH', value: '32', description: 'Validator stake' },
  { label: '100 ETH', value: '100' },
]

const DAILY_LIMIT_PRESETS = [
  { label: '5 ETH', value: '5' },
  { label: '10 ETH', value: '10' },
  { label: '32 ETH', value: '32' },
  { label: '50 ETH', value: '50' },
  { label: '100 ETH', value: '100' },
]

// ============================================================================
// Helper Functions
// ============================================================================

function encodeStakingExecutorInit(config: {
  maxStakePerPool: bigint
  dailyStakeLimit: bigint
}): Hex {
  const maxStakeHex = config.maxStakePerPool.toString(16).padStart(64, '0')
  const dailyLimitHex = config.dailyStakeLimit.toString(16).padStart(64, '0')
  return `0x${maxStakeHex}${dailyLimitHex}` as Hex
}

// ============================================================================
// Component
// ============================================================================

export function StakingExecutorConfigUI({
  accountAddress,
  onSubmit,
  onBack,
}: StakingExecutorConfigProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')
  const [step, setStep] = useState<Step>('pool-limit')
  const [form, setForm] = useState<FormState>({
    maxStakePerPoolEth: '10',
    dailyStakeLimitEth: '32',
  })

  const steps: Step[] = ['pool-limit', 'daily-limit', 'review']
  const currentIndex = steps.indexOf(step)

  const maxStakePerPoolWei = useMemo(() => {
    try {
      return parseEther(form.maxStakePerPoolEth || '0')
    } catch {
      return 0n
    }
  }, [form.maxStakePerPoolEth])

  const dailyStakeLimitWei = useMemo(() => {
    try {
      return parseEther(form.dailyStakeLimitEth || '0')
    } catch {
      return 0n
    }
  }, [form.dailyStakeLimitEth])

  const isValid = useMemo(() => {
    if (maxStakePerPoolWei <= 0n) return false
    if (dailyStakeLimitWei <= 0n) return false
    return true
  }, [maxStakePerPoolWei, dailyStakeLimitWei])

  const handleNext = () => {
    const nextStepValue = steps[currentIndex + 1]
    if (currentIndex < steps.length - 1 && nextStepValue) {
      setStep(nextStepValue)
    }
  }

  const handleBack = () => {
    const prevStepValue = steps[currentIndex - 1]
    if (currentIndex > 0 && prevStepValue) {
      setStep(prevStepValue)
    } else {
      onBack()
    }
  }

  const handleSubmit = () => {
    if (!isValid) return

    const initData = encodeStakingExecutorInit({
      maxStakePerPool: maxStakePerPoolWei,
      dailyStakeLimit: dailyStakeLimitWei,
    })

    onSubmit(initData)
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i <= currentIndex ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-16 h-1 mx-2 ${i < currentIndex ? 'bg-green-500' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'pool-limit' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('maxStakePerPool')}</h3>
          <p className="text-sm text-gray-500">{t('maxStakePerPoolDesc')}</p>

          <div className="grid grid-cols-3 gap-2">
            {POOL_LIMIT_PRESETS.slice(0, 3).map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, maxStakePerPoolEth: preset.value }))}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  form.maxStakePerPoolEth === preset.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>{preset.label}</div>
                {preset.description && (
                  <div className="text-xs text-gray-500">
                    {preset.description === 'Validator stake'
                      ? t('validatorStake')
                      : preset.description}
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {POOL_LIMIT_PRESETS.slice(3).map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, maxStakePerPoolEth: preset.value }))}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  form.maxStakePerPoolEth === preset.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>{preset.label}</div>
                {preset.description && (
                  <div className="text-xs text-gray-500">
                    {preset.description === 'Validator stake'
                      ? t('validatorStake')
                      : preset.description}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label
              htmlFor="custom-pool-limit"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('customLimitEth')}
            </label>
            <input
              id="custom-pool-limit"
              type="text"
              value={form.maxStakePerPoolEth}
              onChange={(e) => setForm((f) => ({ ...f, maxStakePerPoolEth: e.target.value }))}
              placeholder={t('enterAmountInEth')}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </div>
      )}

      {step === 'daily-limit' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('dailyStakingLimit')}</h3>
          <p className="text-sm text-gray-500">{t('dailyStakingLimitDesc')}</p>

          <div className="grid grid-cols-3 gap-2">
            {DAILY_LIMIT_PRESETS.slice(0, 3).map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, dailyStakeLimitEth: preset.value }))}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  form.dailyStakeLimitEth === preset.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DAILY_LIMIT_PRESETS.slice(3).map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, dailyStakeLimitEth: preset.value }))}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  form.dailyStakeLimitEth === preset.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label
              htmlFor="custom-daily-stake-limit"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('customLimitEth')}
            </label>
            <input
              id="custom-daily-stake-limit"
              type="text"
              value={form.dailyStakeLimitEth}
              onChange={(e) => setForm((f) => ({ ...f, dailyStakeLimitEth: e.target.value }))}
              placeholder={t('enterAmountInEth')}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-800">
              <strong>{t('tip')}</strong> {t('stakingTip')}
            </p>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('reviewConfiguration')}</h3>
          <p className="text-sm text-gray-500">{t('reviewStakingConfig')}</p>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('account')}</span>
              <span className="font-mono text-sm">
                {accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('maxStakePerPool')}</span>
              <span className="font-medium">{form.maxStakePerPoolEth} ETH</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('dailyStakeLimit')}</span>
              <span className="font-medium">{form.dailyStakeLimitEth} ETH</span>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              <strong>{t('benefits')}</strong> {t('stakingBenefits')}
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>{t('note')}</strong> {t('stakingNote')}
            </p>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={handleBack}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {tc('back')}
        </button>
        {step !== 'review' ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            {tc('next')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('installModule')}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Display Component (for installed module)
// ============================================================================

interface StakingExecutorDisplayProps {
  maxStakePerPool: bigint
  dailyStakeLimit: bigint
  stakedToday: bigint
  totalStaked: bigint
  pendingRewards: bigint
}

export function StakingExecutorDisplay({
  maxStakePerPool,
  dailyStakeLimit,
  stakedToday,
  totalStaked,
  pendingRewards,
}: StakingExecutorDisplayProps) {
  const { t } = useTranslation('modules')
  const remainingLimit = dailyStakeLimit - stakedToday
  const usagePercent = dailyStakeLimit > 0n ? Number((stakedToday * 100n) / dailyStakeLimit) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-sm text-green-600">{t('totalStaked')}</div>
          <div className="font-semibold text-lg">{formatEther(totalStaked)} ETH</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="text-sm text-yellow-600">{t('pendingRewards')}</div>
          <div className="font-semibold text-lg">{formatEther(pendingRewards)} ETH</div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-600">{t('maxStakePerPool')}</span>
        <span className="font-medium">{formatEther(maxStakePerPool)} ETH</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">{t('dailyStakeUsage')}</span>
          <span>
            {formatEther(stakedToday)} / {formatEther(dailyStakeLimit)} ETH
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              usagePercent > 90
                ? 'bg-red-500'
                : usagePercent > 70
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          {t('remainingAmount', { amount: formatEther(remainingLimit) })}
        </p>
      </div>
    </div>
  )
}

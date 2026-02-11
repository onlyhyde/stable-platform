/**
 * Lending Executor Configuration UI
 * Wizard-based configuration for DeFi lending executor module
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address, Hex } from 'viem'
import { formatEther, parseEther } from 'viem'

// ============================================================================
// Types
// ============================================================================

interface LendingExecutorConfigProps {
  accountAddress: Address
  onSubmit: (initData: Hex) => void
  onBack: () => void
}

interface FormState {
  maxLtvBps: number
  minHealthFactor: string
  dailyBorrowLimitEth: string
}

type Step = 'ltv' | 'health' | 'limits' | 'review'

// ============================================================================
// Constants
// ============================================================================

const LTV_PRESETS = [
  { label: '50%', value: 5000, description: 'Conservative' },
  { label: '65%', value: 6500, description: 'Moderate' },
  { label: '80%', value: 8000, description: 'Aggressive' },
]

const HEALTH_FACTOR_PRESETS = [
  { label: '1.5', value: '1.5', description: 'Safe' },
  { label: '1.25', value: '1.25', description: 'Moderate' },
  { label: '1.1', value: '1.1', description: 'Risky' },
]

const BORROW_LIMIT_PRESETS = [
  { label: '1 ETH', value: '1' },
  { label: '5 ETH', value: '5' },
  { label: '10 ETH', value: '10' },
  { label: '25 ETH', value: '25' },
  { label: '50 ETH', value: '50' },
]

// ============================================================================
// Helper Functions
// ============================================================================

function encodeLendingExecutorInit(config: {
  maxLtv: number
  minHealthFactor: bigint
  dailyBorrowLimit: bigint
}): Hex {
  const maxLtvHex = config.maxLtv.toString(16).padStart(64, '0')
  const minHfHex = config.minHealthFactor.toString(16).padStart(64, '0')
  const dailyLimitHex = config.dailyBorrowLimit.toString(16).padStart(64, '0')
  return `0x${maxLtvHex}${minHfHex}${dailyLimitHex}` as Hex
}

function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(1)
}

function parseHealthFactor(value: string): bigint {
  try {
    const num = Number.parseFloat(value)
    if (Number.isNaN(num) || num <= 0) return 0n
    // Health factor is scaled by 1e18
    return BigInt(Math.floor(num * 1e18))
  } catch {
    return 0n
  }
}

function formatHealthFactor(value: bigint): string {
  return (Number(value) / 1e18).toFixed(2)
}

// ============================================================================
// Component
// ============================================================================

const DESCRIPTION_KEYS: Record<string, string> = {
  Conservative: 'conservative',
  Moderate: 'moderate',
  Aggressive: 'aggressive',
  Safe: 'safe',
  Risky: 'risky',
}

export function LendingExecutorConfigUI({
  accountAddress,
  onSubmit,
  onBack,
}: LendingExecutorConfigProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')
  const [step, setStep] = useState<Step>('ltv')
  const [form, setForm] = useState<FormState>({
    maxLtvBps: 8000, // 80% default
    minHealthFactor: '1.25',
    dailyBorrowLimitEth: '10',
  })

  const steps: Step[] = ['ltv', 'health', 'limits', 'review']
  const currentIndex = steps.indexOf(step)

  const minHealthFactorWei = useMemo(
    () => parseHealthFactor(form.minHealthFactor),
    [form.minHealthFactor]
  )

  const dailyBorrowLimitWei = useMemo(() => {
    try {
      return parseEther(form.dailyBorrowLimitEth || '0')
    } catch {
      return 0n
    }
  }, [form.dailyBorrowLimitEth])

  const isValid = useMemo(() => {
    if (form.maxLtvBps <= 0 || form.maxLtvBps > 9500) return false
    if (minHealthFactorWei < parseEther('1')) return false // Min HF must be >= 1
    if (dailyBorrowLimitWei <= 0n) return false
    return true
  }, [form.maxLtvBps, minHealthFactorWei, dailyBorrowLimitWei])

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

    const initData = encodeLendingExecutorInit({
      maxLtv: form.maxLtvBps,
      minHealthFactor: minHealthFactorWei,
      dailyBorrowLimit: dailyBorrowLimitWei,
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
                i <= currentIndex ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-1 mx-1 ${i < currentIndex ? 'bg-purple-500' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'ltv' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('maximumLTV')}</h3>
          <p className="text-sm text-gray-500">{t('ltvDescription')}</p>

          <div className="grid grid-cols-3 gap-3">
            {LTV_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, maxLtvBps: preset.value }))}
                className={`p-4 rounded-lg border text-center transition-colors ${
                  form.maxLtvBps === preset.value
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">{preset.label}</div>
                <div className="text-xs text-gray-500">
                  {t(DESCRIPTION_KEYS[preset.description] || preset.description)}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label
              htmlFor="custom-ltv-bps"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('customLtvBps')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="custom-ltv-bps"
                type="number"
                min="1000"
                max="9500"
                step="100"
                value={form.maxLtvBps}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxLtvBps: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
                className="flex-1 p-2 border rounded-lg"
              />
              <span className="text-gray-500 w-16">= {bpsToPercent(form.maxLtvBps)}%</span>
            </div>
          </div>
        </div>
      )}

      {step === 'health' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('minHealthFactor')}</h3>
          <p className="text-sm text-gray-500">{t('minHealthFactorDesc')}</p>

          <div className="grid grid-cols-3 gap-3">
            {HEALTH_FACTOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, minHealthFactor: preset.value }))}
                className={`p-4 rounded-lg border text-center transition-colors ${
                  form.minHealthFactor === preset.value
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">{preset.label}</div>
                <div className="text-xs text-gray-500">
                  {t(DESCRIPTION_KEYS[preset.description] || preset.description)}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label
              htmlFor="custom-health-factor"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('customHealthFactor')}
            </label>
            <input
              id="custom-health-factor"
              type="text"
              value={form.minHealthFactor}
              onChange={(e) => setForm((f) => ({ ...f, minHealthFactor: e.target.value }))}
              placeholder="e.g., 1.25"
              className="w-full p-2 border rounded-lg"
            />
            <p className="text-xs text-gray-400 mt-1">{t('healthFactorMinWarning')}</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-800">
              <strong>{t('healthFactorGuide')}</strong>
            </p>
            <ul className="text-xs text-blue-700 mt-1 space-y-1">
              <li>{t('hfVerySafe')}</li>
              <li>{t('hfSafe')}</li>
              <li>{t('hfModerate')}</li>
              <li>{t('hfHighRisk')}</li>
              <li>{t('hfLiquidatable')}</li>
            </ul>
          </div>
        </div>
      )}

      {step === 'limits' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('dailyBorrowLimit')}</h3>
          <p className="text-sm text-gray-500">{t('dailyBorrowLimitDesc')}</p>

          <div className="grid grid-cols-3 gap-2">
            {BORROW_LIMIT_PRESETS.slice(0, 3).map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, dailyBorrowLimitEth: preset.value }))}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  form.dailyBorrowLimitEth === preset.value
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BORROW_LIMIT_PRESETS.slice(3).map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, dailyBorrowLimitEth: preset.value }))}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  form.dailyBorrowLimitEth === preset.value
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label
              htmlFor="custom-borrow-limit"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('customBorrowLimit')}
            </label>
            <input
              id="custom-borrow-limit"
              type="text"
              value={form.dailyBorrowLimitEth}
              onChange={(e) => setForm((f) => ({ ...f, dailyBorrowLimitEth: e.target.value }))}
              placeholder={t('enterAmount')}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('reviewConfiguration')}</h3>
          <p className="text-sm text-gray-500">{t('reviewLendingConfig')}</p>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('account')}</span>
              <span className="font-mono text-sm">
                {accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('maxLtvLabel')}</span>
              <span className="font-medium">{bpsToPercent(form.maxLtvBps)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('minHealthFactorLabel')}</span>
              <span className="font-medium">{form.minHealthFactor}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('dailyBorrowLimitLabel')}</span>
              <span className="font-medium">{form.dailyBorrowLimitEth} ETH</span>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>{t('warning')}</strong> {t('lendingWarning')}
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
            className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            {tc('next')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
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

interface LendingExecutorDisplayProps {
  maxLtvBps: number
  minHealthFactor: bigint
  currentHealthFactor: bigint
  dailyBorrowLimit: bigint
  borrowedToday: bigint
}

export function LendingExecutorDisplay({
  maxLtvBps,
  minHealthFactor,
  currentHealthFactor,
  dailyBorrowLimit,
  borrowedToday,
}: LendingExecutorDisplayProps) {
  const { t } = useTranslation('modules')
  const remainingLimit = dailyBorrowLimit - borrowedToday
  const usagePercent = dailyBorrowLimit > 0n ? Number((borrowedToday * 100n) / dailyBorrowLimit) : 0

  const healthStatus = useMemo(() => {
    const hf = Number(currentHealthFactor) / 1e18
    if (hf >= 2) return { color: 'text-green-600', label: t('verySafe') }
    if (hf >= 1.5) return { color: 'text-green-500', label: t('safe') }
    if (hf >= 1.25) return { color: 'text-yellow-500', label: t('moderate') }
    if (hf >= 1.0) return { color: 'text-orange-500', label: t('atRisk') }
    return { color: 'text-red-600', label: t('liquidatable') }
  }, [currentHealthFactor, t])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-gray-600">{t('maxLtvLabel')}</span>
        <span className="font-medium">{bpsToPercent(maxLtvBps)}%</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-600">{t('minHealthFactorLabel')}</span>
        <span className="font-medium">{formatHealthFactor(minHealthFactor)}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-600">{t('currentHealthFactor')}</span>
        <span className={`font-medium ${healthStatus.color}`}>
          {formatHealthFactor(currentHealthFactor)} ({healthStatus.label})
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">{t('dailyBorrowUsage')}</span>
          <span>
            {formatEther(borrowedToday)} / {formatEther(dailyBorrowLimit)} ETH
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              usagePercent > 90
                ? 'bg-red-500'
                : usagePercent > 70
                  ? 'bg-yellow-500'
                  : 'bg-purple-500'
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

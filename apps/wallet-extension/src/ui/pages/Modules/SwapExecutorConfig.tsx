/**
 * Swap Executor Configuration UI
 * Wizard-based configuration for DEX swap executor module
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address, Hex } from 'viem'
import { formatEther, parseEther } from 'viem'

// ============================================================================
// Types
// ============================================================================

interface SwapExecutorConfigProps {
  accountAddress: Address
  onSubmit: (initData: Hex) => void
  onBack: () => void
}

interface FormState {
  maxSlippageBps: number
  dailyLimitEth: string
}

type Step = 'slippage' | 'limits' | 'review'

// ============================================================================
// Constants
// ============================================================================

const SLIPPAGE_PRESETS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
  { label: '3%', value: 300 },
]

const DAILY_LIMIT_PRESETS = [
  { label: '1 ETH', value: '1' },
  { label: '5 ETH', value: '5' },
  { label: '10 ETH', value: '10' },
  { label: '50 ETH', value: '50' },
  { label: '100 ETH', value: '100' },
]

// ============================================================================
// Helper Functions
// ============================================================================

function encodeSwapExecutorInit(config: { maxSlippageBps: number; dailyLimit: bigint }): Hex {
  const maxSlippageHex = config.maxSlippageBps.toString(16).padStart(64, '0')
  const dailyLimitHex = config.dailyLimit.toString(16).padStart(64, '0')
  return `0x${maxSlippageHex}${dailyLimitHex}` as Hex
}

function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2)
}

// ============================================================================
// Component
// ============================================================================

export function SwapExecutorConfigUI({
  accountAddress,
  onSubmit,
  onBack,
}: SwapExecutorConfigProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')
  const [step, setStep] = useState<Step>('slippage')
  const [form, setForm] = useState<FormState>({
    maxSlippageBps: 100, // 1% default
    dailyLimitEth: '10',
  })

  const steps: Step[] = ['slippage', 'limits', 'review']
  const currentIndex = steps.indexOf(step)

  const dailyLimitWei = useMemo(() => {
    try {
      return parseEther(form.dailyLimitEth || '0')
    } catch {
      return 0n
    }
  }, [form.dailyLimitEth])

  const isValid = useMemo(() => {
    if (form.maxSlippageBps <= 0 || form.maxSlippageBps > 5000) return false
    if (dailyLimitWei <= 0n) return false
    return true
  }, [form.maxSlippageBps, dailyLimitWei])

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

    const initData = encodeSwapExecutorInit({
      maxSlippageBps: form.maxSlippageBps,
      dailyLimit: dailyLimitWei,
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
                i <= currentIndex ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-12 h-1 mx-2 ${i < currentIndex ? 'bg-blue-500' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'slippage' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('maxSlippageTolerance')}</h3>
          <p className="text-sm text-gray-500">{t('slippageDescription')}</p>

          <div className="grid grid-cols-4 gap-2">
            {SLIPPAGE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, maxSlippageBps: preset.value }))}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  form.maxSlippageBps === preset.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label
              htmlFor="custom-slippage-bps"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('customSlippage')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="custom-slippage-bps"
                type="number"
                min="1"
                max="5000"
                value={form.maxSlippageBps}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxSlippageBps: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
                className="flex-1 p-2 border rounded-lg"
              />
              <span className="text-gray-500">= {bpsToPercent(form.maxSlippageBps)}%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{t('bpsDescription')}</p>
          </div>
        </div>
      )}

      {step === 'limits' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('dailySwapLimit')}</h3>
          <p className="text-sm text-gray-500">{t('dailySwapLimitDesc')}</p>

          <div className="grid grid-cols-3 gap-2">
            {DAILY_LIMIT_PRESETS.slice(0, 3).map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, dailyLimitEth: preset.value }))}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  form.dailyLimitEth === preset.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
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
                onClick={() => setForm((f) => ({ ...f, dailyLimitEth: preset.value }))}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  form.dailyLimitEth === preset.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label
              htmlFor="custom-swap-daily-limit"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('customLimit')}
            </label>
            <input
              id="custom-swap-daily-limit"
              type="text"
              value={form.dailyLimitEth}
              onChange={(e) => setForm((f) => ({ ...f, dailyLimitEth: e.target.value }))}
              placeholder={t('enterAmountInEth')}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('reviewConfiguration')}</h3>
          <p className="text-sm text-gray-500">{t('reviewConfigDesc')}</p>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('account')}</span>
              <span className="font-mono text-sm">
                {accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('maxSlippageLabel')}</span>
              <span className="font-medium">{bpsToPercent(form.maxSlippageBps)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('dailyLimit')}</span>
              <span className="font-medium">{form.dailyLimitEth} ETH</span>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>{t('note')}</strong> {t('swapNote')}
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
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {tc('next')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
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

interface SwapExecutorDisplayProps {
  maxSlippageBps: number
  dailyLimit: bigint
  usedToday: bigint
}

export function SwapExecutorDisplay({
  maxSlippageBps,
  dailyLimit,
  usedToday,
}: SwapExecutorDisplayProps) {
  const { t } = useTranslation('modules')
  const remainingLimit = dailyLimit - usedToday
  const usagePercent = dailyLimit > 0n ? Number((usedToday * 100n) / dailyLimit) : 0

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-gray-600">{t('maxSlippageLabel')}</span>
        <span className="font-medium">{bpsToPercent(maxSlippageBps)}%</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">{t('dailyLimitUsage')}</span>
          <span>
            {formatEther(usedToday)} / {formatEther(dailyLimit)} ETH
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

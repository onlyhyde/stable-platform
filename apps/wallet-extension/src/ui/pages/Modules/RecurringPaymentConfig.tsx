/**
 * Recurring Payment Executor Configuration UI
 * Wizard-based configuration for automated recurring payments
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address, Hex } from 'viem'
import { encodeAbiParameters, formatEther, isAddress, parseAbiParameters, parseEther } from 'viem'
import { useNetworkCurrency } from '../../hooks/useNetworkCurrency'

// ============================================================================
// Types
// ============================================================================

interface RecurringPaymentConfigProps {
  accountAddress: Address
  onSubmit: (initData: Hex) => void
  onBack: () => void
}

interface FormState {
  recipient: string
  tokenType: 'native' | 'custom'
  customToken: string
  amountEth: string
  intervalType: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
  customIntervalDays: number
  maxPayments: number
  unlimited: boolean
}

type Step = 'recipient' | 'amount' | 'schedule' | 'review'

// ============================================================================
// Constants
// ============================================================================

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

const INTERVAL_PRESETS = {
  daily: { label: 'Daily', seconds: 86400, description: 'Every day' },
  weekly: { label: 'Weekly', seconds: 86400 * 7, description: 'Every 7 days' },
  biweekly: { label: 'Bi-weekly', seconds: 86400 * 14, description: 'Every 14 days' },
  monthly: { label: 'Monthly', seconds: 86400 * 30, description: 'Every 30 days' },
} as const

const MAX_PAYMENTS_PRESETS = [
  { label: '3 months', value: 3 },
  { label: '6 months', value: 6 },
  { label: '1 year', value: 12 },
  { label: '2 years', value: 24 },
]

// ============================================================================
// Helper Functions
// ============================================================================

function encodeRecurringPaymentInit(config: {
  recipient: Address
  token: Address
  amount: bigint
  interval: number
  maxPayments: number
}): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      'address recipient, address token, uint256 amount, uint64 interval, uint32 maxPayments'
    ),
    [config.recipient, config.token, config.amount, BigInt(config.interval), config.maxPayments]
  )
}

function getIntervalSeconds(form: FormState): number {
  if (form.intervalType === 'custom') {
    return form.customIntervalDays * 86400
  }
  return INTERVAL_PRESETS[form.intervalType].seconds
}

function _formatInterval(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  if (days === 1) return 'Daily'
  if (days === 7) return 'Weekly'
  if (days === 14) return 'Bi-weekly'
  if (days === 30) return 'Monthly'
  return `Every ${days} days`
}

// ============================================================================
// Component
// ============================================================================

const INTERVAL_LABEL_KEYS: Record<string, string> = {
  daily: 'daily',
  weekly: 'weekly',
  biweekly: 'biweekly',
  monthly: 'monthly',
}

const INTERVAL_DESC_KEYS: Record<string, string> = {
  daily: 'everyDay',
  weekly: 'every7Days',
  biweekly: 'every14Days',
  monthly: 'every30Days',
}

const MAX_PAYMENTS_LABEL_KEYS: Record<string, string> = {
  '3 months': '3months',
  '6 months': '6months',
  '1 year': '1year',
  '2 years': '2years',
}

export function RecurringPaymentConfigUI({
  accountAddress,
  onSubmit,
  onBack,
}: RecurringPaymentConfigProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')
  const { symbol: nativeSymbol } = useNetworkCurrency()
  const [step, setStep] = useState<Step>('recipient')
  const [form, setForm] = useState<FormState>({
    recipient: '',
    tokenType: 'native',
    customToken: '',
    amountEth: '0.1',
    intervalType: 'monthly',
    customIntervalDays: 30,
    maxPayments: 12,
    unlimited: false,
  })

  const steps: Step[] = ['recipient', 'amount', 'schedule', 'review']
  const currentIndex = steps.indexOf(step)

  const tokenAddress = useMemo(() => {
    if (form.tokenType === 'native') return ZERO_ADDRESS
    return (form.customToken as Address) || ZERO_ADDRESS
  }, [form.tokenType, form.customToken])

  const amountWei = useMemo(() => {
    try {
      return parseEther(form.amountEth || '0')
    } catch {
      return 0n
    }
  }, [form.amountEth])

  const intervalSeconds = useMemo(() => getIntervalSeconds(form), [form])

  const isValid = useMemo(() => {
    if (!form.recipient || !isAddress(form.recipient)) return false
    if (form.recipient === ZERO_ADDRESS) return false
    if (form.tokenType === 'custom' && (!form.customToken || !isAddress(form.customToken))) {
      return false
    }
    if (amountWei <= 0n) return false
    if (intervalSeconds < 86400) return false // Min 1 day
    return true
  }, [form, amountWei, intervalSeconds])

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

    const initData = encodeRecurringPaymentInit({
      recipient: form.recipient as Address,
      token: tokenAddress,
      amount: amountWei,
      interval: intervalSeconds,
      maxPayments: form.unlimited ? 0 : form.maxPayments,
    })

    onSubmit(initData)
  }

  // Calculate totals for review
  const totalPayments = form.unlimited ? t('unlimited') : form.maxPayments
  const totalAmount = form.unlimited
    ? t('unlimited')
    : `${(Number.parseFloat(form.amountEth) * form.maxPayments).toFixed(4)} ETH`

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i <= currentIndex ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-1 mx-1 ${i < currentIndex ? 'bg-orange-500' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'recipient' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('paymentRecipient')}</h3>
          <p className="text-sm text-gray-500">{t('paymentRecipientDesc')}</p>

          <div>
            <label
              htmlFor="recipient-address"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('recipientAddress')}
            </label>
            <input
              id="recipient-address"
              type="text"
              value={form.recipient}
              onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))}
              placeholder="0x..."
              className="w-full p-3 border rounded-lg font-mono text-sm"
            />
            {form.recipient && !isAddress(form.recipient) && (
              <p className="text-xs text-red-500 mt-1">{t('invalidAddress')}</p>
            )}
          </div>

          <div className="mt-4">
            <span className="block text-sm font-medium text-gray-700 mb-2">
              {t('paymentToken')}
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, tokenType: 'native' }))}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  form.tokenType === 'native'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{tc('eth')}</div>
                <div className="text-xs text-gray-500">{t('nativeToken')}</div>
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, tokenType: 'custom' }))}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  form.tokenType === 'custom'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">ERC-20</div>
                <div className="text-xs text-gray-500">{t('customToken')}</div>
              </button>
            </div>
          </div>

          {form.tokenType === 'custom' && (
            <div className="mt-3">
              <label
                htmlFor="token-contract-address"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t('tokenContractAddress')}
              </label>
              <input
                id="token-contract-address"
                type="text"
                value={form.customToken}
                onChange={(e) => setForm((f) => ({ ...f, customToken: e.target.value }))}
                placeholder="0x..."
                className="w-full p-2 border rounded-lg font-mono text-sm"
              />
            </div>
          )}
        </div>
      )}

      {step === 'amount' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('paymentAmount')}</h3>
          <p className="text-sm text-gray-500">{t('paymentAmountDesc')}</p>

          <div>
            <label
              htmlFor="amount-per-payment"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('amountPerPayment', { unit: form.tokenType === 'native' ? nativeSymbol : tc('tokens') })}
            </label>
            <input
              id="amount-per-payment"
              type="text"
              value={form.amountEth}
              onChange={(e) => setForm((f) => ({ ...f, amountEth: e.target.value }))}
              placeholder="0.1"
              className="w-full p-3 border rounded-lg text-lg"
            />
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3">
            {['0.01', '0.05', '0.1', '0.5'].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setForm((f) => ({ ...f, amountEth: amount }))}
                className={`p-2 rounded-lg border text-sm transition-colors ${
                  form.amountEth === amount
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {amount} {nativeSymbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'schedule' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('paymentSchedule')}</h3>
          <p className="text-sm text-gray-500">{t('paymentScheduleDesc')}</p>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">
              {t('paymentFrequency')}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(INTERVAL_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      intervalType: key as FormState['intervalType'],
                    }))
                  }
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    form.intervalType === key
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{t(INTERVAL_LABEL_KEYS[key] || key)}</div>
                  <div className="text-xs text-gray-500">{t(INTERVAL_DESC_KEYS[key] || key)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <span className="block text-sm font-medium text-gray-700 mb-2">
              {t('durationLabel')}
            </span>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="unlimited"
                checked={form.unlimited}
                onChange={(e) => setForm((f) => ({ ...f, unlimited: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="unlimited" className="text-sm">
                {t('unlimitedPayments')}
              </label>
            </div>

            {!form.unlimited && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {MAX_PAYMENTS_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, maxPayments: preset.value }))}
                      className={`p-2 rounded-lg border text-sm transition-colors ${
                        form.maxPayments === preset.value
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {t(MAX_PAYMENTS_LABEL_KEYS[preset.label] || preset.label)}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <label htmlFor="custom-max-payments" className="block text-sm text-gray-600 mb-1">
                    {t('customPayments')}
                  </label>
                  <input
                    id="custom-max-payments"
                    type="number"
                    min="1"
                    max="1000"
                    value={form.maxPayments}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        maxPayments: Number.parseInt(e.target.value, 10) || 1,
                      }))
                    }
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('reviewRecurringPayment')}</h3>
          <p className="text-sm text-gray-500">{t('reviewRecurringPaymentDesc')}</p>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('fromAccount')}</span>
              <span className="font-mono text-sm">
                {accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('toRecipient')}</span>
              <span className="font-mono text-sm">
                {form.recipient.slice(0, 6)}...{form.recipient.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('token')}</span>
              <span className="font-medium">{form.tokenType === 'native' ? nativeSymbol : 'ERC-20'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('amountPerPaymentLabel')}</span>
              <span className="font-medium">{form.amountEth} {nativeSymbol}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('frequency')}</span>
              <span className="font-medium">
                {intervalSeconds === 86400
                  ? t('daily')
                  : intervalSeconds === 86400 * 7
                    ? t('weekly')
                    : intervalSeconds === 86400 * 14
                      ? t('biweekly')
                      : intervalSeconds === 86400 * 30
                        ? t('monthly')
                        : t('everyNDays', { count: Math.floor(intervalSeconds / 86400) })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('totalPayments')}</span>
              <span className="font-medium">{totalPayments}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('totalAmount')}</span>
              <span className="font-medium">{totalAmount}</span>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>{t('important')}</strong> {t('recurringPaymentWarning')}
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
            disabled={step === 'recipient' && (!form.recipient || !isAddress(form.recipient))}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {tc('next')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
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

interface RecurringPaymentDisplayProps {
  recipient: Address
  token: Address
  amount: bigint
  interval: number
  maxPayments: number
  paymentsMade: number
  nextPaymentTime: number
  isActive: boolean
}

export function RecurringPaymentDisplay({
  recipient,
  token,
  amount,
  interval,
  maxPayments,
  paymentsMade,
  nextPaymentTime,
  isActive,
}: RecurringPaymentDisplayProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')
  const { symbol: nativeSymbol } = useNetworkCurrency()
  const isNativeToken = token === ZERO_ADDRESS
  const remainingPayments = maxPayments === 0 ? t('unlimited') : maxPayments - paymentsMade
  const nextPaymentDate = new Date(nextPaymentTime * 1000)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-gray-600">{t('status')}</span>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {isActive ? t('active') : t('paused')}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-600">{t('recipientLabel')}</span>
        <span className="font-mono text-sm">
          {recipient.slice(0, 6)}...{recipient.slice(-4)}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-600">{t('recurringAmount')}</span>
        <span className="font-medium">
          {formatEther(amount)} {isNativeToken ? nativeSymbol : tc('tokens')}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-600">{t('frequency')}</span>
        <span>
          {interval === 86400
            ? t('daily')
            : interval === 86400 * 7
              ? t('weekly')
              : interval === 86400 * 14
                ? t('biweekly')
                : interval === 86400 * 30
                  ? t('monthly')
                  : t('everyNDays', { count: Math.floor(interval / 86400) })}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-600">{t('paymentsMade')}</span>
        <span>
          {paymentsMade} / {maxPayments === 0 ? '∞' : maxPayments}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-600">{t('remaining')}</span>
        <span>{remainingPayments}</span>
      </div>

      {isActive && (
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-sm text-blue-600">{t('nextPayment')}</div>
          <div className="font-medium">{nextPaymentDate.toLocaleDateString()}</div>
          <div className="text-xs text-blue-500">{nextPaymentDate.toLocaleTimeString()}</div>
        </div>
      )}
    </div>
  )
}

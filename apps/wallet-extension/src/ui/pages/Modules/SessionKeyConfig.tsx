import {
  encodeSessionKeyInit,
  type SessionKeyConfig,
  validateSessionKeyConfig,
} from '@stablenet/core'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address, Hex } from 'viem'
import { formatEther, parseEther } from 'viem'

// ============================================================================
// Types
// ============================================================================

interface SessionKeyConfigProps {
  accountAddress: string
  onSubmit: (initData: Hex, config: SessionKeyConfig) => void
  onBack: () => void
}

type Step = 'key' | 'targets' | 'limits' | 'review'

interface FormState {
  sessionKey: string
  allowedTargets: string[]
  allowedSelectors: string[]
  maxValuePerTx: string
  validityDays: number
  validAfterDelay: number // hours
}

// ============================================================================
// Constants
// ============================================================================

const COMMON_SELECTORS = [
  { name: 'transfer', selector: '0xa9059cbb', description: 'ERC-20 Transfer' },
  { name: 'approve', selector: '0x095ea7b3', description: 'ERC-20 Approve' },
  { name: 'transferFrom', selector: '0x23b872dd', description: 'ERC-20 TransferFrom' },
  { name: 'safeTransferFrom', selector: '0x42842e0e', description: 'ERC-721 SafeTransfer' },
  { name: 'swap', selector: '0x5f575529', description: 'Uniswap Swap' },
]

// ============================================================================
// Component
// ============================================================================

export function SessionKeyConfigUI({
  accountAddress: _accountAddress,
  onSubmit,
  onBack,
}: SessionKeyConfigProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')
  const [step, setStep] = useState<Step>('key')
  const [form, setForm] = useState<FormState>({
    sessionKey: '',
    allowedTargets: [''],
    allowedSelectors: [],
    maxValuePerTx: '0.1',
    validityDays: 1,
    validAfterDelay: 0,
  })
  const [errors, setErrors] = useState<string[]>([])

  // Generate random session key
  const generateSessionKey = useCallback(() => {
    const randomBytes = new Uint8Array(20)
    crypto.getRandomValues(randomBytes)
    const address = `0x${Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}` as Address
    setForm((prev) => ({ ...prev, sessionKey: address }))
  }, [])

  // Handle target changes
  const handleAddTarget = useCallback(() => {
    setForm((prev) => ({ ...prev, allowedTargets: [...prev.allowedTargets, ''] }))
  }, [])

  const handleRemoveTarget = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      allowedTargets: prev.allowedTargets.filter((_, i) => i !== index),
    }))
  }, [])

  const handleTargetChange = useCallback((index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      allowedTargets: prev.allowedTargets.map((t, i) => (i === index ? value : t)),
    }))
  }, [])

  // Handle selector toggle
  const handleSelectorToggle = useCallback((selector: string) => {
    setForm((prev) => ({
      ...prev,
      allowedSelectors: prev.allowedSelectors.includes(selector)
        ? prev.allowedSelectors.filter((s) => s !== selector)
        : [...prev.allowedSelectors, selector],
    }))
  }, [])

  // Validate and submit
  const handleSubmit = useCallback(() => {
    const now = Math.floor(Date.now() / 1000)
    const validAfter = now + form.validAfterDelay * 3600
    const validUntil = validAfter + form.validityDays * 86400

    const config: SessionKeyConfig = {
      sessionKey: form.sessionKey as Address,
      allowedTargets: form.allowedTargets.filter((t) => t.length > 0) as Address[],
      allowedSelectors: form.allowedSelectors as Hex[],
      maxValuePerTx: parseEther(form.maxValuePerTx || '0'),
      validAfter,
      validUntil,
    }

    const validation = validateSessionKeyConfig(config)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    const initData = encodeSessionKeyInit(config)
    onSubmit(initData, config)
  }, [form, onSubmit])

  // Navigation
  const canProceed = () => {
    switch (step) {
      case 'key':
        return form.sessionKey.length === 42 && form.sessionKey.startsWith('0x')
      case 'targets':
        return form.allowedTargets.some((t) => t.length === 42)
      case 'limits':
        return Number.parseFloat(form.maxValuePerTx) >= 0
      default:
        return true
    }
  }

  const nextStep = () => {
    const steps: Step[] = ['key', 'targets', 'limits', 'review']
    const currentIndex = steps.indexOf(step)
    const nextStepValue = steps[currentIndex + 1]
    if (currentIndex < steps.length - 1 && nextStepValue) {
      setStep(nextStepValue)
    }
  }

  const prevStep = () => {
    const steps: Step[] = ['key', 'targets', 'limits', 'review']
    const currentIndex = steps.indexOf(step)
    const prevStepValue = steps[currentIndex - 1]
    if (currentIndex > 0 && prevStepValue) {
      setStep(prevStepValue)
    } else {
      onBack()
    }
  }

  return (
    <div className="session-key-config">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🔑</span>
        <div>
          <h3 className="text-lg font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            {t('sessionKeyExecutor')}
          </h3>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('createDelegatedAccess')}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {['key', 'targets', 'limits', 'review'].map((s, i) => (
          <div
            key={s}
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor:
                ['key', 'targets', 'limits', 'review'].indexOf(step) >= i
                  ? 'rgb(var(--primary))'
                  : 'rgb(var(--border))',
            }}
          />
        ))}
      </div>

      {/* Step: Session Key */}
      {step === 'key' && (
        <div className="step-key">
          <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
            {t('sessionKeyAddress')}
          </h4>

          <div
            className="info-card p-3 rounded-lg mb-4"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('sessionKeyInfo')}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="session-key-address"
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground-secondary))' }}
              >
                {t('sessionKeyAddress')}
              </label>
              <div className="flex gap-2">
                <input
                  id="session-key-address"
                  type="text"
                  className="flex-1 px-3 py-2 rounded-lg input-base font-mono text-sm"
                  placeholder="0x..."
                  value={form.sessionKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, sessionKey: e.target.value }))}
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: 'rgb(var(--secondary))' }}
                  onClick={generateSessionKey}
                >
                  {t('generate')}
                </button>
              </div>
            </div>

            <div>
              <span
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground-secondary))' }}
              >
                {t('validityDuration')}
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: t('1Hour'), days: 0, hours: 1 },
                  { label: t('1Day'), days: 1, hours: 0 },
                  { label: t('7Days'), days: 7, hours: 0 },
                  { label: t('30Days'), days: 30, hours: 0 },
                ].map((preset) => (
                  <button
                    type="button"
                    key={preset.label}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor:
                        form.validityDays === preset.days
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--secondary))',
                      color: form.validityDays === preset.days ? 'white' : 'rgb(var(--foreground))',
                    }}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        validityDays: preset.days || preset.hours / 24,
                      }))
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step: Allowed Targets */}
      {step === 'targets' && (
        <div className="step-targets">
          <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
            {t('allowedContracts')}
          </h4>

          <div
            className="info-card p-3 rounded-lg mb-4"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('allowedContractsInfo')}
            </p>
          </div>

          <div className="space-y-2 mb-4">
            {form.allowedTargets.map((target, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: editable target inputs have no stable identifier
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 rounded-lg input-base font-mono text-sm"
                  placeholder="0x... contract address"
                  value={target}
                  onChange={(e) => handleTargetChange(index, e.target.value)}
                />
                {form.allowedTargets.length > 1 && (
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: 'rgb(var(--destructive) / 0.1)',
                      color: 'rgb(var(--destructive))',
                    }}
                    onClick={() => handleRemoveTarget(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="text-sm"
            style={{ color: 'rgb(var(--primary))' }}
            onClick={handleAddTarget}
          >
            {t('addContract')}
          </button>

          <div className="mt-6">
            <h5
              className="text-sm font-medium mb-2"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('allowedFunctions')}
            </h5>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_SELECTORS.map((sel) => (
                <button
                  type="button"
                  key={sel.selector}
                  className="p-2 rounded-lg text-left text-sm"
                  style={{
                    backgroundColor: form.allowedSelectors.includes(sel.selector)
                      ? 'rgb(var(--primary) / 0.1)'
                      : 'rgb(var(--secondary))',
                    borderWidth: 1,
                    borderColor: form.allowedSelectors.includes(sel.selector)
                      ? 'rgb(var(--primary))'
                      : 'transparent',
                  }}
                  onClick={() => handleSelectorToggle(sel.selector)}
                >
                  <span className="font-mono text-xs" style={{ color: 'rgb(var(--primary))' }}>
                    {sel.selector}
                  </span>
                  <span className="block" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {sel.description}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('noFunctionsSelectedInfo')}
            </p>
          </div>
        </div>
      )}

      {/* Step: Limits */}
      {step === 'limits' && (
        <div className="step-limits">
          <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
            {t('spendingLimits')}
          </h4>

          <div
            className="info-card p-3 rounded-lg mb-4"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('spendingLimitsInfo')}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="max-value-per-tx"
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground-secondary))' }}
              >
                {t('maxValuePerTx')}
              </label>
              <input
                id="max-value-per-tx"
                type="number"
                className="w-full px-3 py-2 rounded-lg input-base"
                placeholder="0.1"
                value={form.maxValuePerTx}
                onChange={(e) => setForm((prev) => ({ ...prev, maxValuePerTx: e.target.value }))}
                step="0.01"
                min="0"
              />
              <div className="flex gap-2 mt-2">
                {['0', '0.1', '1', '10'].map((val) => (
                  <button
                    type="button"
                    key={val}
                    className="px-3 py-1 rounded text-sm"
                    style={{ backgroundColor: 'rgb(var(--secondary))' }}
                    onClick={() => setForm((prev) => ({ ...prev, maxValuePerTx: val }))}
                  >
                    {val} {tc('eth')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="start-delay"
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground-secondary))' }}
              >
                {t('startDelay')}
              </label>
              <select
                id="start-delay"
                className="w-full px-3 py-2 rounded-lg input-base"
                value={form.validAfterDelay}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    validAfterDelay: Number.parseInt(e.target.value, 10),
                  }))
                }
              >
                <option value={0}>{t('immediately')}</option>
                <option value={1}>{t('in1Hour')}</option>
                <option value={24}>{t('in24Hours')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div className="step-review">
          <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
            {t('reviewSessionKey')}
          </h4>

          {errors.length > 0 && (
            <div
              className="p-3 rounded-lg mb-4"
              style={{
                backgroundColor: 'rgb(var(--destructive) / 0.1)',
                color: 'rgb(var(--destructive))',
              }}
            >
              {errors.map((err) => (
                <p key={err} className="text-sm">
                  {err}
                </p>
              ))}
            </div>
          )}

          <div
            className="space-y-3 p-4 rounded-lg"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <div className="flex justify-between">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>{t('sessionKey')}</span>
              <span className="font-mono text-xs" style={{ color: 'rgb(var(--foreground))' }}>
                {form.sessionKey.slice(0, 10)}...{form.sessionKey.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('allowedContractsCount')}
              </span>
              <span style={{ color: 'rgb(var(--foreground))' }}>
                {form.allowedTargets.filter((t) => t.length > 0).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('allowedFunctionsCount')}
              </span>
              <span style={{ color: 'rgb(var(--foreground))' }}>
                {form.allowedSelectors.length || t('all')}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>{t('maxValueTx')}</span>
              <span style={{ color: 'rgb(var(--foreground))' }}>
                {form.maxValuePerTx} {tc('eth')}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>{t('duration')}</span>
              <span style={{ color: 'rgb(var(--foreground))' }}>
                {form.validityDays < 1
                  ? t('hoursUnit', { count: Math.round(form.validityDays * 24) })
                  : t('daysUnit', { count: form.validityDays })}
              </span>
            </div>
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
              <strong>{t('warning')}</strong> {t('sessionKeyWarning')}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          className="btn-ghost flex-1 py-3 rounded-lg font-medium"
          onClick={prevStep}
        >
          {step === 'key' ? tc('cancel') : tc('back')}
        </button>
        {step === 'review' ? (
          <button
            type="button"
            className="btn-primary flex-1 py-3 rounded-lg font-medium"
            onClick={handleSubmit}
          >
            {t('installExecutor')}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary flex-1 py-3 rounded-lg font-medium"
            onClick={nextStep}
            disabled={!canProceed()}
          >
            {tc('continue')}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Session Key List Component
// ============================================================================

interface SessionKeyEntry {
  sessionKey: Address
  allowedTargets: Address[]
  allowedSelectors: Hex[]
  maxValuePerTx: bigint
  validAfter: number
  validUntil: number
  createdAt: string
}

interface SessionKeyListProps {
  sessionKeys: SessionKeyEntry[]
  onRevoke?: (sessionKey: Address) => void
}

export function SessionKeyList({ sessionKeys, onRevoke }: SessionKeyListProps) {
  const { t } = useTranslation('modules')
  const now = Math.floor(Date.now() / 1000)

  if (sessionKeys.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {t('noSessionKeys')}
      </div>
    )
  }

  return (
    <div className="session-key-list space-y-3">
      {sessionKeys.map((sk) => {
        const isActive = now >= sk.validAfter && now < sk.validUntil
        const isExpired = now >= sk.validUntil
        const isPending = now < sk.validAfter

        return (
          <div
            key={sk.sessionKey}
            className="session-key-item p-4 rounded-lg"
            style={{
              backgroundColor: 'rgb(var(--card))',
              borderWidth: 1,
              borderColor: 'rgb(var(--border))',
              opacity: isExpired ? 0.6 : 1,
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm" style={{ color: 'rgb(var(--foreground))' }}>
                    {sk.sessionKey.slice(0, 10)}...{sk.sessionKey.slice(-8)}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: isActive
                        ? 'rgb(var(--success) / 0.1)'
                        : isPending
                          ? 'rgb(var(--warning) / 0.1)'
                          : 'rgb(var(--muted) / 0.1)',
                      color: isActive
                        ? 'rgb(var(--success))'
                        : isPending
                          ? 'rgb(var(--warning))'
                          : 'rgb(var(--muted-foreground))',
                    }}
                  >
                    {isActive ? t('active') : isPending ? t('pending') : t('expired')}
                  </span>
                </div>
                <div
                  className="text-xs space-y-1"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                  <p>
                    {t('contractsAndFunctions', {
                      contracts: sk.allowedTargets.length,
                      functions: sk.allowedSelectors.length || t('all'),
                    })}
                  </p>
                  <p>{t('maxPerTx', { amount: formatEther(sk.maxValuePerTx) })}</p>
                  <p>
                    {t('expiresDate', {
                      date: new Date(sk.validUntil * 1000).toLocaleDateString(),
                    })}
                  </p>
                </div>
              </div>
              {onRevoke && !isExpired && (
                <button
                  type="button"
                  className="px-3 py-1 rounded text-sm"
                  style={{
                    backgroundColor: 'rgb(var(--destructive) / 0.1)',
                    color: 'rgb(var(--destructive))',
                  }}
                  onClick={() => onRevoke(sk.sessionKey)}
                >
                  {t('revoke')}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

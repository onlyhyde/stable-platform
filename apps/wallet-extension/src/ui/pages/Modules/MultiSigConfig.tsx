import {
  type MultiSigValidatorConfig,
  encodeMultiSigValidatorInit,
  validateMultiSigValidatorConfig,
} from '@stablenet/core'
import { useCallback, useMemo, useState } from 'react'
import type { Address, Hex } from 'viem'

// ============================================================================
// Types
// ============================================================================

interface MultiSigConfigProps {
  accountAddress: string
  onSubmit: (initData: Hex, config: MultiSigValidatorConfig) => void
  onBack: () => void
}

type Step = 'signers' | 'threshold' | 'review'

interface FormState {
  signers: string[]
  threshold: number
}

// ============================================================================
// Constants
// ============================================================================

const MIN_SIGNERS = 1
const MAX_SIGNERS = 10

// ============================================================================
// Component
// ============================================================================

export function MultiSigConfigUI({ accountAddress, onSubmit, onBack }: MultiSigConfigProps) {
  const [step, setStep] = useState<Step>('signers')
  const [form, setForm] = useState<FormState>({
    signers: [accountAddress], // Start with current account as first signer
    threshold: 1,
  })
  const [errors, setErrors] = useState<string[]>([])

  // Validate signers
  const validSigners = useMemo(() => {
    return form.signers.filter((s) => s.length === 42 && s.startsWith('0x'))
  }, [form.signers])

  // Add signer
  const handleAddSigner = useCallback(() => {
    if (form.signers.length < MAX_SIGNERS) {
      setForm((prev) => ({
        ...prev,
        signers: [...prev.signers, ''],
      }))
    }
  }, [form.signers.length])

  // Remove signer
  const handleRemoveSigner = useCallback(
    (index: number) => {
      if (form.signers.length > MIN_SIGNERS) {
        setForm((prev) => {
          const newSigners = prev.signers.filter((_, i) => i !== index)
          return {
            ...prev,
            signers: newSigners,
            // Adjust threshold if needed
            threshold: Math.min(prev.threshold, newSigners.length),
          }
        })
      }
    },
    [form.signers.length]
  )

  // Update signer address
  const handleSignerChange = useCallback((index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      signers: prev.signers.map((s, i) => (i === index ? value : s)),
    }))
  }, [])

  // Validate and submit
  const handleSubmit = useCallback(() => {
    const config: MultiSigValidatorConfig = {
      signers: validSigners as Address[],
      threshold: form.threshold,
    }

    const validation = validateMultiSigValidatorConfig(config)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    const initData = encodeMultiSigValidatorInit(config)
    onSubmit(initData, config)
  }, [form.threshold, validSigners, onSubmit])

  // Navigation
  const canProceed = () => {
    switch (step) {
      case 'signers':
        return validSigners.length >= MIN_SIGNERS
      case 'threshold':
        return form.threshold >= 1 && form.threshold <= validSigners.length
      default:
        return true
    }
  }

  const nextStep = () => {
    const steps: Step[] = ['signers', 'threshold', 'review']
    const currentIndex = steps.indexOf(step)
    const next = steps[currentIndex + 1]
    if (currentIndex < steps.length - 1 && next) {
      setStep(next)
    }
  }

  const prevStep = () => {
    const steps: Step[] = ['signers', 'threshold', 'review']
    const currentIndex = steps.indexOf(step)
    const prev = steps[currentIndex - 1]
    if (currentIndex > 0 && prev) {
      setStep(prev)
    } else {
      onBack()
    }
  }

  return (
    <div className="multisig-config">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">👥</span>
        <div>
          <h3 className="text-lg font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            MultiSig Validator
          </h3>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Require multiple signatures for transactions
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {['signers', 'threshold', 'review'].map((s, i) => (
          <div
            key={s}
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor:
                ['signers', 'threshold', 'review'].indexOf(step) >= i
                  ? 'rgb(var(--primary))'
                  : 'rgb(var(--border))',
            }}
          />
        ))}
      </div>

      {/* Step: Signers */}
      {step === 'signers' && (
        <div className="step-signers">
          <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
            Add Signers
          </h4>

          <div
            className="info-card p-3 rounded-lg mb-4"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Add wallet addresses that can sign transactions. You can add up to {MAX_SIGNERS}{' '}
              signers.
            </p>
          </div>

          <div className="space-y-3 mb-4">
            {form.signers.map((signer, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: editable signer inputs have no stable identifier
              <div key={index} className="signer-row">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    Signer {index + 1}
                    {signer.toLowerCase() === accountAddress.toLowerCase() && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: 'rgb(var(--primary) / 0.1)',
                          color: 'rgb(var(--primary))',
                        }}
                      >
                        You
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 rounded-lg input-base font-mono text-sm"
                    placeholder="0x..."
                    value={signer}
                    onChange={(e) => handleSignerChange(index, e.target.value)}
                  />
                  {form.signers.length > MIN_SIGNERS && (
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: 'rgb(var(--destructive) / 0.1)',
                        color: 'rgb(var(--destructive))',
                      }}
                      onClick={() => handleRemoveSigner(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
                {signer && signer.length !== 42 && (
                  <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
                    Invalid address format
                  </p>
                )}
              </div>
            ))}
          </div>

          {form.signers.length < MAX_SIGNERS && (
            <button
              type="button"
              className="text-sm"
              style={{ color: 'rgb(var(--primary))' }}
              onClick={handleAddSigner}
            >
              + Add Signer
            </button>
          )}

          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
            <p className="text-sm" style={{ color: 'rgb(var(--foreground))' }}>
              <strong>{validSigners.length}</strong> valid signer
              {validSigners.length !== 1 ? 's' : ''} added
            </p>
          </div>
        </div>
      )}

      {/* Step: Threshold */}
      {step === 'threshold' && (
        <div className="step-threshold">
          <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
            Set Threshold
          </h4>

          <div
            className="info-card p-3 rounded-lg mb-4"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              How many signers must approve each transaction?
            </p>
          </div>

          <div className="threshold-display text-center mb-6">
            <div className="text-6xl font-bold mb-2" style={{ color: 'rgb(var(--primary))' }}>
              {form.threshold}
            </div>
            <p className="text-lg" style={{ color: 'rgb(var(--muted-foreground))' }}>
              of {validSigners.length} signers required
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              type="button"
              className="w-12 h-12 rounded-full text-xl font-bold"
              style={{
                backgroundColor: 'rgb(var(--secondary))',
                color:
                  form.threshold > 1 ? 'rgb(var(--foreground))' : 'rgb(var(--muted-foreground))',
              }}
              disabled={form.threshold <= 1}
              onClick={() =>
                setForm((prev) => ({ ...prev, threshold: Math.max(1, prev.threshold - 1) }))
              }
            >
              −
            </button>
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold"
              style={{
                backgroundColor: 'rgb(var(--primary) / 0.1)',
                color: 'rgb(var(--primary))',
              }}
            >
              {form.threshold}/{validSigners.length}
            </div>
            <button
              type="button"
              className="w-12 h-12 rounded-full text-xl font-bold"
              style={{
                backgroundColor: 'rgb(var(--secondary))',
                color:
                  form.threshold < validSigners.length
                    ? 'rgb(var(--foreground))'
                    : 'rgb(var(--muted-foreground))',
              }}
              disabled={form.threshold >= validSigners.length}
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  threshold: Math.min(validSigners.length, prev.threshold + 1),
                }))
              }
            >
              +
            </button>
          </div>

          {/* Quick select buttons */}
          {validSigners.length > 1 && (
            <div className="flex justify-center gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded text-sm"
                style={{
                  backgroundColor:
                    form.threshold === 1 ? 'rgb(var(--primary))' : 'rgb(var(--secondary))',
                  color: form.threshold === 1 ? 'white' : 'rgb(var(--foreground))',
                }}
                onClick={() => setForm((prev) => ({ ...prev, threshold: 1 }))}
              >
                Any 1
              </button>
              {validSigners.length >= 2 && (
                <button
                  type="button"
                  className="px-3 py-1 rounded text-sm"
                  style={{
                    backgroundColor:
                      form.threshold === Math.ceil(validSigners.length / 2)
                        ? 'rgb(var(--primary))'
                        : 'rgb(var(--secondary))',
                    color:
                      form.threshold === Math.ceil(validSigners.length / 2)
                        ? 'white'
                        : 'rgb(var(--foreground))',
                  }}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      threshold: Math.ceil(validSigners.length / 2),
                    }))
                  }
                >
                  Majority
                </button>
              )}
              <button
                type="button"
                className="px-3 py-1 rounded text-sm"
                style={{
                  backgroundColor:
                    form.threshold === validSigners.length
                      ? 'rgb(var(--primary))'
                      : 'rgb(var(--secondary))',
                  color:
                    form.threshold === validSigners.length ? 'white' : 'rgb(var(--foreground))',
                }}
                onClick={() => setForm((prev) => ({ ...prev, threshold: validSigners.length }))}
              >
                All
              </button>
            </div>
          )}

          <div
            className="mt-6 p-3 rounded-lg"
            style={{
              backgroundColor: 'rgb(var(--info) / 0.1)',
              borderWidth: 1,
              borderColor: 'rgb(var(--info) / 0.3)',
            }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--foreground))' }}>
              <strong>Security tip:</strong> Higher thresholds are more secure but require more
              coordination. A threshold of {Math.ceil(validSigners.length / 2)} (majority) is
              recommended for most use cases.
            </p>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div className="step-review">
          <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
            Review MultiSig Setup
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

          {/* Summary */}
          <div
            className="p-4 rounded-lg mb-4 text-center"
            style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
          >
            <p className="text-3xl font-bold mb-1" style={{ color: 'rgb(var(--primary))' }}>
              {form.threshold} of {validSigners.length}
            </p>
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              signatures required
            </p>
          </div>

          {/* Signers List */}
          <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
            <h5 className="text-sm font-medium mb-3" style={{ color: 'rgb(var(--foreground))' }}>
              Signers
            </h5>
            <div className="space-y-2">
              {validSigners.map((signer, index) => (
                <div key={signer} className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                    style={{
                      backgroundColor: 'rgb(var(--primary))',
                      color: 'white',
                    }}
                  >
                    {index + 1}
                  </div>
                  <span className="font-mono text-sm" style={{ color: 'rgb(var(--foreground))' }}>
                    {signer.slice(0, 10)}...{signer.slice(-8)}
                  </span>
                  {signer.toLowerCase() === accountAddress.toLowerCase() && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: 'rgb(var(--primary) / 0.1)',
                        color: 'rgb(var(--primary))',
                      }}
                    >
                      You
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div
            className="warning-card p-3 rounded-lg"
            style={{
              backgroundColor: 'rgb(var(--warning) / 0.1)',
              borderWidth: 1,
              borderColor: 'rgb(var(--warning) / 0.3)',
            }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--warning))' }}>
              <strong>Important:</strong> Once installed, every transaction will require{' '}
              {form.threshold} signature{form.threshold !== 1 ? 's' : ''} from the listed addresses.
              Make sure all signers have access to their wallets.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button type="button" className="btn-ghost flex-1 py-3 rounded-lg font-medium" onClick={prevStep}>
          {step === 'signers' ? 'Cancel' : 'Back'}
        </button>
        {step === 'review' ? (
          <button type="button" className="btn-primary flex-1 py-3 rounded-lg font-medium" onClick={handleSubmit}>
            Install Validator
          </button>
        ) : (
          <button
            type="button"
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
// MultiSig Status Display Component
// ============================================================================

interface MultiSigDisplayProps {
  signers: Address[]
  threshold: number
  pendingApprovals?: number
  requiredApprovals?: number
}

export function MultiSigDisplay({
  signers,
  threshold,
  pendingApprovals = 0,
  requiredApprovals = threshold,
}: MultiSigDisplayProps) {
  return (
    <div
      className="multisig-display p-4 rounded-lg"
      style={{
        backgroundColor: 'rgb(var(--card))',
        borderWidth: 1,
        borderColor: 'rgb(var(--border))',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">👥</span>
          <div>
            <p className="font-medium text-sm" style={{ color: 'rgb(var(--foreground))' }}>
              MultiSig Validator
            </p>
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {threshold} of {signers.length} required
            </p>
          </div>
        </div>
        {pendingApprovals > 0 && (
          <div
            className="text-xs px-2 py-1 rounded"
            style={{
              backgroundColor: 'rgb(var(--warning) / 0.1)',
              color: 'rgb(var(--warning))',
            }}
          >
            {pendingApprovals}/{requiredApprovals} approved
          </div>
        )}
      </div>

      {/* Signers */}
      <div className="flex flex-wrap gap-1">
        {signers.map((signer, index) => (
          <div
            key={signer}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
              style={{
                backgroundColor: 'rgb(var(--primary))',
                color: 'white',
              }}
            >
              {index + 1}
            </span>
            <span className="font-mono" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {signer.slice(0, 6)}...{signer.slice(-4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

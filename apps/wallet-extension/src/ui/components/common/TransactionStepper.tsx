import { useTranslation } from 'react-i18next'
import { Spinner } from './Spinner'

// ============================================================================
// Types
// ============================================================================

export type TransactionStepperStatus =
  | 'submitting'
  | 'submitted'
  | 'pending'
  | 'confirmed'
  | 'failed'

export interface TransactionStepperProps {
  status: TransactionStepperStatus
  txHash?: string
  blockNumber?: bigint
  explorerUrl?: string
  onViewActivity?: () => void
  onSendAnother?: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function getActiveStep(status: TransactionStepperStatus): number {
  switch (status) {
    case 'submitting':
      return 0
    case 'submitted':
    case 'pending':
      return 1
    case 'confirmed':
      return 3 // Past all steps — all show as completed
    case 'failed':
      return 2
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function StepCircle({
  stepIndex,
  activeStep,
  isFailed,
}: {
  stepIndex: number
  activeStep: number
  isFailed: boolean
}) {
  const isCompleted = stepIndex < activeStep
  const isCurrent = stepIndex === activeStep
  const isLast = stepIndex === 2
  const isFailedStep = isLast && isFailed && isCurrent

  if (isFailedStep) {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center animate-shake"
        style={{ backgroundColor: 'rgb(var(--destructive))', color: 'white' }}
      >
        <XIcon />
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center animate-scale-in"
        style={{ backgroundColor: 'rgb(var(--primary))', color: 'white' }}
      >
        <CheckIcon />
      </div>
    )
  }

  if (isCurrent) {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: 'rgb(var(--primary) / 0.15)',
          border: '2px solid rgb(var(--primary))',
        }}
      >
        {stepIndex === 1 ? (
          <span
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: 'rgb(var(--primary))' }}
          />
        ) : (
          <Spinner size="sm" color="primary" />
        )}
      </div>
    )
  }

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center"
      style={{
        backgroundColor: 'rgb(var(--secondary))',
        border: '2px solid rgb(var(--border))',
      }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: 'rgb(var(--muted-foreground))' }}
      />
    </div>
  )
}

function StepLine({ isCompleted }: { isCompleted: boolean }) {
  return (
    <div
      className="flex-1 h-0.5 transition-colors duration-500"
      style={{
        backgroundColor: isCompleted ? 'rgb(var(--primary))' : 'rgb(var(--border))',
      }}
    />
  )
}

// ============================================================================
// Component
// ============================================================================

export function TransactionStepper({
  status,
  txHash,
  blockNumber,
  explorerUrl,
  onViewActivity,
  onSendAnother,
}: TransactionStepperProps) {
  const { t } = useTranslation('send')
  const activeStep = getActiveStep(status)
  const isFailed = status === 'failed'
  const isConfirmed = status === 'confirmed'

  const steps = [
    { label: t('submitting') },
    { label: t('waitingConfirmation') },
    {
      label: isConfirmed
        ? t('transactionConfirmed')
        : isFailed
          ? t('transactionFailed')
          : t('transactionConfirmed'),
    },
  ]

  return (
    <div className="py-6 animate-fade-in">
      {/* Stepper visualization */}
      <div className="flex items-center px-4 mb-6">
        {steps.map((step, i) => (
          <div key={step.label} className="contents">
            <div className="flex flex-col items-center gap-1.5">
              <StepCircle stepIndex={i} activeStep={activeStep} isFailed={isFailed} />
              <span
                className="text-[10px] font-medium text-center w-20 leading-tight"
                style={{
                  color:
                    i <= activeStep
                      ? isFailed && i === 2
                        ? 'rgb(var(--destructive))'
                        : 'rgb(var(--foreground))'
                      : 'rgb(var(--muted-foreground))',
                }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && <StepLine isCompleted={i < activeStep} />}
          </div>
        ))}
      </div>

      {/* Status message */}
      <div className="text-center mb-4">
        {status === 'submitting' && (
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('pleaseWait')}
          </p>
        )}
        {(status === 'submitted' || status === 'pending') && (
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('waitingForBlock')}
          </p>
        )}
        {isConfirmed && blockNumber != null && (
          <p className="text-sm font-medium" style={{ color: 'rgb(var(--success))' }}>
            {t('confirmedInBlock', { block: blockNumber.toString() })}
          </p>
        )}
        {isFailed && (
          <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
            {t('transactionFailed')}
          </p>
        )}
      </div>

      {/* Tx Hash display */}
      {txHash && (
        <div
          className="mx-4 p-3 rounded-lg mb-4"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('transactionHash')}
          </p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-sm font-mono" style={{ color: 'rgb(var(--foreground))' }}>
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(txHash)}
              className="p-1"
              style={{ color: 'rgb(var(--primary))' }}
              title="Copy hash"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
            {explorerUrl && (
              <button
                type="button"
                onClick={() =>
                  chrome.tabs.create({ url: `${explorerUrl}/tx/${txHash}` })
                }
                className="p-1"
                style={{ color: 'rgb(var(--primary))' }}
                title="View on Explorer"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(isConfirmed || isFailed) && (
        <div className="flex gap-2 px-4">
          {onSendAnother && (
            <button
              type="button"
              onClick={onSendAnother}
              className="flex-1 py-3 rounded-lg font-medium btn-ghost"
            >
              {t('sendAnother')}
            </button>
          )}
          {onViewActivity && (
            <button
              type="button"
              onClick={onViewActivity}
              className="flex-1 py-3 rounded-lg font-medium btn-primary"
            >
              {t('viewActivity')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

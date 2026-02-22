import type { TransactionResult } from '@stablenet/core'
import {
  type GasPaymentConfig,
  getAvailableTransactionModes,
  getDefaultTransactionMode,
  TRANSACTION_MODE,
  type TransactionMode,
} from '@stablenet/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address } from 'viem'
import { formatEther, isAddress, parseEther } from 'viem'
import type { TransactionStepperStatus } from '../../components/common/TransactionStepper'
import { TransactionStepper } from '../../components/common/TransactionStepper'
import { useNetworkCurrency, useSelectedNetwork, useWalletStore } from '../../hooks'
import { useGasEstimate } from './hooks/useGasEstimate'
import { useSendTransaction } from './hooks/useSendTransaction'
import { SendForm } from './SendForm'

// ============================================================================
// Types
// ============================================================================

interface SendFormData {
  recipient: Address | ''
  amount: string
  data: string
}

type SendStep = 'form' | 'review' | 'pending' | 'success' | 'confirming' | 'error'

// ============================================================================
// Component
// ============================================================================

export function Send() {
  const { t } = useTranslation('send')
  const { t: tc } = useTranslation('common')
  const {
    accounts,
    selectedAccount: selectedAddress,
    setPage,
    pendingTransactions,
    history,
    syncWithBackground,
  } = useWalletStore()
  const _currentNetwork = useSelectedNetwork()
  const { symbol: currencySymbol } = useNetworkCurrency()

  // Get the full account object
  const selectedAccount = useMemo(() => {
    return accounts.find((acc) => acc.address === selectedAddress) ?? null
  }, [accounts, selectedAddress])

  // Form state
  const [formData, setFormData] = useState<SendFormData>({
    recipient: '',
    amount: '',
    data: '0x',
  })

  // Transaction mode state
  const [transactionMode, setTransactionMode] = useState<TransactionMode>(() =>
    selectedAccount ? getDefaultTransactionMode(selectedAccount) : TRANSACTION_MODE.EOA
  )

  // Gas payment state (for Smart Account mode)
  const [gasPayment, setGasPayment] = useState<GasPaymentConfig>({
    type: 'native',
  })

  // UI state
  const [step, setStep] = useState<SendStep>('form')
  const [error, setError] = useState<string | null>(null)
  const [txResult, setTxResult] = useState<TransactionResult | null>(null)

  // Polling ref for confirming step
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Track the confirmed block number from receipt
  const [confirmedBlockNumber, setConfirmedBlockNumber] = useState<bigint | undefined>(undefined)

  // Hooks
  const { sendTransaction, isPending } = useSendTransaction()
  const { gasEstimate, isLoading: isEstimating } = useGasEstimate({
    mode: transactionMode,
    from: selectedAddress ?? ('' as Address),
    to: formData.recipient || ('' as Address),
    value: formData.amount ? parseEther(formData.amount) : 0n,
    data: formData.data as `0x${string}`,
    gasPayment,
    enabled: !!formData.recipient && !!formData.amount,
  })

  // Available modes for current account
  const availableModes = useMemo(() => {
    if (!selectedAccount) return [TRANSACTION_MODE.EOA]
    return getAvailableTransactionModes(selectedAccount)
  }, [selectedAccount])

  // Form validation
  const isFormValid = useMemo(() => {
    if (!formData.recipient || !isAddress(formData.recipient)) return false
    if (!formData.amount || Number.parseFloat(formData.amount) <= 0) return false
    return true
  }, [formData])

  // Handle form input changes
  const handleFormChange = useCallback((field: keyof SendFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }, [])

  // Handle mode change
  const handleModeChange = useCallback((mode: TransactionMode) => {
    setTransactionMode(mode)

    // Reset gas payment to native for non-smart-account modes
    if (mode !== TRANSACTION_MODE.SMART_ACCOUNT) {
      setGasPayment({ type: 'native' })
    }
  }, [])

  // Handle send
  const handleSend = useCallback(async () => {
    if (!selectedAddress || !formData.recipient) return

    try {
      setStep('pending')
      setError(null)

      const result = await sendTransaction({
        mode: transactionMode,
        from: selectedAddress,
        to: formData.recipient as Address,
        value: parseEther(formData.amount),
        data: formData.data as `0x${string}`,
        gasPayment: transactionMode === TRANSACTION_MODE.SMART_ACCOUNT ? gasPayment : undefined,
      })

      setTxResult(result)
      setStep('confirming')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
      setStep('error')
    }
  }, [selectedAddress, formData, transactionMode, gasPayment, sendTransaction])

  // Handle review
  const handleReview = useCallback(() => {
    if (isFormValid) {
      setStep('review')
    }
  }, [isFormValid])

  // Reset form
  const handleReset = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setFormData({ recipient: '', amount: '', data: '0x' })
    setStep('form')
    setError(null)
    setTxResult(null)
    setConfirmedBlockNumber(undefined)
  }, [])

  // Poll for receipt while confirming
  useEffect(() => {
    if (step !== 'confirming' || !txResult?.hash) return

    const poll = () => {
      syncWithBackground().catch(() => {})
    }

    // Initial sync
    poll()
    pollingRef.current = setInterval(poll, 3000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [step, txResult?.hash, syncWithBackground])

  // Track tx status from store while confirming
  const trackedTx = useMemo(() => {
    if (!txResult?.hash) return null
    return (
      pendingTransactions.find((tx) => tx.txHash === txResult.hash || tx.userOpHash === txResult.hash) ??
      history.find((tx) => tx.txHash === txResult.hash || tx.userOpHash === txResult.hash) ??
      null
    )
  }, [txResult?.hash, pendingTransactions, history])

  // Stop polling when tx is confirmed or failed
  useEffect(() => {
    if (!trackedTx) return
    if (trackedTx.status === 'confirmed' || trackedTx.status === 'failed') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      if (trackedTx.blockNumber) {
        setConfirmedBlockNumber(trackedTx.blockNumber)
      }
      if (trackedTx.status === 'failed') {
        setError(trackedTx.error ?? 'Transaction failed')
      }
    }
  }, [trackedTx])

  // Derive stepper status from send step + tracked tx
  const stepperStatus: TransactionStepperStatus = useMemo(() => {
    if (step === 'pending') return 'submitting'
    if (step === 'confirming') {
      if (trackedTx?.status === 'confirmed') return 'confirmed'
      if (trackedTx?.status === 'failed') return 'failed'
      return 'pending'
    }
    if (step === 'error') return 'failed'
    return 'submitting'
  }, [step, trackedTx?.status])

  // Guard: No account selected
  if (!selectedAddress) {
    return (
      <div className="p-4">
        <p className="text-center" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('selectAccountFirst')}
        </p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-6" style={{ color: 'rgb(var(--foreground))' }}>
        {t('title')}
      </h2>

      {/* Transaction Mode Selector */}
      <div className="mb-4">
        <span
          className="block text-sm font-medium mb-2"
          style={{ color: 'rgb(var(--foreground-secondary))' }}
        >
          {t('transactionMode')}
        </span>
        <div className="flex gap-2">
          {availableModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeChange(mode)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                transactionMode === mode ? 'btn-primary' : ''
              }`}
              style={
                transactionMode !== mode
                  ? {
                      backgroundColor: 'rgb(var(--secondary))',
                      color: 'rgb(var(--foreground))',
                    }
                  : undefined
              }
            >
              {mode === TRANSACTION_MODE.EOA && 'EOA'}
              {mode === TRANSACTION_MODE.EIP7702 && 'EIP-7702'}
              {mode === TRANSACTION_MODE.SMART_ACCOUNT && t('smartAccountMode')}
            </button>
          ))}
        </div>
      </div>

      {/* Send Form */}
      {step === 'form' && (
        <>
          <SendForm formData={formData} onFormChange={handleFormChange} isValid={isFormValid} currencySymbol={currencySymbol} />

          {/* Gas Payment Selector (Smart Account only) */}
          {transactionMode === TRANSACTION_MODE.SMART_ACCOUNT && (
            <div className="mt-4">
              <span
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgb(var(--foreground-secondary))' }}
              >
                {t('gasPayment')}
              </span>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gasPayment"
                    checked={gasPayment.type === 'native'}
                    onChange={() => setGasPayment({ type: 'native' })}
                    className="text-primary"
                  />
                  <span style={{ color: 'rgb(var(--foreground))' }}>
                    {t('payWithNative', { symbol: currencySymbol })}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gasPayment"
                    checked={gasPayment.type === 'sponsor'}
                    onChange={() => setGasPayment({ type: 'sponsor' })}
                    className="text-primary"
                  />
                  <span style={{ color: 'rgb(var(--foreground))' }}>{t('freeSponsored')}</span>
                </label>
              </div>
            </div>
          )}

          {/* Gas Estimate Display */}
          {gasEstimate && (
            <div
              className="mt-4 p-3 rounded-lg"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('estimatedGas')}
              </p>
              <p className="font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                {formatEther(gasEstimate.estimatedCost)} {currencySymbol}
              </p>
              {gasPayment.type === 'sponsor' && (
                <p className="text-sm mt-1" style={{ color: 'rgb(var(--success))' }}>
                  {t('gasWillBeSponsored')}
                </p>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div
              className="mt-4 p-3 rounded-lg"
              style={{
                backgroundColor: 'rgb(var(--destructive) / 0.1)',
                color: 'rgb(var(--destructive))',
              }}
            >
              {error}
            </div>
          )}

          {/* Review Button */}
          <button
            type="button"
            className={`w-full py-3 rounded-lg font-medium mt-4 ${
              isFormValid && !isEstimating ? 'btn-primary' : ''
            }`}
            onClick={handleReview}
            disabled={!isFormValid || isEstimating}
            style={
              !isFormValid || isEstimating
                ? {
                    backgroundColor: 'rgb(var(--secondary))',
                    color: 'rgb(var(--muted-foreground))',
                    cursor: 'not-allowed',
                  }
                : undefined
            }
          >
            {isEstimating ? t('estimating') : t('reviewTransaction')}
          </button>

          {/* Cancel Button */}
          <button
            type="button"
            onClick={() => setPage('home')}
            className="w-full py-3 rounded-lg font-medium mt-2 btn-ghost"
          >
            {tc('cancel')}
          </button>
        </>
      )}

      {/* Review Step */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
            <h3 className="font-medium mb-3" style={{ color: 'rgb(var(--foreground))' }}>
              {t('transactionSummary')}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>{t('mode')}</span>
                <span style={{ color: 'rgb(var(--foreground))' }}>{transactionMode}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>{t('to')}</span>
                <span className="font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                  {formData.recipient.slice(0, 6)}...{formData.recipient.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>{t('amount')}</span>
                <span style={{ color: 'rgb(var(--foreground))' }}>
                  {formData.amount} {currencySymbol}
                </span>
              </div>
              {gasEstimate && (
                <div className="flex justify-between">
                  <span style={{ color: 'rgb(var(--muted-foreground))' }}>{t('gas')}</span>
                  <span style={{ color: 'rgb(var(--foreground))' }}>
                    {gasPayment.type === 'sponsor'
                      ? t('sponsored')
                      : `${formatEther(gasEstimate.estimatedCost)} ${currencySymbol}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="flex-1 py-3 rounded-lg font-medium btn-ghost"
            >
              {tc('back')}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className="flex-1 py-3 rounded-lg font-medium btn-primary"
            >
              {isPending ? t('sending') : t('confirm')}
            </button>
          </div>
        </div>
      )}

      {/* Transaction Lifecycle Stepper (pending → confirming → confirmed/failed) */}
      {(step === 'pending' || step === 'confirming') && (
        <TransactionStepper
          status={stepperStatus}
          txHash={trackedTx?.txHash ?? txResult?.hash}
          blockNumber={confirmedBlockNumber}
          explorerUrl={_currentNetwork?.explorerUrl}
          onSendAnother={handleReset}
          onViewActivity={() => setPage('activity')}
        />
      )}

      {/* Error State (pre-submission failure) */}
      {step === 'error' && !txResult?.hash && (
        <div className="text-center py-8">
          <div
            className="text-4xl mb-4 w-16 h-16 mx-auto rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgb(var(--destructive) / 0.1)' }}
          >
            <span style={{ color: 'rgb(var(--destructive))' }}>✗</span>
          </div>
          <h3 className="text-xl font-bold" style={{ color: 'rgb(var(--destructive))' }}>
            {t('transactionFailed')}
          </h3>
          <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => setStep('form')}
            className="mt-6 px-6 py-3 rounded-lg font-medium btn-ghost"
          >
            {t('tryAgain')}
          </button>
        </div>
      )}
    </div>
  )
}

export default Send

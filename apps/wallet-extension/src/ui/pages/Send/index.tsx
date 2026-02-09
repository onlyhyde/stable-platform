import {
  type GasPaymentConfig,
  TRANSACTION_MODE,
  type TransactionMode,
  getAvailableTransactionModes,
  getDefaultTransactionMode,
} from '@stablenet/core'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEther, isAddress, parseEther } from 'viem'
import type { Address } from 'viem'

import type { TransactionResult } from '@stablenet/core'
import { useNetworkCurrency, useSelectedNetwork, useWalletStore } from '../../hooks'
import { SendForm } from './SendForm'
import { useGasEstimate } from './hooks/useGasEstimate'
import { useSendTransaction } from './hooks/useSendTransaction'

// ============================================================================
// Types
// ============================================================================

interface SendFormData {
  recipient: Address | ''
  amount: string
  data: string
}

type SendStep = 'form' | 'review' | 'pending' | 'success' | 'error'

// ============================================================================
// Component
// ============================================================================

export function Send() {
  const { t } = useTranslation('send')
  const { t: tc } = useTranslation('common')
  const { accounts, selectedAccount: selectedAddress, setPage } = useWalletStore()
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
      setStep('success')
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
    setFormData({ recipient: '', amount: '', data: '0x' })
    setStep('form')
    setError(null)
    setTxResult(null)
  }, [])

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
          <SendForm formData={formData} onFormChange={handleFormChange} isValid={isFormValid} />

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
                  <span style={{ color: 'rgb(var(--foreground))' }}>{t('payWithNative', { symbol: currencySymbol })}</span>
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

      {/* Success State */}
      {step === 'success' && (
        <div className="text-center py-8">
          <div
            className="text-4xl mb-4 w-16 h-16 mx-auto rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
          >
            <span style={{ color: 'rgb(var(--success))' }}>✓</span>
          </div>
          <h3 className="text-xl font-bold" style={{ color: 'rgb(var(--success))' }}>
            {t('transactionSent')}
          </h3>
          <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('transactionSubmitted')}
          </p>

          {/* Tx Hash Display */}
          {txResult?.hash && (
            <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('transactionHash')}
              </p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-sm font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                  {txResult.hash.slice(0, 10)}...{txResult.hash.slice(-8)}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(txResult.hash)}
                  className="p-1"
                  style={{ color: 'rgb(var(--primary))' }}
                  title="Copy hash"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>

              {/* Explorer Link */}
              {_currentNetwork?.explorerUrl && (
                <a
                  href={`${_currentNetwork.explorerUrl}/tx/${txResult.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs font-medium"
                  style={{ color: 'rgb(var(--primary))' }}
                >
                  {t('viewOnExplorer')}
                </a>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-3 rounded-lg font-medium btn-ghost"
            >
              {t('sendAnother')}
            </button>
            <button
              type="button"
              onClick={() => setPage('activity')}
              className="flex-1 py-3 rounded-lg font-medium btn-primary"
            >
              {t('viewActivity')}
            </button>
          </div>
        </div>
      )}

      {/* Pending State */}
      {step === 'pending' && (
        <div className="text-center py-8">
          <div
            className="w-12 h-12 mx-auto mb-4 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'rgb(var(--foreground))' }}>{t('sendingTransaction')}</p>
          <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('pleaseWait')}
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-6 px-6 py-3 rounded-lg font-medium btn-ghost"
          >
            {tc('cancel')}
          </button>
          <p className="text-xs mt-2" style={{ color: 'rgb(var(--muted-foreground) / 0.6)' }}>
            {t('cancelWarning')}
          </p>
        </div>
      )}

      {/* Error State */}
      {step === 'error' && (
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

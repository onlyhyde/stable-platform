import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address, Hash } from 'viem'
import { getKernel } from '@stablenet/contracts'
import { ZERO_ADDRESS } from '../../../shared/utils/eip7702'
import { sendMessageWithTimeout, TX_TIMEOUT_MS } from '../../../shared/utils/messaging'
import { useSelectedNetwork, useWalletStore } from '../../hooks'

// ============================================================================
// Types
// ============================================================================

interface DelegateSetupProps {
  account: Address
  mode?: 'setup' | 'revoke'
  onComplete: () => void
  onCancel: () => void
}

type SetupStep = 'input' | 'confirm' | 'pending' | 'success' | 'error'

// ============================================================================
// Component
// ============================================================================

export function DelegateSetup({
  account,
  mode = 'setup',
  onComplete,
  onCancel,
}: DelegateSetupProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')
  const isRevokeMode = mode === 'revoke'
  const [step, setStep] = useState<SetupStep>(isRevokeMode ? 'confirm' : 'input')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<Hash | null>(null)

  const currentNetwork = useSelectedNetwork()
  const { syncWithBackground } = useWalletStore()

  const delegateAddress = useMemo(() => {
    if (isRevokeMode) return ZERO_ADDRESS
    if (!currentNetwork) return '' as Address
    return getKernel(currentNetwork.chainId)
  }, [isRevokeMode, currentNetwork])

  const isValidDelegate = delegateAddress.length > 0

  const handleSubmit = useCallback(async () => {
    if (!isValidDelegate || !currentNetwork) return

    try {
      setStep('pending')
      setError(null)

      // Single RPC call: wallet_delegateAccount handles authorization signing + transaction
      // sending internally with correct nonce handling (executor:'self' pattern)
      const response = await sendMessageWithTimeout<Record<string, unknown>>(
        {
          type: 'RPC_REQUEST',
          id: `delegate-7702-${Date.now()}`,
          payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'wallet_delegateAccount',
            params: [
              {
                account,
                contractAddress: delegateAddress as Address,
                chainId: currentNetwork.chainId,
              },
            ],
          },
        },
        TX_TIMEOUT_MS
      )

      const payload = (response as { payload?: { error?: { message?: string }; result?: unknown } })
        ?.payload
      if (payload?.error) {
        throw new Error(payload.error.message || 'Delegation failed')
      }

      const result = payload?.result as { txHash: Hash }
      setTxHash(result.txHash)
      setStep('success')

      // Sync wallet state to pick up account type change
      await syncWithBackground()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('delegationSetupFailed'))
      setStep('error')
    }
  }, [account, delegateAddress, isValidDelegate, currentNetwork, syncWithBackground, t])

  // Input Step: Enter delegate contract address (setup mode)
  // Confirm Step: Confirm revocation (revoke mode skips input)
  if (step === 'input' || step === 'confirm') {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={onCancel}
            className="p-1"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            {isRevokeMode ? t('revokeDelegationTitle') : t('enableSmartAccount')}
          </h2>
        </div>

        {/* Info Banner */}
        <div
          className="p-3 rounded-lg mb-4"
          style={{
            backgroundColor: isRevokeMode
              ? 'rgb(var(--destructive) / 0.1)'
              : 'rgb(var(--primary) / 0.1)',
          }}
        >
          <p
            className="text-sm"
            style={{ color: isRevokeMode ? 'rgb(var(--destructive))' : 'rgb(var(--primary))' }}
          >
            {isRevokeMode ? t('revokeDelegationDesc') : t('eip7702Info')}
          </p>
        </div>

        {/* Account */}
        <div className="mb-4">
          <span
            className="block text-sm font-medium mb-1"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('account')}
          </span>
          <div
            className="p-3 rounded-lg font-mono text-sm break-all"
            style={{ backgroundColor: 'rgb(var(--secondary))', color: 'rgb(var(--foreground))' }}
          >
            {account}
          </div>
        </div>

        {/* Delegate Address Input (setup mode only) */}
        {!isRevokeMode && (
          <div className="mb-4">
            <span
              className="block text-sm font-medium mb-1"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('delegateContractAddress')}
            </span>
            <div
              className="w-full p-3 rounded-lg text-sm font-mono break-all"
              style={{
                backgroundColor: 'rgb(var(--secondary))',
                color: 'rgb(var(--foreground))',
                border: '1px solid rgb(var(--border))',
                opacity: 0.8,
              }}
            >
              {delegateAddress || '—'}
            </div>
          </div>
        )}

        {/* Network Info */}
        {currentNetwork && (
          <div className="mb-4">
            <span
              className="block text-sm font-medium mb-1"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('network')}
            </span>
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgb(var(--secondary))', color: 'rgb(var(--foreground))' }}
            >
              {t('networkInfo', { name: currentNetwork.name, chainId: currentNetwork.chainId })}
            </div>
          </div>
        )}

        {/* Warning */}
        <div
          className="p-3 rounded-lg mb-6"
          style={{ backgroundColor: 'rgb(var(--warning) / 0.1)' }}
        >
          <p className="text-sm" style={{ color: 'rgb(var(--warning))' }}>
            {isRevokeMode ? t('revokeDelegationWarning') : t('setCodeWarning')}
          </p>
        </div>

        {error && (
          <div
            className="p-3 rounded-lg mb-4"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              color: 'rgb(var(--destructive))',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValidDelegate}
          className={`w-full py-3 rounded-lg font-medium ${isValidDelegate ? (isRevokeMode ? '' : 'btn-primary') : ''}`}
          style={
            !isValidDelegate
              ? {
                  backgroundColor: 'rgb(var(--secondary))',
                  color: 'rgb(var(--muted-foreground))',
                  cursor: 'not-allowed',
                }
              : isRevokeMode
                ? {
                    backgroundColor: 'rgb(var(--destructive))',
                    color: 'white',
                  }
                : undefined
          }
        >
          {isRevokeMode ? t('revokeDelegationBtn') : t('delegateAccount')}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-3 rounded-lg font-medium mt-2 btn-ghost"
        >
          {tc('cancel')}
        </button>
      </div>
    )
  }

  // Pending Step
  if (step === 'pending') {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <div
            className="w-12 h-12 mx-auto mb-4 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
          />
          <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            {isRevokeMode ? t('revoking') : t('settingUpSmartAccount')}
          </p>
          <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('signingAndSending')}
          </p>
        </div>
      </div>
    )
  }

  // Success Step
  if (step === 'success') {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
          >
            <span className="text-2xl" style={{ color: 'rgb(var(--success))' }}>
              ✓
            </span>
          </div>
          <h3 className="text-xl font-bold" style={{ color: 'rgb(var(--success))' }}>
            {isRevokeMode ? t('revocationComplete') : t('smartAccountEnabled')}
          </h3>
          <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {isRevokeMode ? t('revocationCompleteDesc') : t('delegationComplete')}
          </p>
          {txHash && (
            <p
              className="text-xs mt-2 font-mono break-all"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              {t('txLabel', { hash: txHash })}
            </p>
          )}
          <button
            type="button"
            onClick={onComplete}
            className="mt-6 px-6 py-3 rounded-lg font-medium btn-primary"
          >
            {tc('done')}
          </button>
        </div>
      </div>
    )
  }

  // Error Step
  return (
    <div className="p-4">
      <div className="text-center py-8">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgb(var(--destructive) / 0.1)' }}
        >
          <span className="text-2xl" style={{ color: 'rgb(var(--destructive))' }}>
            ✗
          </span>
        </div>
        <h3 className="text-xl font-bold" style={{ color: 'rgb(var(--destructive))' }}>
          {t('delegationFailed')}
        </h3>
        <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {error}
        </p>
        <div className="flex gap-2 mt-6 justify-center">
          <button
            type="button"
            onClick={() => setStep('input')}
            className="px-6 py-3 rounded-lg font-medium btn-ghost"
          >
            {t('tryAgain')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-lg font-medium btn-ghost"
          >
            {tc('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

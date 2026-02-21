import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEther, parseEther } from 'viem'

import type { Account } from '../../../types/account'
import type { Network } from '../../../types/network'
import { useEntryPointBalance } from './hooks/useEntryPointBalance'

// ============================================================================
// Types
// ============================================================================

interface EntryPointDepositProps {
  account: Account
  network: Network | undefined
  onBack: () => void
}

// ============================================================================
// Component
// ============================================================================

export function EntryPointDeposit({ account, network, onBack }: EntryPointDepositProps) {
  const { t } = useTranslation('modules')
  const { deposit, isLoading, refetch } = useEntryPointBalance(account.address)

  const [amount, setAmount] = useState('')
  const [isDepositing, setIsDepositing] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const formattedDeposit = formatEther(deposit)
  const currencySymbol = network?.currency.symbol ?? 'ETH'

  const handleDeposit = async () => {
    if (!amount || Number.parseFloat(amount) <= 0) return

    setIsDepositing(true)
    setError(null)
    setTxHash(null)

    try {
      const amountWei = parseEther(amount)

      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `ep-deposit-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'stablenet_depositToEntryPoint',
          params: [{ account: account.address, amount: amountWei.toString() }],
        },
      })

      if (response?.payload?.error) {
        throw new Error(response.payload.error.message || t('entryPointDeposit.failed'))
      }

      setTxHash(response?.payload?.result)
      setAmount('')
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('entryPointDeposit.failed'))
    } finally {
      setIsDepositing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <ViewHeader onBack={onBack} title={t('entryPointDeposit.title')} />
        <div className="flex justify-center items-center py-16">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <ViewHeader onBack={onBack} title={t('entryPointDeposit.title')} />

      {/* Description */}
      <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {t('entryPointDeposit.description')}
      </p>

      {/* Current Balance Card */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: 'rgb(var(--card))',
          borderWidth: 1,
          borderColor: 'rgb(var(--border))',
        }}
      >
        <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('entryPointDeposit.currentBalance')}
        </p>
        <p className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          {formattedDeposit} {currencySymbol}
        </p>
      </div>

      {/* Deposit Form */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{
          backgroundColor: 'rgb(var(--card))',
          borderWidth: 1,
          borderColor: 'rgb(var(--border))',
        }}
      >
        <label
          className="text-sm font-medium"
          style={{ color: 'rgb(var(--foreground))' }}
          htmlFor="deposit-amount"
        >
          {t('entryPointDeposit.amount')}
        </label>
        <div className="flex gap-2">
          <input
            id="deposit-amount"
            type="number"
            step="0.001"
            min="0"
            placeholder={t('entryPointDeposit.amountPlaceholder')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: 'rgb(var(--secondary))',
              color: 'rgb(var(--foreground))',
              borderWidth: 1,
              borderColor: 'rgb(var(--border))',
            }}
            disabled={isDepositing}
          />
          <span
            className="flex items-center px-3 text-sm font-medium"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
            {currencySymbol}
          </span>
        </div>

        <button
          type="button"
          className="w-full py-2.5 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: 'rgb(var(--primary))',
            color: 'white',
            opacity: isDepositing || !amount || Number.parseFloat(amount) <= 0 ? 0.5 : 1,
          }}
          disabled={isDepositing || !amount || Number.parseFloat(amount) <= 0}
          onClick={handleDeposit}
        >
          {isDepositing ? t('entryPointDeposit.depositing') : t('entryPointDeposit.deposit')}
        </button>
      </div>

      {/* Success */}
      {txHash && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: 'rgb(var(--success) / 0.1)',
            borderWidth: 1,
            borderColor: 'rgb(var(--success) / 0.3)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'rgb(var(--success))' }}>
            {t('entryPointDeposit.success')}
          </p>
          <p className="text-xs mt-1 font-mono break-all" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('txLabel', { hash: `${txHash.slice(0, 10)}...${txHash.slice(-8)}` })}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            borderWidth: 1,
            borderColor: 'rgb(var(--destructive) / 0.3)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'rgb(var(--destructive))' }}>
            {t('entryPointDeposit.failed')}
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {error}
          </p>
        </div>
      )}

      {/* Info Note */}
      <div
        className="rounded-lg p-3"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('entryPointDeposit.info')}
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

function ViewHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <button
        type="button"
        className="text-lg"
        style={{ color: 'rgb(var(--foreground))' }}
        onClick={onBack}
      >
        &larr;
      </button>
      <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
        {title}
      </h1>
    </div>
  )
}

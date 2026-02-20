import type { InstalledModule } from '@stablenet/core'
import { useTranslation } from 'react-i18next'
import { formatEther } from 'viem'

import type { Account } from '../../../types/account'
import { useSpendingLimitStatus, type SpendingLimitInfo } from './hooks/useSpendingLimitStatus'

// ============================================================================
// Types
// ============================================================================

interface SpendingLimitsViewProps {
  account: Account
  installedModules: InstalledModule[] | null
  onBack: () => void
  onNavigateToInstall: () => void
}

// ============================================================================
// Component
// ============================================================================

export function SpendingLimitsView({
  account,
  installedModules,
  onBack,
  onNavigateToInstall,
}: SpendingLimitsViewProps) {
  const { t } = useTranslation('modules')
  const { limits, isLoading } = useSpendingLimitStatus(account.address, installedModules)

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-lg"
            style={{ color: 'rgb(var(--foreground))' }}
            onClick={onBack}
          >
            ←
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            {t('spendingLimits.title', 'Spending Limits')}
          </h1>
        </div>
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-lg font-medium"
          style={{
            backgroundColor: 'rgb(var(--primary))',
            color: 'white',
          }}
          onClick={onNavigateToInstall}
        >
          {t('spendingLimits.addLimit', 'Add Limit')}
        </button>
      </div>

      {/* Description */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: 'rgb(var(--card))',
          borderWidth: 1,
          borderColor: 'rgb(var(--border))',
        }}
      >
        <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t(
            'spendingLimits.description',
            'Spending limits restrict how much can be spent in a given period. This protects against unauthorized large transactions.'
          )}
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
          />
        </div>
      )}

      {/* Limit Cards */}
      {!isLoading && limits.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-4xl mb-4 block">💰</span>
          <p className="text-sm mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t(
              'spendingLimits.emptyMessage',
              'No spending limits configured. Add a spending limit hook to restrict transaction amounts.'
            )}
          </p>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: 'rgb(var(--primary))',
              color: 'white',
            }}
            onClick={onNavigateToInstall}
          >
            {t('spendingLimits.addFirstLimit', 'Add Your First Spending Limit')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {limits.map((limit) => (
            <SpendingLimitCard key={`${limit.hookAddress}-${limit.token}`} limit={limit} />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

function SpendingLimitCard({ limit }: { limit: SpendingLimitInfo }) {
  const { t } = useTranslation('modules')

  const percentage =
    limit.limit > 0n ? Number((limit.spent * 100n) / limit.limit) : 0
  const remaining = limit.limit > limit.spent ? limit.limit - limit.spent : 0n
  const periodLabel = getPeriodLabel(limit.period)

  const now = BigInt(Math.floor(Date.now() / 1000))
  const resetIn = limit.resetTime > now ? limit.resetTime - now : 0n
  const resetLabel = formatDuration(resetIn)

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: 'rgb(var(--card))',
        borderWidth: 1,
        borderColor: 'rgb(var(--border))',
      }}
    >
      {/* Token and Period */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">💰</span>
          <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            {limit.tokenSymbol}
          </span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            backgroundColor: 'rgb(var(--primary) / 0.1)',
            color: 'rgb(var(--primary))',
          }}
        >
          {periodLabel}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('spendingLimits.spent', 'Spent')}
          </span>
          <span style={{ color: 'rgb(var(--foreground))' }}>
            {formatBigIntAmount(limit.spent)} / {formatBigIntAmount(limit.limit)} {limit.tokenSymbol}
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor:
                percentage > 90
                  ? 'rgb(var(--destructive))'
                  : percentage > 70
                    ? 'rgb(var(--warning, 234 179 8))'
                    : 'rgb(var(--primary))',
            }}
          />
        </div>
      </div>

      {/* Details */}
      <div className="flex justify-between text-xs mt-2">
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('spendingLimits.remaining', 'Remaining')}: {formatBigIntAmount(remaining)} {limit.tokenSymbol}
        </span>
        {resetIn > 0n && (
          <span style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('spendingLimits.resetsIn', 'Resets in')}: {resetLabel}
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function formatBigIntAmount(value: bigint): string {
  const formatted = formatEther(value)
  const num = parseFloat(formatted)
  if (num === 0) return '0'
  if (num < 0.0001) return '<0.0001'
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function getPeriodLabel(periodSeconds: bigint): string {
  const hours = Number(periodSeconds) / 3600
  if (hours <= 1) return 'Hourly'
  if (hours <= 24) return 'Daily'
  if (hours <= 168) return 'Weekly'
  return 'Monthly'
}

function formatDuration(seconds: bigint): string {
  const s = Number(seconds)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
}

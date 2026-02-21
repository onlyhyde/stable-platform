import { type InstalledModule, MODULE_TYPE } from '@stablenet/core'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEther } from 'viem'

import type { Account } from '../../../types/account'
import type { Network } from '../../../types/network'
import { usePaymasterClient } from '../../pages/Send/hooks/usePaymasterClient'
import { useEntryPointBalance } from './hooks/useEntryPointBalance'
import type { SmartAccountInfo } from './hooks/useSmartAccountInfo'
import { useSpendingLimitStatus } from './hooks/useSpendingLimitStatus'

// ============================================================================
// Types
// ============================================================================

interface SmartAccountDashboardProps {
  account: Account
  network: Network | undefined
  smartAccountInfo: SmartAccountInfo | null
  installedModules: InstalledModule[] | null
  isLoading: boolean
  onNavigateToModules: () => void
  onNavigateToInstall: () => void
  onNavigateToGasSponsorship: () => void
  onNavigateToSessionKeys: () => void
  onNavigateToSpendingLimits: () => void
  onNavigateToDeposit: () => void
  onRevokeDelegation: () => void
}

// ============================================================================
// Component
// ============================================================================

export function SmartAccountDashboard({
  account,
  network,
  smartAccountInfo,
  installedModules,
  isLoading,
  onNavigateToModules,
  onNavigateToInstall,
  onNavigateToGasSponsorship,
  onNavigateToSessionKeys,
  onNavigateToSpendingLimits,
  onNavigateToDeposit,
  onRevokeDelegation,
}: SmartAccountDashboardProps) {
  const { t } = useTranslation('modules')

  // Paymaster data
  const { sponsorPolicy } = usePaymasterClient(account.address)

  // Spending limit data
  const { limits: spendingLimits } = useSpendingLimitStatus(account.address, installedModules)

  // EntryPoint deposit balance
  const { deposit: entryPointDeposit } = useEntryPointBalance(account.address)

  const sessionKeyCount = useMemo(() => {
    if (!installedModules) return 0
    return installedModules.filter(
      (m) => m.type === MODULE_TYPE.EXECUTOR && m.metadata.name.toLowerCase().includes('session')
    ).length
  }, [installedModules])

  const hasSpendingLimits = useMemo(() => {
    if (!installedModules) return false
    return installedModules.some(
      (m) => m.type === MODULE_TYPE.HOOK && m.metadata.name.toLowerCase().includes('spending')
    )
  }, [installedModules])

  const totalModuleCount = installedModules?.length ?? 0

  // Module count by type
  const moduleBreakdown = useMemo(() => {
    if (!installedModules || installedModules.length === 0) return ''
    const counts: Record<string, number> = {}
    for (const m of installedModules) {
      if (m.type === MODULE_TYPE.VALIDATOR)
        counts[t('validators')] = (counts[t('validators')] ?? 0) + 1
      else if (m.type === MODULE_TYPE.EXECUTOR)
        counts[t('executors')] = (counts[t('executors')] ?? 0) + 1
      else if (m.type === MODULE_TYPE.HOOK) counts[t('hooks')] = (counts[t('hooks')] ?? 0) + 1
      else if (m.type === MODULE_TYPE.FALLBACK)
        counts[t('fallbacks')] = (counts[t('fallbacks')] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ')
  }, [installedModules, t])

  // Gas sponsorship detail
  const gasSponsorshipDetail = useMemo(() => {
    if (!network?.paymasterUrl || !sponsorPolicy?.isAvailable) return undefined
    if (sponsorPolicy.dailyLimitRemaining != null) {
      return t('dashboard.dailyLimit', {
        amount: formatBigIntAmount(BigInt(sponsorPolicy.dailyLimitRemaining.toString())),
      })
    }
    return undefined
  }, [network?.paymasterUrl, sponsorPolicy, t])

  // Spending limit detail
  const spendingLimitDetail = useMemo(() => {
    const first = spendingLimits[0]
    if (!first) return undefined
    const periodLabel = getPeriodLabel(first.period)
    return t('dashboard.limitProgress', {
      spent: formatBigIntAmount(first.spent),
      limit: formatBigIntAmount(first.limit),
      period: periodLabel,
    })
  }, [spendingLimits, t])

  const truncatedAddress = smartAccountInfo?.delegationTarget
    ? `${smartAccountInfo.delegationTarget.slice(0, 8)}...${smartAccountInfo.delegationTarget.slice(-6)}`
    : null

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          {t('dashboard.title')}
        </h1>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: 'rgb(var(--primary) / 0.1)',
            color: 'rgb(var(--primary))',
          }}
        >
          {smartAccountInfo?.isDelegated ? t('dashboard.delegated') : t('dashboard.smart')}
        </span>
      </div>

      {/* Status Card - Delegation Target */}
      {smartAccountInfo?.delegationTarget && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: 'rgb(var(--card))',
            borderWidth: 1,
            borderColor: 'rgb(var(--border))',
          }}
        >
          <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('dashboard.delegatedTo')}
          </p>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono flex-1" style={{ color: 'rgb(var(--foreground))' }}>
              {truncatedAddress}
            </code>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'rgb(var(--primary))' }}
              onClick={() => navigator.clipboard.writeText(smartAccountInfo.delegationTarget!)}
              title="Copy"
            >
              Copy
            </button>
            {network?.explorerUrl && (
              <button
                type="button"
                className="p-1 rounded"
                style={{ color: 'rgb(var(--primary))' }}
                title={t('dashboard.viewExplorer')}
                onClick={() =>
                  chrome.tabs.create({
                    url: `${network.explorerUrl}/address/${smartAccountInfo.delegationTarget}`,
                  })
                }
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </button>
            )}
          </div>

          {smartAccountInfo.accountId && (
            <div
              className="mt-3 pt-3"
              style={{ borderTopWidth: 1, borderTopColor: 'rgb(var(--border))' }}
            >
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('dashboard.accountId')}
              </p>
              <p className="text-sm font-mono mt-0.5" style={{ color: 'rgb(var(--foreground))' }}>
                {smartAccountInfo.accountId}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Feature Grid 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        <FeatureCard
          icon="⛽"
          label={t('dashboard.gasSponsorship')}
          status={network?.paymasterUrl ? t('dashboard.available') : t('dashboard.notConfigured')}
          isActive={!!network?.paymasterUrl}
          detail={gasSponsorshipDetail}
          onClick={onNavigateToGasSponsorship}
        />
        <FeatureCard
          icon="🔑"
          label={t('dashboard.sessionKeys')}
          status={
            sessionKeyCount > 0
              ? t('dashboard.activeCount', { count: sessionKeyCount })
              : t('dashboard.none')
          }
          isActive={sessionKeyCount > 0}
          onClick={onNavigateToSessionKeys}
        />
        <FeatureCard
          icon="💰"
          label={t('dashboard.spendingLimits')}
          status={hasSpendingLimits ? t('dashboard.active') : t('dashboard.notConfigured')}
          isActive={hasSpendingLimits}
          detail={spendingLimitDetail}
          onClick={onNavigateToSpendingLimits}
        />
        <FeatureCard
          icon="💎"
          label={t('dashboard.entryPointDeposit')}
          status={
            entryPointDeposit > 0n
              ? t('dashboard.depositBalance', { amount: formatBigIntAmount(entryPointDeposit) })
              : t('dashboard.noDeposit')
          }
          isActive={entryPointDeposit > 0n}
          onClick={onNavigateToDeposit}
        />
        <FeatureCard
          icon="🧩"
          label={t('dashboard.modules')}
          status={t('dashboard.installedCount', { count: totalModuleCount })}
          isActive={totalModuleCount > 0}
          detail={moduleBreakdown || undefined}
          onClick={onNavigateToModules}
        />
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <button
          type="button"
          className="w-full py-2.5 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: 'rgb(var(--primary))',
            color: 'white',
          }}
          onClick={onNavigateToInstall}
        >
          {t('addModule')}
        </button>
        <button
          type="button"
          className="w-full py-2.5 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: 'rgb(var(--secondary))',
            color: 'rgb(var(--foreground))',
          }}
          onClick={onNavigateToModules}
        >
          {t('dashboard.manageModules')}
        </button>
      </div>

      {/* Revoke Delegation */}
      {smartAccountInfo?.isDelegated && (
        <div className="text-center pt-2">
          <button
            type="button"
            className="text-xs underline"
            style={{ color: 'rgb(var(--muted-foreground))' }}
            onClick={onRevokeDelegation}
          >
            {t('dashboard.revokeDelegation')}
          </button>
        </div>
      )}
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
  if (num < 0.01) return '<0.01'
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function getPeriodLabel(periodSeconds: bigint): string {
  const hours = Number(periodSeconds) / 3600
  if (hours <= 1) return 'hourly'
  if (hours <= 24) return 'daily'
  if (hours <= 168) return 'weekly'
  return 'monthly'
}

// ============================================================================
// Sub-Components
// ============================================================================

interface FeatureCardProps {
  icon: string
  label: string
  status: string
  isActive: boolean
  detail?: string
  onClick?: () => void
}

function FeatureCard({ icon, label, status, isActive, detail, onClick }: FeatureCardProps) {
  return (
    <div
      className="rounded-lg p-3 transition-colors"
      style={{
        backgroundColor: 'rgb(var(--secondary))',
        cursor: onClick ? 'pointer' : undefined,
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <span className="text-xl">{icon}</span>
      <p className="text-sm font-medium mt-1" style={{ color: 'rgb(var(--foreground))' }}>
        {label}
      </p>
      <p
        className="text-xs mt-0.5"
        style={{ color: isActive ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))' }}
      >
        {status}
      </p>
      {detail && (
        <p className="text-xs mt-0.5 truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {detail}
        </p>
      )}
    </div>
  )
}

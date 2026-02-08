import { useTranslation } from 'react-i18next'
import type { Address } from 'viem'
import { useWalletStore } from '../hooks/useWalletStore'
import { useModules } from './Modules/hooks/useModules'
import { useSmartAccountInfo } from './Modules/hooks/useSmartAccountInfo'

/**
 * Smart Account Dashboard
 *
 * Shows SA status, delegation info, root validator, installed modules summary,
 * and quick actions for module management.
 */
export function SmartAccountDashboard() {
  const { t } = useTranslation('tx')
  const { selectedAccount, accounts, setPage } = useWalletStore()
  const currentAccount = accounts.find((a) => a.address === selectedAccount)
  const { info, isLoading: isInfoLoading } = useSmartAccountInfo(
    selectedAccount as Address | undefined
  )
  const { installedModules, isLoading: isModulesLoading } = useModules(
    selectedAccount as Address | undefined
  )

  const isLoading = isInfoLoading || isModulesLoading

  // Count modules by type
  const moduleCounts = { validator: 0, executor: 0, hook: 0, fallback: 0 }
  if (installedModules) {
    for (const mod of installedModules) {
      if (mod.type === 1n) moduleCounts.validator++
      else if (mod.type === 2n) moduleCounts.executor++
      else if (mod.type === 4n) moduleCounts.hook++
      else if (mod.type === 3n) moduleCounts.fallback++
    }
  }

  function truncateAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (!currentAccount) {
    return (
      <div className="p-4 text-center">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>{t('noAccountSelected')}</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPage('home')}
          className="p-1 rounded-lg transition-colors"
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
        <h1 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
          {t('dashboardTitle')}
        </h1>
      </div>

      {/* Status Card */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--accent)))',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              backgroundColor:
                info?.accountType === 'smart' || info?.accountType === 'delegated'
                  ? 'rgba(74, 222, 128, 0.25)'
                  : 'rgba(255, 255, 255, 0.2)',
              color: 'white',
            }}
          >
            {isLoading
              ? '...'
              : info?.accountType === 'smart'
                ? t('smartAccountActive')
                : info?.accountType === 'delegated'
                  ? t('delegatedEip7702')
                  : 'EOA'}
          </span>
          {info?.isDeployed && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: 'rgba(74, 222, 128, 0.2)', color: 'white' }}
            >
              {t('deployedStatus')}
            </span>
          )}
        </div>
        <p className="text-white text-sm opacity-80 font-mono">{currentAccount.address}</p>
        {info?.accountId && <p className="text-white text-xs opacity-60 mt-1">{info.accountId}</p>}
      </div>

      {/* Delegation Info */}
      {info?.isDelegated && info.delegationTarget && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('delegationTarget')}
              </p>
              <p className="text-sm font-mono mt-0.5" style={{ color: 'rgb(var(--foreground))' }}>
                {truncateAddress(info.delegationTarget)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(info.delegationTarget!)
              }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgb(var(--primary))' }}
              title={t('copyDelegationAddress')}
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Root Validator */}
      {info?.rootValidator && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('rootValidator')}
              </p>
              <p className="text-sm font-mono mt-0.5" style={{ color: 'rgb(var(--foreground))' }}>
                {truncateAddress(info.rootValidator)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPage('settings')}
              className="text-xs px-3 py-1 rounded-lg transition-colors"
              style={{
                backgroundColor: 'rgb(var(--primary) / 0.1)',
                color: 'rgb(var(--primary))',
              }}
            >
              {t('change')}
            </button>
          </div>
        </div>
      )}

      {/* Installed Modules Grid */}
      {(info?.accountType === 'smart' || info?.accountType === 'delegated') && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--foreground))' }}>
            {t('installedModules')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t('validators'), count: moduleCounts.validator, color: '--primary' },
              { label: t('executors'), count: moduleCounts.executor, color: '--accent' },
              { label: t('hooks'), count: moduleCounts.hook, color: '--warning' },
              { label: t('fallbacks'), count: moduleCounts.fallback, color: '--success' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: 'rgb(var(--secondary))' }}
              >
                <p className="text-2xl font-bold" style={{ color: `rgb(var(${item.color}))` }}>
                  {isModulesLoading ? '-' : item.count}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--foreground))' }}>
          {t('quickActions')}
        </h3>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setPage('modules')}
            className="w-full flex items-center gap-3 rounded-xl p-3 transition-colors"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
            >
              <svg
                className="w-4 h-4"
                style={{ color: 'rgb(var(--primary))' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                {t('installModule')}
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('installModuleDesc')}
              </p>
            </div>
          </button>

          {info?.accountType === 'eoa' && (
            <button
              type="button"
              onClick={() => setPage('modules')}
              className="w-full flex items-center gap-3 rounded-xl p-3 transition-colors"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgb(var(--warning) / 0.1)' }}
              >
                <svg
                  className="w-4 h-4"
                  style={{ color: 'rgb(var(--warning))' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  {t('enableDelegation')}
                </p>
                <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {t('enableDelegationDesc')}
                </p>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => setPage('activity')}
            className="w-full flex items-center gap-3 rounded-xl p-3 transition-colors"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgb(var(--muted-foreground) / 0.1)' }}
            >
              <svg
                className="w-4 h-4"
                style={{ color: 'rgb(var(--muted-foreground))' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                {t('viewActivity')}
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('viewActivityDesc')}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

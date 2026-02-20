import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEther } from 'viem'

import type { Account } from '../../../types/account'
import type { Network } from '../../../types/network'
import { usePaymasterStatus } from './hooks/usePaymasterStatus'

// ============================================================================
// Types
// ============================================================================

interface GasSponsorshipViewProps {
  account: Account
  network: Network | undefined
  onBack: () => void
}

// ============================================================================
// Component
// ============================================================================

export function GasSponsorshipView({ account, network, onBack }: GasSponsorshipViewProps) {
  const { t } = useTranslation('modules')
  const {
    sponsorPolicy,
    supportedTokens,
    accountStatus,
    isLoading,
    isRegistering,
    registerAccount,
  } = usePaymasterStatus(account.address)

  const [showConfirm, setShowConfirm] = useState(false)
  const [registrationError, setRegistrationError] = useState<string | null>(null)

  const paymasterConfigured = !!network?.paymasterUrl

  const handleRegister = async () => {
    setRegistrationError(null)
    const result = await registerAccount()
    if (result.success) {
      setShowConfirm(false)
    } else {
      setRegistrationError(result.error ?? 'Registration failed')
    }
  }

  // Derive registration status
  const registrationStatus = accountStatus?.isRegistered
    ? 'registered'
    : paymasterConfigured
      ? 'unregistered'
      : 'unavailable'

  if (isLoading) {
    return (
      <div className="p-4">
        <ViewHeader onBack={onBack} title={t('gasSponsorship.title', 'Gas Sponsorship')} />
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
      <ViewHeader onBack={onBack} title={t('gasSponsorship.title', 'Gas Sponsorship')} />

      {/* Registration Status Card */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: 'rgb(var(--card))',
          borderWidth: 1,
          borderColor: 'rgb(var(--border))',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{
              backgroundColor:
                registrationStatus === 'registered'
                  ? 'rgb(var(--success) / 0.1)'
                  : 'rgb(var(--secondary))',
            }}
          >
            {registrationStatus === 'registered' ? '✅' : registrationStatus === 'unregistered' ? '⏳' : '❌'}
          </div>
          <div className="flex-1">
            <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              {registrationStatus === 'registered'
                ? t('gasSponsorship.registered', 'Sponsorship Active')
                : registrationStatus === 'unregistered'
                  ? t('gasSponsorship.unregistered', 'Not Registered')
                  : t('gasSponsorship.unavailable', 'Paymaster Not Available')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {registrationStatus === 'registered'
                ? t('gasSponsorship.registeredDesc', 'Your transactions are eligible for gas sponsorship')
                : registrationStatus === 'unregistered'
                  ? t('gasSponsorship.unregisteredDesc', 'Register to enable gas sponsorship for your transactions')
                  : t('gasSponsorship.unavailableDesc', 'Paymaster is not configured for this network')}
            </p>
          </div>
        </div>

        {accountStatus?.registeredAt && (
          <p className="text-xs mt-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('gasSponsorship.registeredAt', 'Registered')}: {accountStatus.registeredAt}
          </p>
        )}
      </div>

      {/* Sponsor Policy Section */}
      {sponsorPolicy?.isAvailable && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: 'rgb(var(--card))',
            borderWidth: 1,
            borderColor: 'rgb(var(--border))',
          }}
        >
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground))' }}
          >
            {t('gasSponsorship.policyTitle', 'Sponsorship Policy')}
          </h3>

          {/* Daily Limit */}
          {accountStatus?.policy && (
            <div className="space-y-3">
              <PolicyRow
                label={t('gasSponsorship.dailyLimit', 'Daily Limit')}
                used={accountStatus.policy.dailyUsed}
                total={accountStatus.policy.dailyLimit}
                symbol={network?.currency.symbol ?? ''}
              />
              <PolicyRow
                label={t('gasSponsorship.perTxLimit', 'Per Transaction Limit')}
                total={accountStatus.policy.perTxLimit}
                symbol={network?.currency.symbol ?? ''}
              />
            </div>
          )}

          {/* Fallback: show basic policy from sponsorPolicy */}
          {!accountStatus?.policy && sponsorPolicy.dailyLimit != null && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {t('gasSponsorship.dailyLimit', 'Daily Limit')}
                </span>
                <span style={{ color: 'rgb(var(--foreground))' }}>
                  {formatBigIntAmount(BigInt(String(sponsorPolicy.dailyLimit)))} {network?.currency.symbol ?? ''}
                </span>
              </div>
              {sponsorPolicy.maxGas != null && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {t('gasSponsorship.maxGasPerTx', 'Max Gas Per Tx')}
                  </span>
                  <span style={{ color: 'rgb(var(--foreground))' }}>
                    {formatBigIntAmount(BigInt(String(sponsorPolicy.maxGas)))} {network?.currency.symbol ?? ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {sponsorPolicy.sponsor?.name && (
            <div
              className="mt-3 pt-3 flex justify-between text-sm"
              style={{ borderTopWidth: 1, borderTopColor: 'rgb(var(--border))' }}
            >
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('gasSponsorship.sponsor', 'Sponsor')}
              </span>
              <span style={{ color: 'rgb(var(--foreground))' }}>
                {sponsorPolicy.sponsor.name}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Supported Tokens */}
      {supportedTokens && supportedTokens.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: 'rgb(var(--card))',
            borderWidth: 1,
            borderColor: 'rgb(var(--border))',
          }}
        >
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--foreground))' }}
          >
            {t('gasSponsorship.supportedTokens', 'Supported Tokens')}
          </h3>
          <div className="space-y-2">
            {supportedTokens.map((token) => {
              const isNativeToken = token.address === '0x0000000000000000000000000000000000000000'
              return (
                <div
                  key={token.address}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{isNativeToken ? '💎' : '🪙'}</span>
                    <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                      {token.symbol}
                    </span>
                  </div>
                  {isNativeToken && (
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: 'rgb(var(--primary) / 0.1)',
                        color: 'rgb(var(--primary))',
                      }}
                    >
                      Native
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Register Button */}
      {registrationStatus === 'unregistered' && !showConfirm && (
        <button
          type="button"
          className="w-full py-2.5 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: 'rgb(var(--primary))',
            color: 'white',
          }}
          onClick={() => setShowConfirm(true)}
        >
          {t('gasSponsorship.register', 'Register for Gas Sponsorship')}
        </button>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: 'rgb(var(--card))',
            borderWidth: 1,
            borderColor: 'rgb(var(--primary) / 0.3)',
          }}
        >
          <p className="text-sm mb-3" style={{ color: 'rgb(var(--foreground))' }}>
            {t(
              'gasSponsorship.confirmMessage',
              'Register your account with the paymaster to enable gas sponsorship. Your transactions will be eligible for free gas within the sponsor policy limits.'
            )}
          </p>

          {registrationError && (
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--destructive))' }}>
              {registrationError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: 'rgb(var(--secondary))',
                color: 'rgb(var(--foreground))',
              }}
              onClick={() => {
                setShowConfirm(false)
                setRegistrationError(null)
              }}
              disabled={isRegistering}
            >
              {t('gasSponsorship.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: 'rgb(var(--primary))',
                color: 'white',
                opacity: isRegistering ? 0.6 : 1,
              }}
              onClick={handleRegister}
              disabled={isRegistering}
            >
              {isRegistering
                ? t('gasSponsorship.registering', 'Registering...')
                : t('gasSponsorship.confirm', 'Confirm Registration')}
            </button>
          </div>
        </div>
      )}

      {/* Active Status */}
      {registrationStatus === 'registered' && (
        <div
          className="text-center py-2 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: 'rgb(var(--success) / 0.1)',
            color: 'rgb(var(--success))',
          }}
        >
          {t('gasSponsorship.activeStatus', 'Gas Sponsorship Active')}
        </div>
      )}
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
        ←
      </button>
      <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
        {title}
      </h1>
    </div>
  )
}

interface PolicyRowProps {
  label: string
  used?: string
  total: string
  symbol: string
}

function PolicyRow({ label, used, total, symbol }: PolicyRowProps) {
  const totalBn = BigInt(total || '0')
  const usedBn = used ? BigInt(used) : undefined

  const percentage = usedBn != null && totalBn > 0n
    ? Number((usedBn * 100n) / totalBn)
    : undefined

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>{label}</span>
        <span style={{ color: 'rgb(var(--foreground))' }}>
          {usedBn != null
            ? `${formatBigIntAmount(usedBn)} / ${formatBigIntAmount(totalBn)} ${symbol}`
            : `${formatBigIntAmount(totalBn)} ${symbol}`}
        </span>
      </div>
      {percentage != null && (
        <div
          className="h-1.5 rounded-full overflow-hidden"
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
  if (num < 0.0001) return '<0.0001'
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

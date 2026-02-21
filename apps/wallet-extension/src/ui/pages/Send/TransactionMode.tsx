import { ACCOUNT_TYPE, type Account, TRANSACTION_MODE, type TransactionMode } from '@stablenet/core'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNetworkCurrency } from '../../hooks'

// ============================================================================
// Types
// ============================================================================

interface TransactionModeSelectorProps {
  /** Current account */
  account: Account

  /** Available modes for this account */
  availableModes: TransactionMode[]

  /** Currently selected mode */
  selectedMode: TransactionMode

  /** Mode change handler */
  onModeChange: (mode: TransactionMode) => void

  /** Show detailed descriptions */
  showDescriptions?: boolean

  /** Disabled state */
  disabled?: boolean
}

interface ModeInfo {
  id: TransactionMode
  name: string
  shortDescription: string
  longDescription: string
  icon: string
  features: string[]
  requirements: string[]
  gasInfo: string
}

// ============================================================================
// Mode Information
// ============================================================================

function getModeInfo(t: (key: string) => string): Record<TransactionMode, ModeInfo> {
  return {
    [TRANSACTION_MODE.EOA]: {
      id: TRANSACTION_MODE.EOA,
      name: t('directEoa'),
      shortDescription: t('standardTransaction'),
      longDescription: t('directEoaDesc'),
      icon: '📤',
      features: [t('maxCompatibility'), t('lowestGasOverhead'), t('worksEverywhere')],
      requirements: [t('ethForGas')],
      gasInfo: t('payGasWithEth'),
    },
    [TRANSACTION_MODE.EIP7702]: {
      id: TRANSACTION_MODE.EIP7702,
      name: t('setupSmartAccount'),
      shortDescription: t('upgradeToSmartAccount'),
      longDescription: t('setupSmartAccountDesc'),
      icon: '⚙️',
      features: [t('keepExistingAddress'), t('enableSmartAccountFeatures'), t('reversible')],
      requirements: [t('ethForGas'), t('oneTimeSetup')],
      gasInfo: t('oneTimeGasCost'),
    },
    [TRANSACTION_MODE.SMART_ACCOUNT]: {
      id: TRANSACTION_MODE.SMART_ACCOUNT,
      name: t('smartAccountMode'),
      shortDescription: t('advancedFeatures'),
      longDescription: t('smartAccountDesc'),
      icon: '🔷',
      features: [
        t('gasSponsorshipAvailable'),
        t('payGasWithTokens'),
        t('batchOperations'),
        t('sessionKeysAndLimits'),
      ],
      requirements: [t('smartAccountEnabled')],
      gasInfo: t('flexibleGasOptions'),
    },
  }
}

// ============================================================================
// Component
// ============================================================================

export function TransactionModeSelector({
  account,
  availableModes,
  selectedMode,
  onModeChange,
  showDescriptions = true,
  disabled = false,
}: TransactionModeSelectorProps) {
  const { t } = useTranslation('send')
  const modeInfo = useMemo(() => getModeInfo(t), [t])

  // Filter to only show available modes
  const modes = useMemo(
    () => availableModes.map((mode) => modeInfo[mode]).filter(Boolean),
    [availableModes, modeInfo]
  )

  // Check if account needs setup
  const needsSetup = useMemo(() => {
    return (
      account.type === ACCOUNT_TYPE.EOA &&
      availableModes.includes(TRANSACTION_MODE.EIP7702) &&
      !availableModes.includes(TRANSACTION_MODE.SMART_ACCOUNT)
    )
  }, [account.type, availableModes])

  return (
    <div className="transaction-mode-selector mb-4">
      <span
        className="block text-sm font-medium mb-2"
        style={{ color: 'rgb(var(--foreground-secondary))' }}
      >
        {t('transactionMode')}
      </span>

      {/* Mode Cards */}
      <div className="mode-cards space-y-2">
        {modes.map((mode) => (
          <ModeCard
            key={mode.id}
            mode={mode}
            isSelected={selectedMode === mode.id}
            isDisabled={disabled}
            showDescription={showDescriptions}
            onSelect={() => onModeChange(mode.id)}
          />
        ))}
      </div>

      {/* Setup Prompt */}
      {needsSetup && selectedMode !== TRANSACTION_MODE.EIP7702 && (
        <div
          className="setup-prompt mt-3 p-3 rounded-lg"
          style={{
            backgroundColor: 'rgb(var(--primary) / 0.1)',
            borderColor: 'rgb(var(--primary) / 0.2)',
            borderWidth: 1,
          }}
        >
          <div className="flex items-start gap-2">
            <span style={{ color: 'rgb(var(--primary))' }}>💡</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(var(--primary))' }}>
                {t('enableSmartAccountFeatures')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('enableSmartAccountHint')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Account Type Info */}
      <AccountTypeInfo account={account} />
    </div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ModeCardProps {
  mode: ModeInfo
  isSelected: boolean
  isDisabled: boolean
  showDescription: boolean
  onSelect: () => void
}

function ModeCard({ mode, isSelected, isDisabled, showDescription, onSelect }: ModeCardProps) {
  const { t } = useTranslation('send')
  return (
    <button
      type="button"
      className={`
        mode-card w-full p-3 rounded-lg border-2 text-left transition-all
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      style={{
        borderColor: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--border))',
        backgroundColor: isSelected ? 'rgb(var(--primary) / 0.05)' : 'transparent',
      }}
      onClick={onSelect}
      disabled={isDisabled}
      aria-pressed={isSelected}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <span className="text-2xl">{mode.icon}</span>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              {mode.name}
            </span>
            {isSelected && (
              <span className="text-sm" style={{ color: 'rgb(var(--primary))' }}>
                {t('selectedCheck')}
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {mode.shortDescription}
          </p>
        </div>
      </div>

      {/* Expanded Description */}
      {showDescription && isSelected && (
        <div
          className="mt-3 pt-3"
          style={{ borderTopWidth: 1, borderTopColor: 'rgb(var(--border))' }}
        >
          <p className="text-sm mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {mode.longDescription}
          </p>

          {/* Features */}
          <div className="features mt-2">
            <p
              className="text-xs font-medium mb-1"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              {t('features')}
            </p>
            <ul className="text-xs space-y-1" style={{ color: 'rgb(var(--foreground))' }}>
              {mode.features.map((feature) => (
                <li key={feature} className="flex items-center gap-1">
                  <span style={{ color: 'rgb(var(--success))' }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Gas Info */}
          <div
            className="gas-info mt-2 p-2 rounded text-xs"
            style={{
              backgroundColor: 'rgb(var(--secondary))',
              color: 'rgb(var(--muted-foreground))',
            }}
          >
            💰 {mode.gasInfo}
          </div>
        </div>
      )}
    </button>
  )
}

interface AccountTypeInfoProps {
  account: Account
}

function AccountTypeInfo({ account }: AccountTypeInfoProps) {
  const { t } = useTranslation('send')
  const typeInfo = useMemo(() => {
    switch (account.type) {
      case ACCOUNT_TYPE.EOA:
        return {
          label: t('standardWalletEoa'),
          description: t('standardWalletDesc'),
        }
      case ACCOUNT_TYPE.DELEGATED:
        return {
          label: t('smartAccountDelegated'),
          description: t('smartAccountDelegatedDesc'),
        }
      case ACCOUNT_TYPE.SMART:
        return {
          label: t('smartAccountType'),
          description: t('smartAccountTypeDesc'),
        }
      default:
        return null
    }
  }, [account.type, t])

  if (!typeInfo) return null

  return (
    <div className="account-type-info mt-3 text-xs">
      <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
        {typeInfo.label}:
      </span>{' '}
      <span style={{ color: 'rgb(var(--muted-foreground))' }}>{typeInfo.description}</span>
    </div>
  )
}

// ============================================================================
// Compact Mode Selector (for limited space)
// ============================================================================

interface CompactModeSelectorProps {
  availableModes: TransactionMode[]
  selectedMode: TransactionMode
  onModeChange: (mode: TransactionMode) => void
  disabled?: boolean
}

export function CompactModeSelector({
  availableModes,
  selectedMode,
  onModeChange,
  disabled = false,
}: CompactModeSelectorProps) {
  const { t } = useTranslation('send')
  const modeInfo = useMemo(() => getModeInfo(t), [t])
  return (
    <div
      className="compact-mode-selector flex gap-1 p-1 rounded-lg"
      style={{ backgroundColor: 'rgb(var(--secondary))' }}
    >
      {availableModes.map((mode) => {
        const info = modeInfo[mode]
        const isSelected = selectedMode === mode
        return (
          <button
            key={mode}
            type="button"
            className={`
              flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            style={{
              backgroundColor: isSelected ? 'rgb(var(--card))' : 'transparent',
              color: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
              boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
            onClick={() => onModeChange(mode)}
            disabled={disabled}
          >
            <span className="mr-1">{info.icon}</span>
            {info.name.split(' ')[0]}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// Mode Comparison Table
// ============================================================================

interface ModeComparisonProps {
  availableModes: TransactionMode[]
  gasEstimates?: Partial<Record<TransactionMode, bigint>>
}

export function ModeComparison({ availableModes, gasEstimates }: ModeComparisonProps) {
  const { t } = useTranslation('send')
  const { symbol: currencySymbol } = useNetworkCurrency()
  const modeInfo = useMemo(() => getModeInfo(t), [t])
  return (
    <div className="mode-comparison overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: 'rgb(var(--muted-foreground))', borderBottomWidth: 1 }}>
            <th className="pb-2 text-left">{t('mode')}</th>
            <th className="pb-2 text-left">{t('gasCost')}</th>
            <th className="pb-2 text-left">{t('features')}</th>
          </tr>
        </thead>
        <tbody>
          {availableModes.map((mode) => {
            const info = modeInfo[mode]
            const estimate = gasEstimates?.[mode]

            return (
              <tr
                key={mode}
                style={{ borderBottomWidth: 1, borderBottomColor: 'rgb(var(--border))' }}
              >
                <td className="py-2" style={{ color: 'rgb(var(--foreground))' }}>
                  <span className="mr-1">{info.icon}</span>
                  {info.name}
                </td>
                <td className="py-2 font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                  {estimate ? `${(Number(estimate) / 1e18).toFixed(4)} ${currencySymbol}` : '-'}
                </td>
                <td className="py-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {info.features[0]}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

import { ACCOUNT_TYPE, type Account, TRANSACTION_MODE, type TransactionMode } from '@stablenet/core'
import { useMemo } from 'react'

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

const MODE_INFO: Record<TransactionMode, ModeInfo> = {
  [TRANSACTION_MODE.EOA]: {
    id: TRANSACTION_MODE.EOA,
    name: 'Direct (EOA)',
    shortDescription: 'Standard transaction',
    longDescription:
      'Send a standard Ethereum transaction directly from your wallet. ' +
      'This is the simplest and most compatible method.',
    icon: '📤',
    features: ['Maximum compatibility', 'Lowest gas overhead', 'Works everywhere'],
    requirements: ['ETH for gas'],
    gasInfo: 'Pay gas with ETH',
  },
  [TRANSACTION_MODE.EIP7702]: {
    id: TRANSACTION_MODE.EIP7702,
    name: 'Setup Smart Account',
    shortDescription: 'Upgrade to Smart Account',
    longDescription:
      'Delegate your EOA to a Smart Account contract using EIP-7702. ' +
      'This enables advanced features while keeping your existing address.',
    icon: '⚙️',
    features: [
      'Keep your existing address',
      'Enable Smart Account features',
      'Reversible (can revoke)',
    ],
    requirements: ['ETH for gas', 'One-time setup'],
    gasInfo: 'One-time gas cost',
  },
  [TRANSACTION_MODE.SMART_ACCOUNT]: {
    id: TRANSACTION_MODE.SMART_ACCOUNT,
    name: 'Smart Account',
    shortDescription: 'Advanced features',
    longDescription:
      'Use Smart Account features including gas sponsorship, ' +
      'batched transactions, and modular security.',
    icon: '🔷',
    features: [
      'Gas sponsorship available',
      'Pay gas with tokens',
      'Batch multiple operations',
      'Session keys & limits',
    ],
    requirements: ['Smart Account enabled'],
    gasInfo: 'Flexible gas options',
  },
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
  // Filter to only show available modes
  const modes = useMemo(
    () => availableModes.map((mode) => MODE_INFO[mode]).filter(Boolean),
    [availableModes]
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
        Transaction Mode
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
                Enable Smart Account features
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Select "Setup Smart Account" to unlock gas sponsorship, spending limits, and more.
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
      aria-selected={isSelected}
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
                ✓ Selected
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
              Features:
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
  const typeInfo = useMemo(() => {
    switch (account.type) {
      case ACCOUNT_TYPE.EOA:
        return {
          label: 'Standard Wallet (EOA)',
          description: 'Your wallet is a standard Externally Owned Account',
        }
      case ACCOUNT_TYPE.DELEGATED:
        return {
          label: 'Smart Account (Delegated)',
          description: 'Your EOA is delegated to a Smart Account contract',
        }
      case ACCOUNT_TYPE.SMART:
        return {
          label: 'Smart Account',
          description: 'Your wallet is a Smart Contract Account',
        }
      default:
        return null
    }
  }, [account.type])

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
  return (
    <div
      className="compact-mode-selector flex gap-1 p-1 rounded-lg"
      style={{ backgroundColor: 'rgb(var(--secondary))' }}
    >
      {availableModes.map((mode) => {
        const info = MODE_INFO[mode]
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
  return (
    <div className="mode-comparison overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: 'rgb(var(--muted-foreground))', borderBottomWidth: 1 }}>
            <th className="pb-2 text-left">Mode</th>
            <th className="pb-2 text-left">Gas Cost</th>
            <th className="pb-2 text-left">Features</th>
          </tr>
        </thead>
        <tbody>
          {availableModes.map((mode) => {
            const info = MODE_INFO[mode]
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
                  {estimate ? `${(Number(estimate) / 1e18).toFixed(4)} ETH` : '-'}
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

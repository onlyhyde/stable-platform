'use client'

import type { GasPaymentMode } from '@/hooks/useGasPaymentMode'

// ============================================================================
// Types
// ============================================================================

interface GasPaymentSelectorProps {
  selectedMode: GasPaymentMode
  availableModes: GasPaymentMode[]
  onModeChange: (mode: GasPaymentMode) => void
  /** Formatted deposit balance for self-pay mode (e.g. "1.5") */
  depositBalance?: string | null
}

// ============================================================================
// Mode configuration
// ============================================================================

const MODE_CONFIG: Record<
  GasPaymentMode,
  { label: string; description: string; icon: string }
> = {
  'self-pay': {
    label: 'Self-Pay',
    description: 'Pay gas with native coin',
    icon: 'W',
  },
  'erc20-paymaster': {
    label: 'Pay with Token',
    description: 'Pay gas with ERC-20 token',
    icon: 'T',
  },
  sponsored: {
    label: 'Sponsored',
    description: 'Gas fees covered by sponsor',
    icon: 'S',
  },
}

const ALL_MODES: GasPaymentMode[] = ['self-pay', 'erc20-paymaster', 'sponsored']

// ============================================================================
// Component
// ============================================================================

export function GasPaymentSelector({
  selectedMode,
  availableModes,
  onModeChange,
  depositBalance,
}: GasPaymentSelectorProps) {
  return (
    <div className="space-y-2">
      <span
        className="block text-sm font-medium"
        style={{ color: 'rgb(var(--foreground))' }}
      >
        Gas Payment
      </span>
      <div className="grid grid-cols-3 gap-2">
        {ALL_MODES.map((mode) => {
          const config = MODE_CONFIG[mode]
          const isAvailable = availableModes.includes(mode)
          const isSelected = selectedMode === mode

          return (
            <button
              key={mode}
              type="button"
              data-testid={`gas-mode-${mode}`}
              aria-selected={isSelected ? 'true' : 'false'}
              aria-disabled={!isAvailable ? 'true' : undefined}
              onClick={() => {
                if (isAvailable) onModeChange(mode)
              }}
              className={`p-3 rounded-lg border text-left transition-all ${
                isSelected ? 'ring-2' : ''
              } ${!isAvailable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              style={{
                backgroundColor: isSelected
                  ? 'rgb(var(--primary) / 0.1)'
                  : 'rgb(var(--secondary))',
                borderColor: isSelected
                  ? 'rgb(var(--primary))'
                  : 'rgb(var(--border))',
                ...(isSelected &&
                  ({ '--tw-ring-color': 'rgb(var(--primary) / 0.3)' } as React.CSSProperties)),
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: isSelected
                      ? 'rgb(var(--primary))'
                      : 'rgb(var(--muted-foreground) / 0.2)',
                    color: isSelected
                      ? 'rgb(var(--primary-foreground))'
                      : 'rgb(var(--muted-foreground))',
                  }}
                >
                  {config.icon}
                </span>
                <div>
                  <p
                    className="text-xs font-medium"
                    style={{ color: 'rgb(var(--foreground))' }}
                  >
                    {config.label}
                  </p>
                </div>
              </div>
              <p
                className="text-xs mt-1"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                {config.description}
              </p>
              {mode === 'self-pay' && depositBalance != null && (
                <p
                  className="text-xs mt-1 font-mono"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  Deposit: {depositBalance} ETH
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

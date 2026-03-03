'use client'

import { useCallback } from 'react'
import type { Address } from 'viem'
import type { InstalledValidatorInfo, ValidatorType } from '@/hooks/useValidatorRouter'

// ============================================================================
// Types
// ============================================================================

interface ValidatorSelectorProps {
  /** List of available validators */
  validators: InstalledValidatorInfo[]
  /** Currently active validator address */
  activeValidator: Address | null
  /** Callback when user selects a different validator */
  onSelect: (address: Address) => void
  /** Whether the selector is disabled */
  disabled?: boolean
}

// ============================================================================
// Constants
// ============================================================================

const VALIDATOR_LABELS: Record<ValidatorType, string> = {
  ecdsa: 'ECDSA',
  webauthn: 'WebAuthn (Passkey)',
  multisig: 'MultiSig',
}

const VALIDATOR_DESCRIPTIONS: Record<ValidatorType, string> = {
  ecdsa: 'Standard signature validation',
  webauthn: 'Biometric / passkey authentication',
  multisig: 'Multi-signature approval',
}

// ============================================================================
// Component
// ============================================================================

export function ValidatorSelector({
  validators,
  activeValidator,
  onSelect,
  disabled = false,
}: ValidatorSelectorProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onSelect(e.target.value as Address)
    },
    [onSelect]
  )

  if (validators.length <= 1) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="validator-selector"
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Active Validator
      </label>
      <select
        id="validator-selector"
        value={activeValidator ?? ''}
        onChange={handleChange}
        disabled={disabled}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
      >
        {validators.map((v) => (
          <option key={v.address} value={v.address}>
            {v.isRoot ? 'ECDSA (Root)' : VALIDATOR_LABELS[v.type]} — {v.address.slice(0, 10)}...
          </option>
        ))}
      </select>
      {activeValidator && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {VALIDATOR_DESCRIPTIONS[
            validators.find((v) => v.address === activeValidator)?.type ?? 'ecdsa'
          ]}
        </p>
      )}
    </div>
  )
}

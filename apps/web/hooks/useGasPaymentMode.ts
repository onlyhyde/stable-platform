'use client'

import { useCallback, useMemo, useState } from 'react'
import { useSmartAccount } from './useSmartAccount'

// ============================================================================
// Types
// ============================================================================

/**
 * Gas payment modes for Smart Account transactions.
 *
 * - self-pay: Sender pays gas in native coin via EntryPoint deposit (or EOA direct)
 * - erc20-paymaster: Paymaster pays gas, recovers cost from sender's ERC-20 tokens in postOp
 * - sponsored: Third-party sponsor covers gas via Paymaster (zero cost to sender)
 */
export type GasPaymentMode = 'self-pay' | 'erc20-paymaster' | 'sponsored'

export interface GasPaymentModeState {
  selectedMode: GasPaymentMode
  availableModes: GasPaymentMode[]
  setMode: (mode: GasPaymentMode) => void
  modeDescriptions: Record<GasPaymentMode, string>
  isSmartAccount: boolean
}

// ============================================================================
// Constants
// ============================================================================

const MODE_DESCRIPTIONS: Record<GasPaymentMode, string> = {
  'self-pay': 'Pay gas with native coin (from EntryPoint deposit or EOA balance)',
  'erc20-paymaster': 'Pay gas with ERC-20 tokens via Paymaster',
  'sponsored': 'Gas sponsored by a third party (zero cost)',
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Manage gas payment mode selection for transactions.
 *
 * - Smart Account: all 3 modes available (self-pay, erc20-paymaster, sponsored)
 * - EOA: only self-pay (native coin direct, no bundler/paymaster)
 */
export function useGasPaymentMode(): GasPaymentModeState {
  const { status } = useSmartAccount()
  const [selectedMode, setSelectedMode] = useState<GasPaymentMode>('sponsored')

  const availableModes = useMemo<GasPaymentMode[]>(() => {
    if (status.isSmartAccount) {
      return ['self-pay', 'erc20-paymaster', 'sponsored']
    }
    // EOA: can only pay gas directly
    return ['self-pay']
  }, [status.isSmartAccount])

  const setMode = useCallback(
    (mode: GasPaymentMode) => {
      if (availableModes.includes(mode)) {
        setSelectedMode(mode)
      }
    },
    [availableModes]
  )

  return {
    selectedMode,
    availableModes,
    setMode,
    modeDescriptions: MODE_DESCRIPTIONS,
    isSmartAccount: status.isSmartAccount,
  }
}

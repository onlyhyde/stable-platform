/**
 * WalletContext - Shared context definition and consumer hooks
 *
 * Separated from WalletProvider to avoid circular dependencies
 * when hooks need to auto-inject the provider from context.
 */

import { createContext, useContext } from 'react'
import type { Address } from 'viem'
import type { StableNetProvider } from '../provider/StableNetProvider'

export interface WalletContextValue {
  // State
  isConnected: boolean
  account: Address | null
  chainId: number | null
  isConnecting: boolean
  error: Error | null

  // Actions
  connect: () => Promise<Address[]>
  disconnect: () => Promise<void>
  switchNetwork: (chainId: number) => Promise<void>

  // Provider access (for other hooks like useBalance, useToken)
  provider: StableNetProvider | null
}

export const WalletContext = createContext<WalletContextValue | null>(null)

/**
 * Access wallet state and actions from the WalletProvider context.
 * Must be used within a <WalletProvider> component tree.
 *
 * @throws Error if used outside WalletProvider
 */
export function useWalletContext(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWalletContext must be used within a <WalletProvider>')
  }
  return context
}

/**
 * Try to get the wallet provider from context.
 * Returns null if outside a WalletProvider — does not throw.
 */
export function useOptionalProvider(): StableNetProvider | null {
  const context = useContext(WalletContext)
  return context?.provider ?? null
}

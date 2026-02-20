/**
 * WalletProvider - React Context Provider for centralized wallet state
 *
 * Manages a single StableNetProvider instance shared across the component tree.
 * Child components access wallet state via useWalletContext() without prop drilling.
 *
 * @example
 * ```tsx
 * import { WalletProvider, useWalletContext } from '@stablenet/wallet-sdk/react'
 *
 * function App() {
 *   return (
 *     <WalletProvider autoConnect>
 *       <MyDApp />
 *     </WalletProvider>
 *   )
 * }
 *
 * function MyDApp() {
 *   const { isConnected, account, connect, provider } = useWalletContext()
 *   // ...
 * }
 * ```
 */

import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useWallet } from '../hooks/useWallet'
import type { NetworkConfig } from '../types'
import { WalletContext } from './WalletContext'

// Re-export context consumer hooks for convenience
export { useOptionalProvider, useWalletContext } from './WalletContext'
export type { WalletContextValue } from './WalletContext'

// ---------------------------------------------------------------------------
// Provider Component
// ---------------------------------------------------------------------------

export interface WalletProviderProps {
  children: ReactNode
  autoConnect?: boolean
  timeout?: number
  networks?: NetworkConfig[]
}

export function WalletProvider({ children, autoConnect, timeout, networks }: WalletProviderProps) {
  const wallet = useWallet({ autoConnect, timeout, networks })

  return createElement(WalletContext.Provider, { value: wallet }, children)
}

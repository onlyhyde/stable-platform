/**
 * @stablenet/wallet-sdk/react
 *
 * React hooks for StableNet Wallet integration
 *
 * @example
 * ```tsx
 * import { useWallet, useBalance } from '@stablenet/wallet-sdk/react'
 *
 * function App() {
 *   const { isConnected, account, connect } = useWallet()
 *   const { balance } = useBalance({ provider, account })
 *
 *   if (!isConnected) {
 *     return <button onClick={connect}>Connect Wallet</button>
 *   }
 *
 *   return <div>Balance: {balance?.toString()}</div>
 * }
 * ```
 */

// Re-export everything from main entry
export * from './index'

// React hooks
export { useWallet } from './hooks/useWallet'
export { useBalance } from './hooks/useBalance'

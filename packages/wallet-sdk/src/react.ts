/**
 * @stablenet/wallet-sdk/react
 *
 * React hooks for StableNet Wallet integration
 *
 * @example
 * ```tsx
 * import { useWallet, useBalance, useNetwork } from '@stablenet/wallet-sdk/react'
 *
 * function App() {
 *   const { isConnected, account, connect, provider } = useWallet()
 *   const { balance } = useBalance({ provider, account })
 *   const { network, switchNetwork } = useNetwork({ provider })
 *
 *   if (!isConnected) {
 *     return <button onClick={connect}>Connect Wallet</button>
 *   }
 *
 *   return (
 *     <div>
 *       <p>Network: {network?.name}</p>
 *       <p>Balance: {balance?.toString()}</p>
 *     </div>
 *   )
 * }
 * ```
 */

export type { WalletContextValue, WalletProviderProps } from './context/WalletProvider'

// React Context Provider
export { useOptionalProvider, useWalletContext, WalletProvider } from './context/WalletProvider'
export { useBalance } from './hooks/useBalance'
export { useChainId } from './hooks/useChainId'
export { useContractRead } from './hooks/useContractRead'
export { useContractWrite } from './hooks/useContractWrite'
export { useNetwork } from './hooks/useNetwork'
export { useToken } from './hooks/useToken'
// React hooks
export { useWallet } from './hooks/useWallet'
// Re-export everything from main entry
export * from './index'

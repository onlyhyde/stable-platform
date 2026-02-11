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
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Address } from 'viem'
import { detectProvider } from '../provider/detect'
import type { StableNetProvider } from '../provider/StableNetProvider'
import type { WalletSDKConfig, WalletState } from '../types'

// ---------------------------------------------------------------------------
// Context Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WalletContext = createContext<WalletContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider Component
// ---------------------------------------------------------------------------

export interface WalletProviderProps extends WalletSDKConfig {
  children: ReactNode
}

const initialState: WalletState = {
  isConnected: false,
  account: null,
  chainId: null,
  isConnecting: false,
}

export function WalletProvider({ children, autoConnect, timeout, networks }: WalletProviderProps) {
  const [state, setState] = useState<WalletState>(initialState)
  const [error, setError] = useState<Error | null>(null)
  const [provider, setProvider] = useState<StableNetProvider | null>(null)
  const unsubscribesRef = useRef<Array<() => void>>([])

  // Initialize provider once
  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const detected = await detectProvider({ autoConnect: false, timeout, networks })
        if (!mounted || !detected) return

        setProvider(detected)

        // Setup event listeners
        const unsubs: Array<() => void> = []

        unsubs.push(
          detected.on('connect', (info) => {
            if (!mounted) return
            setState((prev) => ({
              ...prev,
              isConnected: true,
              chainId: Number.parseInt(info.chainId, 16),
            }))
          })
        )

        unsubs.push(
          detected.on('disconnect', () => {
            if (!mounted) return
            setState(initialState)
          })
        )

        unsubs.push(
          detected.on('accountsChanged', (accounts) => {
            if (!mounted) return
            setState((prev) => ({
              ...prev,
              isConnected: accounts.length > 0,
              account: accounts[0] ?? null,
            }))
          })
        )

        unsubs.push(
          detected.on('chainChanged', (chainId) => {
            if (!mounted) return
            setState((prev) => ({
              ...prev,
              chainId: Number.parseInt(chainId, 16),
            }))
          })
        )

        unsubscribesRef.current = unsubs

        // Check existing connection
        const accounts = await detected.getAccounts()
        if (!mounted) return

        if (accounts.length > 0) {
          const chainIdHex = await detected.getChainId()
          setState({
            isConnected: true,
            account: accounts[0],
            chainId: Number.parseInt(chainIdHex, 16),
            isConnecting: false,
          })
        } else if (autoConnect) {
          try {
            setState((prev) => ({ ...prev, isConnecting: true }))
            await detected.connect()
          } catch {
            // User rejected or error - silently ignore
          } finally {
            if (mounted) {
              setState((prev) => ({ ...prev, isConnecting: false }))
            }
          }
        }
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err : new Error('Failed to detect provider'))
      }
    }

    init()

    return () => {
      mounted = false
      for (const unsub of unsubscribesRef.current) {
        unsub()
      }
      unsubscribesRef.current = []
    }
  }, [autoConnect, timeout, networks])

  // Connect action
  const connect = useCallback(async (): Promise<Address[]> => {
    if (!provider) {
      throw new Error('Wallet not detected')
    }

    setError(null)
    setState((prev) => ({ ...prev, isConnecting: true }))

    try {
      const accounts = await provider.connect()
      const chainIdHex = await provider.getChainId()

      setState({
        isConnected: true,
        account: accounts[0] ?? null,
        chainId: Number.parseInt(chainIdHex, 16),
        isConnecting: false,
      })

      return accounts
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Connection failed'))
      setState((prev) => ({ ...prev, isConnecting: false }))
      throw err
    }
  }, [provider])

  // Disconnect action
  const disconnect = useCallback(async (): Promise<void> => {
    if (provider) {
      await provider.disconnect()
    }
    setState(initialState)
  }, [provider])

  // Switch network action
  const switchNetwork = useCallback(
    async (chainId: number): Promise<void> => {
      if (!provider) {
        throw new Error('Wallet not detected')
      }
      await provider.switchChain(chainId)
    },
    [provider]
  )

  const value: WalletContextValue = {
    isConnected: state.isConnected,
    account: state.account,
    chainId: state.chainId,
    isConnecting: state.isConnecting,
    error,
    connect,
    disconnect,
    switchNetwork,
    provider,
  }

  return createElement(WalletContext.Provider, { value }, children)
}

// ---------------------------------------------------------------------------
// Consumer Hook
// ---------------------------------------------------------------------------

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

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Address } from 'viem'
import { StableNetProvider } from '../provider/StableNetProvider'
import { detectProvider } from '../provider/detect'
import type { WalletState, WalletSDKConfig } from '../types'

const initialState: WalletState = {
  isConnected: false,
  account: null,
  chainId: null,
  isConnecting: false,
}

/**
 * React hook for wallet connection and state management
 *
 * @param config - SDK configuration
 * @returns Wallet state and actions
 */
export function useWallet(config: WalletSDKConfig = {}) {
  const [state, setState] = useState<WalletState>(initialState)
  const [error, setError] = useState<Error | null>(null)
  const providerRef = useRef<StableNetProvider | null>(null)

  // Initialize provider
  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const provider = await detectProvider(config)
        if (!mounted) return

        if (provider) {
          providerRef.current = provider

          // Setup event listeners
          provider.on('connect', (info) => {
            if (!mounted) return
            setState((prev) => ({
              ...prev,
              isConnected: true,
              chainId: Number.parseInt(info.chainId, 16),
            }))
          })

          provider.on('disconnect', () => {
            if (!mounted) return
            setState(initialState)
          })

          provider.on('accountsChanged', (accounts) => {
            if (!mounted) return
            setState((prev) => ({
              ...prev,
              isConnected: accounts.length > 0,
              account: accounts[0] ?? null,
            }))
          })

          provider.on('chainChanged', (chainId) => {
            if (!mounted) return
            setState((prev) => ({
              ...prev,
              chainId: Number.parseInt(chainId, 16),
            }))
          })

          // Check existing connection
          const accounts = await provider.getAccounts()
          if (accounts.length > 0) {
            const chainId = await provider.getChainId()
            setState({
              isConnected: true,
              account: accounts[0],
              chainId: Number.parseInt(chainId, 16),
              isConnecting: false,
            })
          }

          // Auto-connect if configured
          if (config.autoConnect && accounts.length === 0) {
            try {
              setState((prev) => ({ ...prev, isConnecting: true }))
              await provider.connect()
            } catch {
              // User rejected or error
            } finally {
              if (mounted) {
                setState((prev) => ({ ...prev, isConnecting: false }))
              }
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
    }
  }, [config.autoConnect, config.timeout])

  // Connect action
  const connect = useCallback(async (): Promise<Address[]> => {
    const provider = providerRef.current
    if (!provider) {
      throw new Error('Wallet not detected')
    }

    setError(null)
    setState((prev) => ({ ...prev, isConnecting: true }))

    try {
      const accounts = await provider.connect()
      const chainId = await provider.getChainId()

      setState({
        isConnected: true,
        account: accounts[0] ?? null,
        chainId: Number.parseInt(chainId, 16),
        isConnecting: false,
      })

      return accounts
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Connection failed'))
      setState((prev) => ({ ...prev, isConnecting: false }))
      throw err
    }
  }, [])

  // Disconnect action
  const disconnect = useCallback(async (): Promise<void> => {
    const provider = providerRef.current
    if (provider) {
      await provider.disconnect()
    }
    setState(initialState)
  }, [])

  // Switch network action
  const switchNetwork = useCallback(async (chainId: number): Promise<void> => {
    const provider = providerRef.current
    if (!provider) {
      throw new Error('Wallet not detected')
    }

    await provider.switchChain(chainId)
  }, [])

  return {
    // State
    isConnected: state.isConnected,
    account: state.account,
    chainId: state.chainId,
    isConnecting: state.isConnecting,
    error,

    // Actions
    connect,
    disconnect,
    switchNetwork,

    // Provider access
    provider: providerRef.current,
  }
}

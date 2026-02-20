import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { detectProvider } from '../provider/detect'
import type { StableNetProvider } from '../provider/StableNetProvider'
import type { WalletSDKConfig, WalletState } from '../types'

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
  const { autoConnect, timeout, networks } = config

  const [state, setState] = useState<WalletState>(initialState)
  const [error, setError] = useState<Error | null>(null)
  const providerRef = useRef<StableNetProvider | null>(null)
  const unsubscribesRef = useRef<Array<() => void>>([])

  // Stable serialization of networks for value-based comparison
  const networksKey = JSON.stringify(networks ?? null)
  const networksRef = useRef(networks)
  networksRef.current = networks

  // Initialize provider
  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const provider = await detectProvider({ autoConnect, timeout, networks: networksRef.current })
        if (!mounted) return

        if (provider) {
          providerRef.current = provider

          // Setup event listeners and track unsubscribe functions
          const unsubs: Array<() => void> = []

          unsubs.push(
            provider.on('connect', (info) => {
              if (!mounted) return
              setState((prev) => ({
                ...prev,
                isConnected: true,
                chainId: Number.parseInt(info.chainId, 16),
              }))
            })
          )

          unsubs.push(
            provider.on('disconnect', () => {
              if (!mounted) return
              setState(initialState)
            })
          )

          unsubs.push(
            provider.on('accountsChanged', (accounts) => {
              if (!mounted) return
              setState((prev) => ({
                ...prev,
                isConnected: accounts.length > 0,
                account: accounts[0] ?? null,
              }))
            })
          )

          unsubs.push(
            provider.on('chainChanged', (chainId) => {
              if (!mounted) return
              setState((prev) => ({
                ...prev,
                chainId: Number.parseInt(chainId, 16),
              }))
            })
          )

          unsubscribesRef.current = unsubs

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
          if (autoConnect && accounts.length === 0) {
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
      // Clean up all event listeners on unmount
      for (const unsub of unsubscribesRef.current) {
        unsub()
      }
      unsubscribesRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, timeout, networksKey])

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

'use client'

import {
  detectProvider,
  isWalletInstalled,
  type StableNetProvider,
  type TransactionConfirmedEvent,
  type TransactionSentEvent,
} from '@stablenet/wallet-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hash } from 'viem'

interface UseStableNetWalletResult {
  /** Whether StableNet wallet extension is installed */
  isInstalled: boolean
  /** Whether currently connected via StableNet wallet */
  isConnected: boolean
  /** Whether currently connecting */
  isConnecting: boolean
  /** Connected account address */
  account: Address | null
  /** Current chain ID (hex string) */
  chainId: string | null
  /** Current chain ID as number */
  chainIdNumber: number | null
  /** StableNetProvider instance (null if not detected) */
  provider: StableNetProvider | null
  /** Connect to StableNet wallet */
  connect: () => Promise<Address[]>
  /** Disconnect from StableNet wallet */
  disconnect: () => Promise<void>
  /** Sign a message */
  signMessage: (message: string) => Promise<string>
  /** Switch to a different chain */
  switchChain: (chainId: number) => Promise<void>
  /** Send a transaction via wallet */
  sendTransaction: (tx: TransactionRequest) => Promise<Hash>
  /** Subscribe to transaction sent events */
  onTransactionSent: (handler: (event: TransactionSentEvent) => void) => () => void
  /** Subscribe to transaction confirmed events */
  onTransactionConfirmed: (handler: (event: TransactionConfirmedEvent) => void) => () => void
}

interface TransactionRequest {
  to?: Address
  value?: bigint | string
  data?: `0x${string}`
  gas?: bigint | string
}

/**
 * Hook for direct integration with StableNet Wallet Extension
 *
 * This hook provides a direct interface to the StableNet wallet
 * without going through wagmi, useful for StableNet-specific features.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isInstalled, isConnected, connect, account } = useStableNetWallet()
 *
 *   if (!isInstalled) {
 *     return <p>Please install StableNet Wallet</p>
 *   }
 *
 *   if (!isConnected) {
 *     return <button onClick={connect}>Connect StableNet</button>
 *   }
 *
 *   return <p>Connected: {account}</p>
 * }
 * ```
 */
export function useStableNetWallet(): UseStableNetWalletResult {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [provider, setProvider] = useState<StableNetProvider | null>(null)
  const [account, setAccount] = useState<Address | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)

  // Detect wallet on mount
  useEffect(() => {
    const detect = async () => {
      // Check if installed
      const installed = isWalletInstalled()
      setIsInstalled(installed)

      if (!installed) return

      // Try to get provider
      try {
        const detected = await detectProvider({ timeout: 1000 })
        if (detected) {
          setProvider(detected)
          setAccount(detected.account)
          setChainId(detected.chainId)
        }
      } catch {
        // Provider not available yet, that's okay
      }
    }

    detect()
  }, [])

  // Subscribe to provider events using 'on' prefix methods
  useEffect(() => {
    if (!provider) return

    // Use the new 'on' prefix convenience methods
    const unsubConnect = provider.onConnect((info) => {
      setChainId(info.chainId)
    })

    const unsubDisconnect = provider.onDisconnect(() => {
      setAccount(null)
    })

    const unsubAccountsChanged = provider.onAccountChange((accounts) => {
      setAccount(accounts[0] ?? null)
    })

    const unsubChainChanged = provider.onNetworkChange((newChainId) => {
      setChainId(newChainId)
    })

    return () => {
      unsubConnect()
      unsubDisconnect()
      unsubAccountsChanged()
      unsubChainChanged()
    }
  }, [provider])

  const connect = useCallback(async (): Promise<Address[]> => {
    if (!provider) {
      throw new Error('StableNet wallet not detected')
    }

    setIsConnecting(true)
    try {
      const accounts = await provider.connect()
      setAccount(accounts[0] ?? null)
      setChainId(provider.chainId)
      return accounts
    } finally {
      setIsConnecting(false)
    }
  }, [provider])

  const disconnect = useCallback(async (): Promise<void> => {
    if (!provider) {
      throw new Error('StableNet wallet not detected')
    }

    await provider.disconnect()
    setAccount(null)
  }, [provider])

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!provider) {
        throw new Error('StableNet wallet not detected')
      }

      return provider.signMessage(message)
    },
    [provider]
  )

  const switchChain = useCallback(
    async (newChainId: number): Promise<void> => {
      if (!provider) {
        throw new Error('StableNet wallet not detected')
      }

      await provider.switchChain(newChainId)
    },
    [provider]
  )

  const sendTransaction = useCallback(
    async (tx: TransactionRequest): Promise<Hash> => {
      if (!provider) {
        throw new Error('StableNet wallet not detected')
      }

      return provider.sendTransaction(tx, { waitForConfirmation: true })
    },
    [provider]
  )

  // Store event handlers in refs to provide stable callbacks
  const txSentHandlersRef = useRef<Set<(event: TransactionSentEvent) => void>>(new Set())
  const txConfirmedHandlersRef = useRef<Set<(event: TransactionConfirmedEvent) => void>>(new Set())

  // Subscribe to transaction events from provider
  useEffect(() => {
    if (!provider) return

    const handleTxSent = (event: TransactionSentEvent) => {
      txSentHandlersRef.current.forEach((handler) => {
        handler(event)
      })
    }

    const handleTxConfirmed = (event: TransactionConfirmedEvent) => {
      txConfirmedHandlersRef.current.forEach((handler) => {
        handler(event)
      })
    }

    const unsubSent = provider.onTransactionSent(handleTxSent)
    const unsubConfirmed = provider.onTransactionConfirmed(handleTxConfirmed)

    return () => {
      unsubSent()
      unsubConfirmed()
    }
  }, [provider])

  const onTransactionSent = useCallback(
    (handler: (event: TransactionSentEvent) => void): (() => void) => {
      txSentHandlersRef.current.add(handler)
      return () => {
        txSentHandlersRef.current.delete(handler)
      }
    },
    []
  )

  const onTransactionConfirmed = useCallback(
    (handler: (event: TransactionConfirmedEvent) => void): (() => void) => {
      txConfirmedHandlersRef.current.add(handler)
      return () => {
        txConfirmedHandlersRef.current.delete(handler)
      }
    },
    []
  )

  const chainIdNumber = chainId ? Number.parseInt(chainId, 16) : null

  return {
    isInstalled,
    isConnected: !!account,
    isConnecting,
    account,
    chainId,
    chainIdNumber,
    provider,
    connect,
    disconnect,
    signMessage,
    switchChain,
    sendTransaction,
    onTransactionSent,
    onTransactionConfirmed,
  }
}

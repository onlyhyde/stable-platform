'use client'

import {
  isWalletInstalled,
  type StableNetProvider,
  type TransactionConfirmedEvent,
  type TransactionSentEvent,
} from '@stablenet/wallet-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hash } from 'viem'
import { useAccount } from 'wagmi'

interface UseStableNetWalletResult {
  /** Whether StableNet wallet extension is installed */
  isInstalled: boolean
  /** StableNetProvider instance from wagmi connector (null if not connected) */
  provider: StableNetProvider | null
  /** Sign a message via StableNet wallet */
  signMessage: (message: string) => Promise<string>
  /** Send a transaction via StableNet wallet */
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
 * Hook for StableNet-specific wallet features.
 *
 * Connection/disconnection is managed by wagmi (useWallet hook).
 * This hook provides StableNet-specific capabilities like
 * transaction lifecycle events and typed RPC methods.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isInstalled, provider, signMessage } = useStableNetWallet()
 *   const { isConnected, connect } = useWallet()
 *
 *   if (!isInstalled) return <p>Please install StableNet Wallet</p>
 *   if (!isConnected) return <button onClick={() => connect()}>Connect</button>
 *
 *   return <button onClick={() => signMessage('hello')}>Sign</button>
 * }
 * ```
 */
export function useStableNetWallet(): UseStableNetWalletResult {
  const { connector } = useAccount()
  const [provider, setProvider] = useState<StableNetProvider | null>(null)

  // Get provider from wagmi connector (shared instance)
  useEffect(() => {
    if (!connector) {
      setProvider(null)
      return
    }

    connector
      .getProvider()
      .then((p) => {
        if (p) setProvider(p as unknown as StableNetProvider)
      })
      .catch(() => {
        setProvider(null)
      })
  }, [connector])

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!provider) throw new Error('StableNet wallet not available')
      return provider.signMessage(message)
    },
    [provider]
  )

  const sendTransaction = useCallback(
    async (tx: TransactionRequest): Promise<Hash> => {
      if (!provider) throw new Error('StableNet wallet not available')
      return provider.sendTransaction(tx, { waitForConfirmation: true })
    },
    [provider]
  )

  // Transaction event handling via stable refs
  const txSentHandlersRef = useRef<Set<(event: TransactionSentEvent) => void>>(new Set())
  const txConfirmedHandlersRef = useRef<Set<(event: TransactionConfirmedEvent) => void>>(new Set())

  useEffect(() => {
    if (!provider?.onTransactionSent) return

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

  return {
    isInstalled: isWalletInstalled(),
    provider,
    signMessage,
    sendTransaction,
    onTransactionSent,
    onTransactionConfirmed,
  }
}

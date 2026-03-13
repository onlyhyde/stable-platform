'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi'

const STABLENET_CONNECTOR_ID = 'stableNetWallet'

export function useWallet() {
  const { address, isConnected, isConnecting, connector } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending: isConnectPending } = useConnect()
  const { disconnect, isPending: isDisconnectPending } = useDisconnect()
  const { switchChain, isPending: isSwitchPending } = useSwitchChain()
  const queryClient = useQueryClient()

  // Invalidate all queries on account/chain change so data hooks refetch.
  // The wagmi connector bridges EIP-1193 events to wagmi state automatically,
  // but react-query caches (balances, tokens, etc.) need manual invalidation.
  useEffect(() => {
    if (!connector) return

    let cancelled = false
    let removeListeners: (() => void) | undefined

    const setupListeners = async () => {
      const resolved = (await connector.getProvider?.()) as
        | {
            on?: (e: string, fn: () => void) => void
            removeListener?: (e: string, fn: () => void) => void
          }
        | undefined

      if (cancelled || !resolved?.on) return

      const invalidate = () => {
        queryClient.invalidateQueries({ type: 'active' })
      }

      resolved.on('accountsChanged', invalidate)
      resolved.on('chainChanged', invalidate)

      removeListeners = () => {
        resolved.removeListener?.('accountsChanged', invalidate)
        resolved.removeListener?.('chainChanged', invalidate)
      }
    }

    setupListeners()

    return () => {
      cancelled = true
      removeListeners?.()
    }
  }, [connector, queryClient])

  const connectWallet = useCallback(
    (connectorId?: string) => {
      // Prefer StableNet connector, fall back to specified or first available
      const id = connectorId ?? STABLENET_CONNECTOR_ID
      const connector =
        connectors.find((c) => c.id === id) ??
        connectors.find((c) => c.id === STABLENET_CONNECTOR_ID) ??
        connectors[0]

      if (connector) {
        connect({ connector })
      }
    },
    [connect, connectors]
  )

  const disconnectWallet = useCallback(() => {
    disconnect()
  }, [disconnect])

  const changeNetwork = useCallback(
    (newChainId: number) => {
      switchChain({ chainId: newChainId })
    },
    [switchChain]
  )

  return {
    address,
    chainId,
    isConnected,
    isConnecting: isConnecting || isConnectPending,
    isDisconnecting: isDisconnectPending,
    isSwitchingNetwork: isSwitchPending,
    connectors,
    connect: connectWallet,
    disconnect: disconnectWallet,
    switchNetwork: changeNetwork,
  }
}

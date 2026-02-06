'use client'

import { useQueryClient } from '@tanstack/react-query'
import { detectProvider, type StableNetProvider } from '@stablenet/wallet-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi'

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending: isConnectPending } = useConnect()
  const { disconnect, isPending: isDisconnectPending } = useDisconnect()
  const { switchChain, isPending: isSwitchPending } = useSwitchChain()
  const queryClient = useQueryClient()

  // StableNet provider for event listening
  const [stableNetProvider, setStableNetProvider] = useState<StableNetProvider | null>(null)

  // Track previous values for change detection
  const prevChainId = useRef(chainId)
  const prevAddress = useRef(address)

  // Debug: Log available connectors
  useEffect(() => {}, [connectors])

  // Detect StableNet provider on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    detectProvider({ timeout: 2000 })
      .then((provider) => {
        if (provider) {
          setStableNetProvider(provider)
        }
      })
      .catch(() => {
        // Provider not available, that's okay
      })
  }, [])

  // Listen for chain and account changes via wallet-sdk
  useEffect(() => {
    if (!stableNetProvider) return

    // Use wallet-sdk's 'on' prefix methods for event subscription
    const unsubNetworkChange = stableNetProvider.onNetworkChange(() => {
      // Invalidate all queries when chain changes
      queryClient.invalidateQueries()
    })

    const unsubAccountChange = stableNetProvider.onAccountChange(() => {
      // Invalidate all queries when account changes
      queryClient.invalidateQueries()
    })

    return () => {
      unsubNetworkChange()
      unsubAccountChange()
    }
  }, [stableNetProvider, queryClient])

  // Invalidate queries when chainId or address changes via wagmi state
  useEffect(() => {
    if (prevChainId.current !== chainId) {
      prevChainId.current = chainId
      queryClient.invalidateQueries()
    }
  }, [chainId, queryClient])

  useEffect(() => {
    if (prevAddress.current !== address) {
      prevAddress.current = address
      queryClient.invalidateQueries()
    }
  }, [address, queryClient])

  const connectWallet = useCallback(
    (connectorId?: string) => {
      const connector = connectorId ? connectors.find((c) => c.id === connectorId) : connectors[0]

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

'use client'

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending: isConnectPending } = useConnect()
  const { disconnect, isPending: isDisconnectPending } = useDisconnect()
  const { switchChain, isPending: isSwitchPending } = useSwitchChain()
  const queryClient = useQueryClient()

  // Track previous values for change detection
  const prevChainId = useRef(chainId)
  const prevAddress = useRef(address)

  // Debug: Log available connectors
  useEffect(() => {
    console.log('[useWallet] Available connectors:', connectors.map(c => ({ id: c.id, name: c.name })))
  }, [connectors])

  // Listen for chain and account changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const provider = (window as unknown as { ethereum?: { on?: Function; removeListener?: Function } }).ethereum
    if (!provider?.on || !provider?.removeListener) return

    const handleChainChanged = (newChainId: string) => {
      console.log('[useWallet] Chain changed:', newChainId)
      // Invalidate all queries when chain changes
      queryClient.invalidateQueries()
    }

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('[useWallet] Accounts changed:', accounts)
      // Invalidate all queries when account changes
      queryClient.invalidateQueries()
    }

    provider.on('chainChanged', handleChainChanged)
    provider.on('accountsChanged', handleAccountsChanged)

    return () => {
      provider.removeListener?.('chainChanged', handleChainChanged)
      provider.removeListener?.('accountsChanged', handleAccountsChanged)
    }
  }, [queryClient])

  // Invalidate queries when chainId or address changes via wagmi state
  useEffect(() => {
    if (prevChainId.current !== chainId) {
      console.log('[useWallet] Chain ID updated:', prevChainId.current, '->', chainId)
      prevChainId.current = chainId
      queryClient.invalidateQueries()
    }
  }, [chainId, queryClient])

  useEffect(() => {
    if (prevAddress.current !== address) {
      console.log('[useWallet] Address updated:', prevAddress.current, '->', address)
      prevAddress.current = address
      queryClient.invalidateQueries()
    }
  }, [address, queryClient])

  const connectWallet = useCallback((connectorId?: string) => {
    const connector = connectorId
      ? connectors.find((c) => c.id === connectorId)
      : connectors[0]

    if (connector) {
      connect({ connector })
    }
  }, [connect, connectors])

  const disconnectWallet = useCallback(() => {
    disconnect()
  }, [disconnect])

  const changeNetwork = useCallback((newChainId: number) => {
    switchChain({ chainId: newChainId })
  }, [switchChain])

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

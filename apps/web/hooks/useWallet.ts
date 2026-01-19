'use client'

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { useCallback } from 'react'

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending: isConnectPending } = useConnect()
  const { disconnect, isPending: isDisconnectPending } = useDisconnect()
  const { switchChain, isPending: isSwitchPending } = useSwitchChain()

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

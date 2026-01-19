'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { createPublicClient, http, type PublicClient } from 'viem'
import { CONTRACT_ADDRESSES, SERVICE_URLS } from '@/lib/constants'
import { stablenetDevnet } from '@/lib/chains'

interface StableNetContextValue {
  publicClient: PublicClient
  bundlerUrl: string
  paymasterUrl: string
  stealthServerUrl: string
  entryPoint: `0x${string}`
  accountFactory: `0x${string}`
  paymaster: `0x${string}`
  stealthAnnouncer: `0x${string}`
  stealthRegistry: `0x${string}`
  isReady: boolean
}

const StableNetContext = createContext<StableNetContextValue | null>(null)

interface StableNetProviderProps {
  children: ReactNode
}

export function StableNetProvider({ children }: StableNetProviderProps) {
  const chainId = useChainId()
  const { isConnected } = useAccount()

  const value = useMemo<StableNetContextValue>(() => {
    const currentChainId = chainId || stablenetDevnet.id
    const contracts = CONTRACT_ADDRESSES[currentChainId] || CONTRACT_ADDRESSES[31337]
    const services = SERVICE_URLS[currentChainId] || SERVICE_URLS[31337]

    const publicClient = createPublicClient({
      chain: stablenetDevnet,
      transport: http(),
    })

    return {
      publicClient,
      bundlerUrl: services.bundler,
      paymasterUrl: services.paymaster,
      stealthServerUrl: services.stealthServer,
      entryPoint: contracts.entryPoint,
      accountFactory: contracts.accountFactory,
      paymaster: contracts.paymaster,
      stealthAnnouncer: contracts.stealthAnnouncer,
      stealthRegistry: contracts.stealthRegistry,
      isReady: isConnected,
    }
  }, [chainId, isConnected])

  return (
    <StableNetContext.Provider value={value}>
      {children}
    </StableNetContext.Provider>
  )
}

export function useStableNetContext(): StableNetContextValue {
  const context = useContext(StableNetContext)
  if (!context) {
    throw new Error('useStableNetContext must be used within StableNetProvider')
  }
  return context
}

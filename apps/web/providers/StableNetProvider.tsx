'use client'

import { getConfigByChainId, getStablenetLocal } from '@/lib/chains'
import { getContractAddresses, getServiceUrls } from '@/lib/constants'
import { type ReactNode, createContext, useContext, useMemo } from 'react'
import { http, type PublicClient, createPublicClient } from 'viem'
import { useAccount, useChainId } from 'wagmi'

interface StableNetContextValue {
  publicClient: PublicClient
  chainId: number
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

  // Default to StableNet Local (8283) if no chain connected
  const currentChainId = chainId || 8283

  // Memoize publicClient separately so it is not recreated when isConnected toggles
  const publicClient = useMemo(() => {
    const networkConfig = getConfigByChainId(currentChainId)
    const chain = getStablenetLocal()
    return createPublicClient({
      chain,
      transport: http(networkConfig?.rpcUrl),
    })
  }, [currentChainId])

  const value = useMemo<StableNetContextValue>(() => {
    const contracts = getContractAddresses(currentChainId)
    const services = getServiceUrls(currentChainId)

    const defaultContracts = getContractAddresses(8283)!
    const defaultServices = getServiceUrls(8283)!

    return {
      publicClient,
      chainId: currentChainId,
      bundlerUrl: services?.bundler ?? defaultServices.bundler,
      paymasterUrl: services?.paymaster ?? defaultServices.paymaster,
      stealthServerUrl: services?.stealthServer ?? defaultServices.stealthServer,
      entryPoint: contracts?.entryPoint ?? defaultContracts.entryPoint,
      accountFactory: contracts?.accountFactory ?? defaultContracts.accountFactory,
      paymaster: contracts?.paymaster ?? defaultContracts.paymaster,
      stealthAnnouncer: contracts?.stealthAnnouncer ?? defaultContracts.stealthAnnouncer,
      stealthRegistry: contracts?.stealthRegistry ?? defaultContracts.stealthRegistry,
      isReady: isConnected,
    }
  }, [currentChainId, isConnected, publicClient])

  return <StableNetContext.Provider value={value}>{children}</StableNetContext.Provider>
}

export function useStableNetContext(): StableNetContextValue {
  const context = useContext(StableNetContext)
  if (!context) {
    throw new Error('useStableNetContext must be used within StableNetProvider')
  }
  return context
}

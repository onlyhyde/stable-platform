'use client'

import { useBalance as useWagmiBalance, useChainId } from 'wagmi'
import type { Address } from 'viem'

interface UseBalanceOptions {
  address?: Address
  token?: Address
  chainId?: number
  watch?: boolean
}

/**
 * Hook to get balance for an address
 * Automatically updates when chain changes via wallet events
 */
export function useBalance(options: UseBalanceOptions = {}) {
  const { address, token, watch = false } = options
  // Use current chain from wagmi context if not explicitly provided
  const currentChainId = useChainId()
  const chainId = options.chainId ?? currentChainId

  const { data, isLoading, isError, refetch } = useWagmiBalance({
    address,
    token,
    chainId,
    query: {
      enabled: !!address,
      refetchInterval: watch ? 10000 : false,
      // Refetch when chain changes
      refetchOnMount: true,
    },
  })

  return {
    balance: data?.value ?? BigInt(0),
    symbol: data?.symbol ?? 'ETH',
    decimals: data?.decimals ?? 18,
    formatted: data?.formatted ?? '0',
    chainId,
    isLoading,
    isError,
    refetch,
  }
}

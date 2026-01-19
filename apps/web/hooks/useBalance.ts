'use client'

import { useBalance as useWagmiBalance } from 'wagmi'
import type { Address } from 'viem'

interface UseBalanceOptions {
  address?: Address
  token?: Address
  chainId?: number
  watch?: boolean
}

export function useBalance(options: UseBalanceOptions = {}) {
  const { address, token, chainId, watch = false } = options

  const { data, isLoading, isError, refetch } = useWagmiBalance({
    address,
    token,
    chainId,
    query: {
      enabled: !!address,
      refetchInterval: watch ? 10000 : false,
    },
  })

  return {
    balance: data?.value ?? BigInt(0),
    symbol: data?.symbol ?? 'ETH',
    decimals: data?.decimals ?? 18,
    formatted: data?.formatted ?? '0',
    isLoading,
    isError,
    refetch,
  }
}

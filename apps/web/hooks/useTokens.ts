'use client'

import { getDefaultTokens } from '@stablenet/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { useWallet } from '@/hooks/useWallet'
import { useStableNetContext } from '@/providers/StableNetProvider'
import type { Token } from '@/types'

interface UseTokensConfig {
  fetchTokens?: () => Promise<Token[]>
  autoFetch?: boolean
}

interface UseTokensReturn {
  tokens: Token[]
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useTokens(config: UseTokensConfig = {}): UseTokensReturn {
  const { fetchTokens: externalFetch, autoFetch = true } = config
  const { publicClient, chainId } = useStableNetContext()
  const { address } = useWallet()
  const [tokens, setTokens] = useState<Token[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const fetchIdRef = useRef(0)

  const refresh = useCallback(async () => {
    // Use external fetch if provided (DI override)
    if (externalFetch) {
      const id = ++fetchIdRef.current
      setIsLoading(true)
      setError(null)
      try {
        const result = await externalFetch()
        if (id !== fetchIdRef.current) return
        setTokens(result)
      } catch (err) {
        if (id !== fetchIdRef.current) return
        const fetchError = err instanceof Error ? err : new Error('Failed to fetch tokens')
        setError(fetchError)
        setTokens([])
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false)
        }
      }
      return
    }

    // No address — skip fetch
    if (!address) {
      setIsLoading(false)
      return
    }

    // On-chain: read balanceOf for known ERC-20 tokens
    const id = ++fetchIdRef.current
    setIsLoading(true)
    setError(null)
    try {
      const knownTokens = getDefaultTokens(chainId).filter(
        (t) => t.address !== '0x0000000000000000000000000000000000000000'
      )

      const balanceResults = await Promise.allSettled(
        knownTokens.map((token) =>
          publicClient.readContract({
            address: token.address as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address as Address],
          })
        )
      )

      if (id !== fetchIdRef.current) return

      const mapped: Token[] = knownTokens.map((token, i) => {
        const result = balanceResults[i]
        const balance = result.status === 'fulfilled' ? result.value : 0n
        return {
          address: token.address as Address,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          balance,
        }
      })

      setTokens(mapped)
    } catch (err) {
      if (id !== fetchIdRef.current) return
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch tokens')
      setError(fetchError)
      setTokens([])
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [externalFetch, address, publicClient, chainId])

  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  return {
    tokens,
    isLoading,
    error,
    refresh,
  }
}

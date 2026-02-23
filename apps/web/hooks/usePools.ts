'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Address } from 'viem'
import { useWallet } from '@/hooks/useWallet'
import { getServiceUrls } from '@/lib/constants'
import { useStableNetContext } from '@/providers'
import type { LiquidityPosition, Pool } from '@/types'

interface UsePoolsReturn {
  pools: Pool[]
  positions: LiquidityPosition[]
  isLoading: boolean
  isLoadingPositions: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function usePools(): UsePoolsReturn {
  const { chainId } = useStableNetContext()
  const { address } = useWallet()
  const serviceUrls = useMemo(() => getServiceUrls(chainId), [chainId])
  const orderRouterUrl = serviceUrls?.orderRouter

  const [pools, setPools] = useState<Pool[]>([])
  const [positions, setPositions] = useState<LiquidityPosition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingPositions, setIsLoadingPositions] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const poolFetchIdRef = useRef(0)
  const positionFetchIdRef = useRef(0)

  const fetchPools = useCallback(async () => {
    if (!orderRouterUrl) {
      setIsLoading(false)
      return
    }

    const id = ++poolFetchIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(`${orderRouterUrl}/pools`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`Failed to fetch pools: ${response.status}`)
      }

      const data = await response.json()

      if (id !== poolFetchIdRef.current) return

      const mapped: Pool[] = (data.pools ?? data ?? []).map((p: Record<string, unknown>) => ({
        address: p.address as Address,
        token0: {
          address: (p.token0Address ?? (p.token0 as Record<string, unknown>)?.address ?? '') as Address,
          name: (p.token0Name ?? (p.token0 as Record<string, unknown>)?.name ?? 'Token0') as string,
          symbol: (p.token0Symbol ?? (p.token0 as Record<string, unknown>)?.symbol ?? '???') as string,
          decimals: Number(p.token0Decimals ?? (p.token0 as Record<string, unknown>)?.decimals ?? 18),
        },
        token1: {
          address: (p.token1Address ?? (p.token1 as Record<string, unknown>)?.address ?? '') as Address,
          name: (p.token1Name ?? (p.token1 as Record<string, unknown>)?.name ?? 'Token1') as string,
          symbol: (p.token1Symbol ?? (p.token1 as Record<string, unknown>)?.symbol ?? '???') as string,
          decimals: Number(p.token1Decimals ?? (p.token1 as Record<string, unknown>)?.decimals ?? 18),
        },
        reserve0: BigInt(p.reserve0?.toString() ?? '0'),
        reserve1: BigInt(p.reserve1?.toString() ?? '0'),
        fee: Number(p.fee ?? 0.3),
        tvl: Number(p.tvl ?? 0),
        apr: Number(p.apr ?? 0),
      }))

      setPools(mapped)
    } catch (err) {
      if (id !== poolFetchIdRef.current) return
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError(new Error('Request timed out fetching pools'))
      } else {
        setError(err instanceof Error ? err : new Error('Failed to fetch pools'))
      }
      setPools([])
    } finally {
      if (id === poolFetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [orderRouterUrl])

  const fetchPositions = useCallback(async () => {
    if (!orderRouterUrl || !address) {
      setPositions([])
      return
    }

    const id = ++positionFetchIdRef.current
    setIsLoadingPositions(true)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(`${orderRouterUrl}/positions/${address}`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) {
        if (response.status === 404) {
          if (id !== positionFetchIdRef.current) return
          setPositions([])
          return
        }
        throw new Error(`Failed to fetch positions: ${response.status}`)
      }

      const data = await response.json()

      if (id !== positionFetchIdRef.current) return

      const mapped: LiquidityPosition[] = (data.positions ?? data ?? []).map(
        (p: Record<string, unknown>) => ({
          poolAddress: p.poolAddress as Address,
          token0: {
            address: (p.token0Address ?? (p.token0 as Record<string, unknown>)?.address ?? '') as Address,
            name: (p.token0Name ?? (p.token0 as Record<string, unknown>)?.name ?? 'Token0') as string,
            symbol: (p.token0Symbol ?? (p.token0 as Record<string, unknown>)?.symbol ?? '???') as string,
            decimals: Number(
              p.token0Decimals ?? (p.token0 as Record<string, unknown>)?.decimals ?? 18
            ),
          },
          token1: {
            address: (p.token1Address ?? (p.token1 as Record<string, unknown>)?.address ?? '') as Address,
            name: (p.token1Name ?? (p.token1 as Record<string, unknown>)?.name ?? 'Token1') as string,
            symbol: (p.token1Symbol ?? (p.token1 as Record<string, unknown>)?.symbol ?? '???') as string,
            decimals: Number(
              p.token1Decimals ?? (p.token1 as Record<string, unknown>)?.decimals ?? 18
            ),
          },
          liquidity: BigInt(p.liquidity?.toString() ?? '0'),
          token0Amount: BigInt(p.token0Amount?.toString() ?? '0'),
          token1Amount: BigInt(p.token1Amount?.toString() ?? '0'),
          shareOfPool: Number(p.shareOfPool ?? 0),
        })
      )

      setPositions(mapped)
    } catch (err) {
      if (id !== positionFetchIdRef.current) return
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.error('Failed to fetch positions:', err)
      }
      setPositions([])
    } finally {
      if (id === positionFetchIdRef.current) {
        setIsLoadingPositions(false)
      }
    }
  }, [orderRouterUrl, address])

  const refresh = useCallback(async () => {
    await Promise.all([fetchPools(), fetchPositions()])
  }, [fetchPools, fetchPositions])

  useEffect(() => {
    fetchPools()
  }, [fetchPools])

  useEffect(() => {
    fetchPositions()
  }, [fetchPositions])

  return {
    pools,
    positions,
    isLoading,
    isLoadingPositions,
    error,
    refresh,
  }
}

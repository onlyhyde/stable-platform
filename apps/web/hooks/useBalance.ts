'use client'

import { getNativeCurrencySymbol } from '@stablenet/wallet-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { erc20Abi, formatUnits } from 'viem'
import { useAccount, useChainId, usePublicClient } from 'wagmi'

interface UseBalanceOptions {
  address?: Address
  token?: Address
  chainId?: number
  watch?: boolean
}

interface BalanceResult {
  balance: bigint
  symbol: string
  decimals: number
  formatted: string
  chainId: number | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => Promise<void>
}

/**
 * Hook to get balance for an address.
 *
 * Uses wagmi's publicClient for on-chain reads (readContract / getBalance).
 * Falls back to raw provider RPC when publicClient is unavailable.
 */
export function useBalance(options: UseBalanceOptions = {}): BalanceResult {
  const { address, token, watch = false } = options
  const { connector } = useAccount()
  const wagmiChainId = useChainId()
  const publicClient = usePublicClient()

  const [balance, setBalance] = useState<bigint>(BigInt(0))
  const [symbol, setSymbol] = useState<string>('ETH')
  const [decimals, setDecimals] = useState<number>(18)
  const [chainId, setChainId] = useState<number | undefined>(wagmiChainId)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const fetchIdRef = useRef(0)

  const fetchBalance = useCallback(async () => {
    if (!address) return

    const id = ++fetchIdRef.current
    setIsLoading(true)
    setIsError(false)

    try {
      if (publicClient) {
        // Preferred path: use viem publicClient (type-safe, ABI-decoded)
        const currentChainId = await publicClient.getChainId()
        if (id !== fetchIdRef.current) return
        setChainId(currentChainId)

        if (token) {
          // ERC-20: read balance, symbol, decimals in parallel via readContract
          const [rawBalance, tokenSymbol, tokenDecimals] = await Promise.all([
            publicClient.readContract({
              address: token,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address],
            }),
            publicClient.readContract({
              address: token,
              abi: erc20Abi,
              functionName: 'symbol',
            }).catch(() => 'TOKEN'),
            publicClient.readContract({
              address: token,
              abi: erc20Abi,
              functionName: 'decimals',
            }).catch(() => 18),
          ])

          if (id !== fetchIdRef.current) return

          setBalance(rawBalance)
          setSymbol(tokenSymbol as string)
          setDecimals(tokenDecimals as number)
        } else {
          // Native balance
          const rawBalance = await publicClient.getBalance({ address })
          if (id !== fetchIdRef.current) return

          setBalance(rawBalance)
          setSymbol(getNativeCurrencySymbol(currentChainId))
          setDecimals(18)
        }
      } else {
        // Fallback: use raw provider RPC
        const provider = await resolveProvider(connector)
        if (!provider) throw new Error('No provider available')

        const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string
        const currentChainId = Number.parseInt(chainIdHex, 16)
        if (id !== fetchIdRef.current) return
        setChainId(currentChainId)

        if (token) {
          const balanceHex = (await provider.request({
            method: 'eth_call',
            params: [
              { to: token, data: `0x70a08231000000000000000000000000${address.slice(2)}` },
              'latest',
            ],
          })) as string

          if (id !== fetchIdRef.current) return
          setBalance(BigInt(balanceHex || '0'))
        } else {
          const balanceHex = (await provider.request({
            method: 'eth_getBalance',
            params: [address, 'latest'],
          })) as string

          if (id !== fetchIdRef.current) return
          setBalance(BigInt(balanceHex || '0'))
          setSymbol(getNativeCurrencySymbol(currentChainId))
          setDecimals(18)
        }
      }
    } catch (err) {
      if (id !== fetchIdRef.current) return
      setIsError(true)
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [address, token, connector, publicClient, wagmiChainId])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Watch for changes via polling
  useEffect(() => {
    if (!watch || !address) return

    const interval = setInterval(fetchBalance, 10000)
    return () => clearInterval(interval)
  }, [watch, address, fetchBalance])

  // Listen for chain changes from wallet provider to trigger refetch
  useEffect(() => {
    if (typeof window === 'undefined') return

    type EventProvider = {
      on?: (event: string, fn: () => void) => void
      removeListener?: (event: string, fn: () => void) => void
    }

    const win = window as {
      stablenet?: { isStableNet?: boolean } & EventProvider
      ethereum?: EventProvider
    }

    const provider: EventProvider | undefined =
      win.stablenet?.isStableNet ? win.stablenet : win.ethereum
    if (!provider?.on) return

    const handleChainChanged = () => {
      fetchBalance()
    }

    provider.on('chainChanged', handleChainChanged)
    return () => {
      provider.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [fetchBalance])

  const formatted = formatUnits(balance, decimals)

  return {
    balance,
    symbol,
    decimals,
    formatted,
    chainId,
    isLoading,
    isError,
    refetch: fetchBalance,
  }
}

/**
 * Resolve an RPC provider from wagmi connector or window globals.
 * Prefers window.stablenet over window.ethereum.
 */
async function resolveProvider(
  connector?: { getProvider?: () => Promise<unknown> }
): Promise<{ request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null> {
  if (connector?.getProvider) {
    const p = (await connector.getProvider()) as { request?: (...args: unknown[]) => unknown }
    if (p?.request) return p as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
  }

  if (typeof window === 'undefined') return null

  const win = window as {
    stablenet?: { isStableNet?: boolean; request?: (...args: unknown[]) => unknown }
    ethereum?: { request?: (...args: unknown[]) => unknown }
  }

  if (win.stablenet?.isStableNet && win.stablenet.request) {
    return win.stablenet as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
  }
  if (win.ethereum?.request) {
    return win.ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
  }

  return null
}

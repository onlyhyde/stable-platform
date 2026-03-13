'use client'

import { getDefaultTokens } from '@stablenet/contracts'
import { formatTokenBalance } from '@stablenet/core'
import { getNativeCurrencySymbol } from '@stablenet/wallet-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { erc20Abi, formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { useStableNetContext } from '@/providers/StableNetProvider'

/**
 * Token asset from wallet
 */
export interface WalletToken {
  address: Address
  symbol: string
  name: string
  decimals: number
  balance: string
  formattedBalance: string
  logoURI?: string
  isVisible?: boolean
}

/**
 * Native asset from wallet
 */
export interface NativeAsset {
  symbol: string
  name: string
  decimals: number
  balance: string
  formattedBalance: string
}

/**
 * Assets response from wallet_getAssets RPC
 */
export interface WalletAssetsResponse {
  chainId: number
  account: Address
  native: NativeAsset
  tokens: WalletToken[]
}

/**
 * Add token parameters
 */
export interface AddTokenParams {
  address: Address
  symbol?: string
  name?: string
  decimals?: number
  logoURI?: string
}

/**
 * Add token result
 */
export interface AddTokenResult {
  success: boolean
  token?: WalletToken
  error?: string
}

/**
 * useWalletAssets hook result
 */
export interface UseWalletAssetsResult {
  /** Whether StableNet wallet assets API is supported */
  isSupported: boolean
  /** Native asset (ETH/MATIC/etc) */
  native: NativeAsset | null
  /** ERC-20 token list */
  tokens: WalletToken[]
  /** All assets combined */
  assets: WalletAssetsResponse | null
  /** Loading state */
  isLoading: boolean
  /** Error state */
  isError: boolean
  /** Error message */
  error: string | null
  /** Refresh assets */
  refetch: () => Promise<void>
  /** Add a custom token */
  addToken: (params: AddTokenParams) => Promise<AddTokenResult>
}

type RpcProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

/**
 * Get wallet provider — checks window.stablenet first (StableNet wallet),
 * then falls back to window.ethereum for other wallets.
 */
function getProvider(): RpcProvider | null {
  if (typeof window === 'undefined') return null

  const win = window as {
    stablenet?: { isStableNet?: boolean; request?: (...args: unknown[]) => unknown }
    ethereum?: { isStableNet?: boolean; request?: (...args: unknown[]) => unknown }
  }

  // Prefer StableNet wallet provider
  if (win.stablenet?.isStableNet && win.stablenet.request) {
    return win.stablenet as RpcProvider
  }
  // Check if window.ethereum is StableNet
  if (win.ethereum?.isStableNet && win.ethereum.request) {
    return win.ethereum as RpcProvider
  }
  // Fallback to generic ethereum provider
  if (win.ethereum?.request) {
    return win.ethereum as RpcProvider
  }

  return null
}

export function useWalletAssets(): UseWalletAssetsResult {
  const { address, isConnected } = useAccount()
  const { publicClient } = useStableNetContext()

  const [isSupported, setIsSupported] = useState(false)
  const [assets, setAssets] = useState<WalletAssetsResponse | null>(null)
  // Start true when we expect data to load — prevents "0 ETH" flash
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Monotonically increasing fetch ID to discard stale responses
  const fetchIdRef = useRef(0)

  /**
   * Fetch ERC-20 balances directly on-chain using known token list.
   * No indexer dependency — reads balanceOf() for each token via publicClient.
   */
  const fetchOnChainTokenBalances = useCallback(
    async (targetAddress: Address, currentChainId: number): Promise<WalletToken[]> => {
      const knownTokens = getDefaultTokens(currentChainId)
      // Filter out native (zero address) tokens
      const erc20Tokens = knownTokens.filter(
        (t) => t.address !== '0x0000000000000000000000000000000000000000'
      )

      if (erc20Tokens.length === 0) return []

      // Read balanceOf for all known ERC-20 tokens in parallel
      const balanceResults = await Promise.allSettled(
        erc20Tokens.map((token) =>
          publicClient.readContract({
            address: token.address as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [targetAddress],
          })
        )
      )

      const tokens: WalletToken[] = []
      for (let i = 0; i < erc20Tokens.length; i++) {
        const result = balanceResults[i]
        if (result.status !== 'fulfilled') continue

        const rawBalance = result.value
        const balanceStr = rawBalance.toString()

        tokens.push({
          address: erc20Tokens[i].address as Address,
          symbol: erc20Tokens[i].symbol,
          name: erc20Tokens[i].name,
          decimals: erc20Tokens[i].decimals,
          balance: balanceStr,
          formattedBalance: formatTokenBalance(balanceStr, erc20Tokens[i].decimals),
          logoURI: erc20Tokens[i].logoUrl,
        })
      }

      return tokens
    },
    [publicClient]
  )

  /**
   * Merge on-chain token balances with wallet-provided tokens.
   * Wallet may only return "tracked" tokens — known tokens from getDefaultTokens()
   * are always fetched on-chain and merged so no balances are missed.
   */
  const mergeOnChainTokens = useCallback(
    async (
      targetAddress: Address,
      currentChainId: number,
      walletTokens: WalletToken[]
    ): Promise<WalletToken[]> => {
      const onChainTokens = await fetchOnChainTokenBalances(targetAddress, currentChainId)
      const _walletAddrs = new Set(walletTokens.map((t) => t.address.toLowerCase()))

      // Start with on-chain data for known tokens (authoritative balances)
      const merged = new Map<string, WalletToken>()
      for (const t of onChainTokens) {
        merged.set(t.address.toLowerCase(), t)
      }
      // Overlay wallet-tracked tokens (may include custom tokens not in known list)
      for (const t of walletTokens) {
        const key = t.address.toLowerCase()
        if (merged.has(key)) {
          // On-chain balance is authoritative; keep wallet metadata if richer
          const onChain = merged.get(key)!
          merged.set(key, {
            ...t,
            balance: onChain.balance,
            formattedBalance: onChain.formattedBalance,
          })
        } else {
          merged.set(key, t)
        }
      }

      return [...merged.values()]
    },
    [fetchOnChainTokenBalances]
  )

  /**
   * Core fetch — tries wallet_getAssets first, falls back to eth_getBalance + on-chain balanceOf.
   * Always supplements with on-chain balanceOf for known tokens from getDefaultTokens().
   */
  const doFetch = useCallback(
    async (
      targetAddress: Address
    ): Promise<{ result: WalletAssetsResponse | null; supported: boolean }> => {
      const provider = getProvider()
      if (!provider) return { result: null, supported: false }

      // Try wallet_getAssets (StableNet wallet)
      try {
        const walletResult = (await provider.request({
          method: 'wallet_getAssets',
          params: [],
        })) as WalletAssetsResponse

        // Always merge with on-chain balances for known tokens
        const mergedTokens = await mergeOnChainTokens(
          targetAddress,
          walletResult.chainId,
          walletResult.tokens
        )

        return {
          result: { ...walletResult, tokens: mergedTokens },
          supported: true,
        }
      } catch (err) {
        const error = err as { code?: number; message?: string }
        const isUnsupported =
          error.code === 4200 || error.code === -32601 || error.message?.includes('not supported')

        // Fallback: eth_getBalance (native) + on-chain balanceOf (ERC-20)
        try {
          const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string
          const currentChainId = Number.parseInt(chainIdHex, 16)

          // Fetch native balance and ERC-20 token balances in parallel
          const [balanceHex, tokens] = await Promise.all([
            provider.request({
              method: 'eth_getBalance',
              params: [targetAddress, 'latest'],
            }) as Promise<string>,
            fetchOnChainTokenBalances(targetAddress, currentChainId),
          ])

          const balance = BigInt(balanceHex || '0')
          const symbol = getNativeCurrencySymbol(currentChainId)
          const decimals = 18

          return {
            result: {
              chainId: currentChainId,
              account: targetAddress,
              native: {
                symbol,
                name: symbol,
                decimals,
                balance: balance.toString(),
                formattedBalance: formatUnits(balance, decimals),
              },
              tokens,
            },
            supported: !isUnsupported,
          }
        } catch {
          return { result: null, supported: !isUnsupported }
        }
      }
    },
    [fetchOnChainTokenBalances, mergeOnChainTokens]
  )

  /**
   * Public refetch — guarded by fetchId to drop stale results.
   */
  const fetchAssets = useCallback(async () => {
    if (!isConnected || !address) {
      setAssets(null)
      setIsLoading(false)
      return
    }

    const id = ++fetchIdRef.current
    setIsLoading(true)
    setIsError(false)
    setError(null)

    try {
      const { result, supported } = await doFetch(address)

      // Drop if a newer fetch was started while we were awaiting
      if (id !== fetchIdRef.current) return

      setIsSupported(supported)
      setAssets(result)
    } catch (err) {
      if (id !== fetchIdRef.current) return
      setIsError(true)
      setError(err instanceof Error ? err.message : 'Failed to fetch assets')
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [isConnected, address, doFetch])

  /**
   * Add a custom token
   */
  const addToken = useCallback(
    async (params: AddTokenParams): Promise<AddTokenResult> => {
      const provider = getProvider()
      if (!provider) {
        return { success: false, error: 'No provider available' }
      }

      if (!isSupported) {
        return { success: false, error: 'Wallet does not support wallet_addToken' }
      }

      try {
        const result = (await provider.request({
          method: 'wallet_addToken',
          params: [params],
        })) as { success: boolean; token?: WalletToken; error?: string }

        if (result.success) {
          await fetchAssets()
        }

        return result
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to add token',
        }
      }
    },
    [isSupported, fetchAssets]
  )

  // Refetch whenever connection state, address, or chainId changes.
  useEffect(() => {
    if (isConnected && address) {
      fetchAssets()
    } else {
      setAssets(null)
      setIsLoading(false)
    }
  }, [isConnected, address, fetchAssets])

  // Listen for assetsChanged events from wallet extension to auto-refresh
  useEffect(() => {
    if (typeof window === 'undefined') return

    type EventProvider = {
      on?: (event: string, fn: (...args: unknown[]) => void) => void
      removeListener?: (event: string, fn: (...args: unknown[]) => void) => void
    }

    const win = window as {
      stablenet?: { isStableNet?: boolean } & EventProvider
      ethereum?: EventProvider
    }

    const provider: EventProvider | undefined = win.stablenet?.isStableNet
      ? win.stablenet
      : win.ethereum
    if (!provider?.on) return

    const handleAssetsChanged = () => {
      fetchAssets()
    }

    provider.on('assetsChanged', handleAssetsChanged)
    return () => {
      provider.removeListener?.('assetsChanged', handleAssetsChanged)
    }
  }, [fetchAssets])

  return {
    isSupported,
    native: assets?.native ?? null,
    tokens: assets?.tokens ?? [],
    assets,
    isLoading,
    isError,
    error,
    refetch: fetchAssets,
    addToken,
  }
}

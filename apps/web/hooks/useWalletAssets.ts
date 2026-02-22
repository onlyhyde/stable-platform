'use client'

import { getNativeCurrencySymbol } from '@stablenet/wallet-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { useAccount, useChainId } from 'wagmi'

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

/**
 * Get provider from window.ethereum
 */
function getProvider(): {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
} | null {
  if (typeof window === 'undefined') return null
  const ethereum = (window as { ethereum?: { request?: (...args: unknown[]) => unknown } }).ethereum
  if (!ethereum?.request) return null
  return ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
}

export function useWalletAssets(): UseWalletAssetsResult {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()

  const [isSupported, setIsSupported] = useState(false)
  const [assets, setAssets] = useState<WalletAssetsResponse | null>(null)
  // Start true when we expect data to load — prevents "0 ETH" flash
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Monotonically increasing fetch ID to discard stale responses
  const fetchIdRef = useRef(0)

  /**
   * Core fetch — tries wallet_getAssets first, falls back to eth_getBalance.
   * Returns { assets, supported } so callers can update both in one pass.
   */
  const doFetch = useCallback(
    async (
      targetAddress: Address
    ): Promise<{ result: WalletAssetsResponse | null; supported: boolean }> => {
      const provider = getProvider()
      if (!provider) return { result: null, supported: false }

      // Try wallet_getAssets (StableNet wallet)
      try {
        const result = (await provider.request({
          method: 'wallet_getAssets',
          params: [],
        })) as WalletAssetsResponse

        return { result, supported: true }
      } catch (err) {
        const error = err as { code?: number; message?: string }
        const isUnsupported =
          error.code === 4200 ||
          error.code === -32601 ||
          error.message?.includes('not supported')

        if (!isUnsupported) {
          // Method exists but failed for another reason (e.g. not connected) —
          // still mark as supported, fall through to eth_getBalance
        }

        // Fallback: eth_getBalance
        try {
          const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string
          const currentChainId = Number.parseInt(chainIdHex, 16)

          const balanceHex = (await provider.request({
            method: 'eth_getBalance',
            params: [targetAddress, 'latest'],
          })) as string
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
              tokens: [],
            },
            supported: !isUnsupported,
          }
        } catch {
          return { result: null, supported: !isUnsupported }
        }
      }
    },
    []
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
      setError((err as Error).message || 'Failed to fetch assets')
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
          error: (err as Error).message || 'Failed to add token',
        }
      }
    },
    [isSupported, fetchAssets]
  )

  // Single effect: fetch whenever connection state, address, or chainId changes.
  useEffect(() => {
    if (isConnected && address) {
      fetchAssets()
    } else {
      setAssets(null)
      setIsLoading(false)
    }
  }, [isConnected, address, chainId, fetchAssets])

  // Listen for wallet events (chain/account/assets changes)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const ethereum = window as {
      ethereum?: {
        on?: (event: string, handler: () => void) => void
        removeListener?: (event: string, handler: () => void) => void
      }
    }
    if (!ethereum.ethereum?.on) return

    const handleChange = () => {
      fetchAssets()
    }

    ethereum.ethereum.on('chainChanged', handleChange)
    ethereum.ethereum.on('accountsChanged', handleChange)
    ethereum.ethereum.on('assetsChanged', handleChange)

    return () => {
      ethereum.ethereum?.removeListener?.('chainChanged', handleChange)
      ethereum.ethereum?.removeListener?.('accountsChanged', handleChange)
      ethereum.ethereum?.removeListener?.('assetsChanged', handleChange)
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

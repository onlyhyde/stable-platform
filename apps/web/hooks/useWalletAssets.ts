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

/**
 * Check if wallet supports wallet_getAssets
 */
async function checkWalletAssetsSupport(): Promise<boolean> {
  const provider = getProvider()
  if (!provider) return false

  try {
    // Try calling wallet_getAssets - if it works, the wallet supports it
    await provider.request({ method: 'wallet_getAssets', params: [] })
    return true
  } catch (error) {
    // Check if it's a "method not found" error
    const err = error as { code?: number; message?: string }
    if (err.code === 4200 || err.code === -32601 || err.message?.includes('not supported')) {
      return false
    }
    // Other errors (like "not connected") still mean the method exists
    return true
  }
}

/**
 * Hook for wallet asset management
 *
 * Uses wallet_getAssets RPC for StableNet wallet, falls back to direct
 * eth_getBalance calls for other wallets.
 *
 * @example
 * ```tsx
 * function AssetList() {
 *   const { native, tokens, isLoading, addToken } = useWalletAssets()
 *
 *   if (isLoading) return <Spinner />
 *
 *   return (
 *     <div>
 *       <div>{native?.symbol}: {native?.formattedBalance}</div>
 *       {tokens.map(token => (
 *         <div key={token.address}>
 *           {token.symbol}: {token.formattedBalance}
 *         </div>
 *       ))}
 *       <button onClick={() => addToken({ address: '0x...' })}>
 *         Add Token
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useWalletAssets(): UseWalletAssetsResult {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()

  const [isSupported, setIsSupported] = useState(false)
  const [assets, setAssets] = useState<WalletAssetsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track previous values
  const prevChainId = useRef(chainId)
  const prevAddress = useRef(address)

  /**
   * Fetch assets using wallet_getAssets RPC
   */
  const fetchWalletAssets = useCallback(async (): Promise<WalletAssetsResponse | null> => {
    const provider = getProvider()
    if (!provider) return null

    try {
      const result = (await provider.request({
        method: 'wallet_getAssets',
        params: [],
      })) as WalletAssetsResponse

      return result
    } catch (err) {
      console.error('[useWalletAssets] wallet_getAssets error:', err)
      return null
    }
  }, [])

  /**
   * Fetch assets using eth_getBalance (fallback)
   */
  const fetchFallbackAssets = useCallback(async (): Promise<WalletAssetsResponse | null> => {
    if (!address) return null

    const provider = getProvider()
    if (!provider) return null

    try {
      // Get chain ID
      const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string
      const currentChainId = Number.parseInt(chainIdHex, 16)

      // Get native balance
      const balanceHex = (await provider.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      })) as string
      const balance = BigInt(balanceHex || '0')

      const symbol = getNativeCurrencySymbol(currentChainId)
      const decimals = 18
      const formattedBalance = formatUnits(balance, decimals)

      return {
        chainId: currentChainId,
        account: address,
        native: {
          symbol,
          name: symbol,
          decimals,
          balance: balance.toString(),
          formattedBalance,
        },
        tokens: [], // Fallback doesn't support token discovery
      }
    } catch (err) {
      console.error('[useWalletAssets] Fallback fetch error:', err)
      return null
    }
  }, [address])

  /**
   * Fetch assets (auto-selects method based on support)
   */
  const fetchAssets = useCallback(async () => {
    if (!isConnected || !address) {
      setAssets(null)
      return
    }

    setIsLoading(true)
    setIsError(false)
    setError(null)

    try {
      let result: WalletAssetsResponse | null = null

      if (isSupported) {
        result = await fetchWalletAssets()
      }

      // Fallback if wallet_getAssets failed or not supported
      if (!result) {
        result = await fetchFallbackAssets()
      }

      setAssets(result)
    } catch (err) {
      console.error('[useWalletAssets] Error fetching assets:', err)
      setIsError(true)
      setError((err as Error).message || 'Failed to fetch assets')
    } finally {
      setIsLoading(false)
    }
  }, [isConnected, address, isSupported, fetchWalletAssets, fetchFallbackAssets])

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
          // Refresh assets to include the new token
          await fetchAssets()
        }

        return result
      } catch (err) {
        console.error('[useWalletAssets] wallet_addToken error:', err)
        return {
          success: false,
          error: (err as Error).message || 'Failed to add token',
        }
      }
    },
    [isSupported, fetchAssets]
  )

  // Check wallet support on mount
  useEffect(() => {
    if (!isConnected) {
      setIsSupported(false)
      return
    }

    checkWalletAssetsSupport().then(setIsSupported)
  }, [isConnected])

  // Fetch assets when connected or support status changes
  useEffect(() => {
    if (isConnected) {
      fetchAssets()
    } else {
      setAssets(null)
    }
  }, [isConnected, fetchAssets])

  // Re-fetch when chain or account changes
  useEffect(() => {
    if (prevChainId.current !== chainId || prevAddress.current !== address) {
      prevChainId.current = chainId
      prevAddress.current = address
      fetchAssets()
    }
  }, [chainId, address, fetchAssets])

  // Listen for assetsChanged events
  useEffect(() => {
    if (typeof window === 'undefined' || !isSupported) return

    const provider = getProvider()
    if (!provider) return

    const ethereum = window as {
      ethereum?: {
        on?: (...args: unknown[]) => void
        removeListener?: (...args: unknown[]) => void
      }
    }
    if (!ethereum.ethereum?.on) return

    const handleAssetsChanged = () => {
      fetchAssets()
    }

    ethereum.ethereum.on('assetsChanged', handleAssetsChanged)

    return () => {
      ethereum.ethereum?.removeListener?.('assetsChanged', handleAssetsChanged)
    }
  }, [isSupported, fetchAssets])

  // Listen for chain/account changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const ethereum = window as {
      ethereum?: {
        on?: (...args: unknown[]) => void
        removeListener?: (...args: unknown[]) => void
      }
    }
    if (!ethereum.ethereum?.on) return

    const handleChainChanged = () => {
      fetchAssets()
    }

    const handleAccountsChanged = () => {
      fetchAssets()
    }

    ethereum.ethereum.on('chainChanged', handleChainChanged)
    ethereum.ethereum.on('accountsChanged', handleAccountsChanged)

    return () => {
      ethereum.ethereum?.removeListener?.('chainChanged', handleChainChanged)
      ethereum.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
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

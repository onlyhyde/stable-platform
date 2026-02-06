/**
 * useAssets Hook
 *
 * Manages wallet assets (native + tokens) with support for:
 * - Fetching assets from background state
 * - Adding/removing tokens
 * - Token visibility management
 */

import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import type { WalletToken } from '../../types'
import { useWalletStore } from './useWalletStore'

export interface AssetToken {
  address: Address
  symbol: string
  name: string
  decimals: number
  balance: string
  formattedBalance: string
  logoURI?: string
  isVisible: boolean
}

export interface AssetsState {
  /** Native balance in wei */
  nativeBalance: bigint | undefined
  /** Native balance formatted */
  nativeFormatted: string
  /** Token list */
  tokens: AssetToken[]
  /** Loading state */
  isLoading: boolean
  /** Error message */
  error: string | null
  /** Refresh assets */
  refresh: () => Promise<void>
  /** Add a new token */
  addToken: (params: AddTokenParams) => Promise<AddTokenResult>
  /** Remove a token */
  removeToken: (address: Address) => Promise<void>
  /** Toggle token visibility */
  toggleTokenVisibility: (address: Address) => Promise<void>
}

export interface AddTokenParams {
  address: Address
  symbol?: string
  name?: string
  decimals?: number
  logoURI?: string
}

export interface AddTokenResult {
  success: boolean
  token?: WalletToken
  error?: string
}

/**
 * Format balance with decimals
 */
function formatBalance(balance: string | bigint, decimals: number): string {
  const value = typeof balance === 'bigint' ? balance : BigInt(balance || '0')
  const divisor = BigInt(10 ** decimals)
  const whole = value / divisor
  const remainder = value % divisor

  if (remainder === 0n) {
    return whole.toString()
  }

  const remainderStr = remainder.toString().padStart(decimals, '0')
  const trimmed = remainderStr.replace(/0+$/, '').slice(0, 6)

  if (trimmed === '') {
    return whole.toString()
  }

  return `${whole}.${trimmed}`
}

export function useAssets(): AssetsState {
  const { selectedAccount, selectedChainId } = useWalletStore()

  const [nativeBalance, setNativeBalance] = useState<bigint | undefined>(undefined)
  const [tokens, setTokens] = useState<AssetToken[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch assets from background
   */
  const fetchAssets = useCallback(async () => {
    if (!selectedAccount) {
      setNativeBalance(undefined)
      setTokens([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get native balance
      const balanceResponse = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `balance-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [selectedAccount, 'latest'],
        },
      })

      if (balanceResponse?.payload?.result) {
        setNativeBalance(BigInt(balanceResponse.payload.result))
      }

      // Get tracked tokens from background state
      const stateResponse = await chrome.runtime.sendMessage({
        type: 'GET_ASSETS',
        id: `assets-${Date.now()}`,
        payload: { chainId: selectedChainId, account: selectedAccount },
      })

      if (stateResponse?.payload?.tokens) {
        const tokenList: AssetToken[] = stateResponse.payload.tokens.map(
          (t: WalletToken & { balance?: string }) => ({
            address: t.address as Address,
            symbol: t.symbol,
            name: t.name,
            decimals: t.decimals,
            balance: t.balance || '0',
            formattedBalance: formatBalance(t.balance || '0', t.decimals),
            logoURI: t.logoURI,
            isVisible: t.isVisible,
          })
        )
        setTokens(tokenList)
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch assets')
    } finally {
      setIsLoading(false)
    }
  }, [selectedAccount, selectedChainId])

  /**
   * Add a new token
   */
  const addToken = useCallback(
    async (params: AddTokenParams): Promise<AddTokenResult> => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'ADD_TOKEN',
          id: `add-token-${Date.now()}`,
          payload: {
            chainId: selectedChainId,
            token: params,
          },
        })

        if (response?.payload?.success) {
          // Refresh tokens after adding
          await fetchAssets()
          return {
            success: true,
            token: response.payload.token,
          }
        }

        return {
          success: false,
          error: response?.payload?.error || 'Failed to add token',
        }
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message || 'Failed to add token',
        }
      }
    },
    [selectedChainId, fetchAssets]
  )

  /**
   * Remove a token
   */
  const removeToken = useCallback(
    async (address: Address) => {
      try {
        await chrome.runtime.sendMessage({
          type: 'REMOVE_TOKEN',
          id: `remove-token-${Date.now()}`,
          payload: {
            chainId: selectedChainId,
            address,
          },
        })

        // Update local state
        setTokens((prev) => prev.filter((t) => t.address.toLowerCase() !== address.toLowerCase()))
      } catch (err) {
        setError((err as Error).message || 'Failed to remove token')
      }
    },
    [selectedChainId]
  )

  /**
   * Toggle token visibility
   */
  const toggleTokenVisibility = useCallback(
    async (address: Address) => {
      try {
        const token = tokens.find((t) => t.address.toLowerCase() === address.toLowerCase())
        if (!token) return

        await chrome.runtime.sendMessage({
          type: 'SET_TOKEN_VISIBILITY',
          id: `visibility-${Date.now()}`,
          payload: {
            chainId: selectedChainId,
            address,
            isVisible: !token.isVisible,
          },
        })

        // Update local state
        setTokens((prev) =>
          prev.map((t) =>
            t.address.toLowerCase() === address.toLowerCase()
              ? { ...t, isVisible: !t.isVisible }
              : t
          )
        )
      } catch (err) {
        setError((err as Error).message || 'Failed to update token visibility')
      }
    },
    [selectedChainId, tokens]
  )

  // Fetch assets on mount and when account/chain changes
  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  return {
    nativeBalance,
    nativeFormatted: nativeBalance !== undefined ? formatBalance(nativeBalance, 18) : '--',
    tokens,
    isLoading,
    error,
    refresh: fetchAssets,
    addToken,
    removeToken,
    toggleTokenVisibility,
  }
}

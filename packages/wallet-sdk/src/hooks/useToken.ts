/**
 * useToken - Hook for ERC20 token balance and information
 */

import { useCallback, useEffect, useState } from 'react'
import { type Address, formatUnits } from 'viem'
import { useOptionalProvider } from '../context/WalletContext'
import type { StableNetProvider } from '../provider/StableNetProvider'
import type { BalanceInfo, TokenInfo } from '../types'

// ERC20 ABI for balance and token info
const ERC20_BALANCE_OF = '0x70a08231' // balanceOf(address)
const ERC20_NAME = '0x06fdde03' // name()
const ERC20_SYMBOL = '0x95d89b41' // symbol()
const ERC20_DECIMALS = '0x313ce567' // decimals()

interface UseTokenOptions {
  /** Token contract address */
  tokenAddress: Address
  /** Account address to check balance for */
  account?: Address | null
  /** Provider instance (auto-injected from WalletProvider if omitted) */
  provider?: StableNetProvider | null
  /** Auto-refresh on account/chain change */
  watch?: boolean
}

interface UseTokenResult {
  /** Token information */
  token: TokenInfo | null
  /** Token balance */
  balance: BalanceInfo | null
  /** Loading state */
  isLoading: boolean
  /** Error if any */
  error: Error | null
  /** Refetch token data */
  refetch: () => Promise<void>
}

/**
 * Decode string from hex (for name/symbol)
 */
/** Max decoded string length (bytes) to prevent malicious RPC data from causing memory issues. */
const MAX_DECODED_STRING_LENGTH = 1024

function decodeString(hex: string): string {
  try {
    // Remove 0x prefix and skip first 64 chars (offset) and next 64 chars (length)
    const data = hex.slice(2)
    if (data.length < 128) return ''

    const lengthHex = data.slice(64, 128)
    const rawLength = Number.parseInt(lengthHex, 16)

    // Bounds check: reject NaN, negative, or excessively large values
    if (!Number.isFinite(rawLength) || rawLength <= 0 || rawLength > MAX_DECODED_STRING_LENGTH) {
      return ''
    }

    const length = rawLength * 2
    const available = data.length - 128
    const safeLength = Math.min(length, available)

    const stringHex = data.slice(128, 128 + safeLength)
    const bytes: number[] = []
    for (let i = 0; i < stringHex.length; i += 2) {
      const byte = Number.parseInt(stringHex.slice(i, i + 2), 16)
      if (byte !== 0) bytes.push(byte)
    }
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
  } catch {
    return ''
  }
}

/**
 * Decode uint256 from hex (for decimals/balance)
 */
function decodeUint256(hex: string): bigint {
  try {
    const data = hex.slice(2)
    return BigInt('0x' + data)
  } catch {
    return 0n
  }
}

/**
 * React hook for ERC20 token balance and information
 *
 * @example
 * ```tsx
 * const { token, balance, isLoading } = useToken({
 *   tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
 *   account,
 *   provider
 * })
 *
 * if (isLoading) return <div>Loading...</div>
 *
 * return (
 *   <div>
 *     {token?.symbol}: {balance?.formatted}
 *   </div>
 * )
 * ```
 */
export function useToken(options: UseTokenOptions): UseTokenResult {
  const contextProvider = useOptionalProvider()
  const { tokenAddress, account, provider: explicitProvider, watch = true } = options
  const provider = explicitProvider ?? contextProvider

  const [token, setToken] = useState<TokenInfo | null>(null)
  const [balance, setBalance] = useState<BalanceInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchToken = useCallback(async () => {
    if (!provider || !tokenAddress) {
      setToken(null)
      setBalance(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get chain ID
      const chainIdHex = await provider.getChainId()
      const chainId = Number.parseInt(chainIdHex, 16)

      // Fetch token info
      const [nameResult, symbolResult, decimalsResult] = await Promise.all([
        provider.request<string>({
          method: 'eth_call',
          params: [{ to: tokenAddress, data: ERC20_NAME }, 'latest'],
        }),
        provider.request<string>({
          method: 'eth_call',
          params: [{ to: tokenAddress, data: ERC20_SYMBOL }, 'latest'],
        }),
        provider.request<string>({
          method: 'eth_call',
          params: [{ to: tokenAddress, data: ERC20_DECIMALS }, 'latest'],
        }),
      ])

      const name = decodeString(nameResult)
      const symbol = decodeString(symbolResult)
      const decimals = Number(decodeUint256(decimalsResult))

      const tokenInfo: TokenInfo = {
        address: tokenAddress,
        name,
        symbol,
        decimals,
        chainId,
      }

      // Fetch balance if account is provided
      if (account) {
        const balanceData = ERC20_BALANCE_OF + account.slice(2).toLowerCase().padStart(64, '0')

        const balanceResult = await provider.request<string>({
          method: 'eth_call',
          params: [{ to: tokenAddress, data: balanceData }, 'latest'],
        })

        const raw = decodeUint256(balanceResult)
        const formatted = formatUnits(raw, decimals)

        const balanceInfo: BalanceInfo = {
          raw,
          formatted,
          symbol,
          decimals,
        }

        setBalance(balanceInfo)
        tokenInfo.balance = balanceInfo
      }

      setToken(tokenInfo)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch token data'))
      setToken(null)
      setBalance(null)
    } finally {
      setIsLoading(false)
    }
  }, [provider, tokenAddress, account])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchToken()
  }, [fetchToken])

  // Watch for changes
  useEffect(() => {
    if (!watch || !provider) return

    const unsubAccount = provider.on('accountsChanged', () => {
      fetchToken()
    })

    const unsubChain = provider.on('chainChanged', () => {
      fetchToken()
    })

    return () => {
      unsubAccount()
      unsubChain()
    }
  }, [watch, provider, fetchToken])

  return {
    token,
    balance,
    isLoading,
    error,
    refetch: fetchToken,
  }
}

import { getDefaultTokens } from '@stablenet/contracts'
import type { Address, PublicClient } from 'viem'
import type { SupportedToken } from '../types'

/**
 * ERC20Paymaster ABI (read-only functions)
 *
 * Note: The on-chain contract uses `mapping(address => bool) supportedTokens`
 * and `isTokenSupported(address)` — there is no `getSupportedTokens()` function.
 * Token discovery uses known tokens from @stablenet/contracts + isTokenSupported checks.
 */
export const ERC20_PAYMASTER_ABI = [
  {
    type: 'function',
    name: 'isTokenSupported',
    inputs: [{ type: 'address', name: 'token' }],
    outputs: [{ type: 'bool', name: '' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenConfig',
    inputs: [{ type: 'address', name: 'token' }],
    outputs: [
      { type: 'address', name: 'oracle' },
      { type: 'uint32', name: 'markup' },
      { type: 'bool', name: 'active' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculateTokenAmount',
    inputs: [
      { type: 'address', name: 'token' },
      { type: 'uint256', name: 'ethAmount' },
    ],
    outputs: [{ type: 'uint256', name: 'tokenAmount' }],
    stateMutability: 'view',
  },
] as const

/**
 * PriceOracle ABI (read-only functions)
 */
export const PRICE_ORACLE_ABI = [
  {
    type: 'function',
    name: 'getPrice',
    inputs: [{ type: 'address', name: 'token' }],
    outputs: [{ type: 'uint256', name: 'price' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'convertAmount',
    inputs: [
      { type: 'address', name: 'fromToken' },
      { type: 'address', name: 'toToken' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [{ type: 'uint256', name: 'convertedAmount' }],
    stateMutability: 'view',
  },
] as const

/**
 * ERC-20 token ABI (metadata)
 */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string', name: '' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8', name: '' }],
    stateMutability: 'view',
  },
] as const

/**
 * TTL-based cache entry
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const DEFAULT_CACHE_TTL_MS = 60_000 // 60 seconds

/**
 * Simple TTL cache
 */
class TtlCache<T> {
  private cache = new Map<string, CacheEntry<T>>()

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T, ttlMs = DEFAULT_CACHE_TTL_MS): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs })
  }
}

const tokenListCache = new TtlCache<SupportedToken[]>()
const tokenPriceCache = new TtlCache<string>()

/**
 * Fetch supported tokens by checking known tokens against the on-chain
 * `isTokenSupported(address)` function.
 *
 * The ERC20Paymaster contract uses a mapping, not a getter array, so we
 * discover tokens from @stablenet/contracts' known token list and verify
 * each one on-chain.
 */
export async function fetchSupportedTokens(
  client: PublicClient,
  paymasterAddress: Address,
  oracleAddress?: Address,
  chainId?: number
): Promise<SupportedToken[]> {
  const cacheKey = `${paymasterAddress}:${chainId ?? 'unknown'}`
  const cached = tokenListCache.get(cacheKey)
  if (cached) return cached

  // Get chain ID from client if not provided
  const resolvedChainId = chainId ?? Number(await client.getChainId())

  // Get known ERC-20 tokens for this chain (exclude native zero-address)
  const knownTokens = getDefaultTokens(resolvedChainId).filter(
    (t) => t.address !== '0x0000000000000000000000000000000000000000'
  )

  if (knownTokens.length === 0) {
    return []
  }

  // Check each known token against the on-chain isTokenSupported mapping
  const supportChecks = await Promise.allSettled(
    knownTokens.map(async (token) => {
      const supported = (await client.readContract({
        address: paymasterAddress,
        abi: ERC20_PAYMASTER_ABI,
        functionName: 'isTokenSupported',
        args: [token.address as Address],
      })) as boolean

      return { token, supported }
    })
  )

  const supportedTokens: SupportedToken[] = []

  for (const result of supportChecks) {
    if (result.status !== 'fulfilled' || !result.value.supported) continue

    const { token } = result.value

    // Optionally fetch exchange rate from oracle
    let exchangeRate = '0'
    if (oracleAddress) {
      try {
        const price = (await client.readContract({
          address: oracleAddress,
          abi: PRICE_ORACLE_ABI,
          functionName: 'getPrice',
          args: [token.address as Address],
        })) as bigint
        exchangeRate = price.toString()
      } catch {
        // Oracle price unavailable — use 0 as fallback
      }
    }

    supportedTokens.push({
      address: token.address as Address,
      symbol: token.symbol,
      decimals: token.decimals,
      exchangeRate,
    })
  }

  tokenListCache.set(cacheKey, supportedTokens)
  return supportedTokens
}

/**
 * Check if a token is supported by ERC20Paymaster
 */
export async function isTokenSupported(
  client: PublicClient,
  paymasterAddress: Address,
  tokenAddress: Address
): Promise<boolean> {
  return (await client.readContract({
    address: paymasterAddress,
    abi: ERC20_PAYMASTER_ABI,
    functionName: 'isTokenSupported',
    args: [tokenAddress],
  })) as boolean
}

/**
 * Calculate token amount for a given WKRC amount
 */
export async function calculateTokenAmount(
  client: PublicClient,
  paymasterAddress: Address,
  tokenAddress: Address,
  ethAmount: bigint
): Promise<bigint> {
  return (await client.readContract({
    address: paymasterAddress,
    abi: ERC20_PAYMASTER_ABI,
    functionName: 'calculateTokenAmount',
    args: [tokenAddress, ethAmount],
  })) as bigint
}

/**
 * Get token config (oracle, markup, active)
 */
export async function getTokenConfig(
  client: PublicClient,
  paymasterAddress: Address,
  tokenAddress: Address
): Promise<{ oracle: Address; markup: number; active: boolean }> {
  const [oracle, markup, active] = (await client.readContract({
    address: paymasterAddress,
    abi: ERC20_PAYMASTER_ABI,
    functionName: 'getTokenConfig',
    args: [tokenAddress],
  })) as [Address, number, boolean]

  return { oracle, markup, active }
}

/**
 * Get token price from oracle (cached)
 */
export async function getTokenPrice(
  client: PublicClient,
  oracleAddress: Address,
  tokenAddress: Address
): Promise<string> {
  const cacheKey = `${oracleAddress}:${tokenAddress}`
  const cached = tokenPriceCache.get(cacheKey)
  if (cached) return cached

  const price = (await client.readContract({
    address: oracleAddress,
    abi: PRICE_ORACLE_ABI,
    functionName: 'getPrice',
    args: [tokenAddress],
  })) as bigint

  const priceStr = price.toString()
  tokenPriceCache.set(cacheKey, priceStr)
  return priceStr
}

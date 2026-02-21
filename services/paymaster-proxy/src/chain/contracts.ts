import type { Address, PublicClient } from 'viem'
import type { SupportedToken } from '../types'

/**
 * ERC20Paymaster ABI (read-only functions)
 */
export const ERC20_PAYMASTER_ABI = [
  {
    type: 'function',
    name: 'getSupportedTokens',
    inputs: [],
    outputs: [{ type: 'address[]', name: 'tokens' }],
    stateMutability: 'view',
  },
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
 * Fetch supported tokens from ERC20Paymaster contract
 */
export async function fetchSupportedTokens(
  client: PublicClient,
  paymasterAddress: Address,
  oracleAddress?: Address
): Promise<SupportedToken[]> {
  const cacheKey = `${paymasterAddress}`
  const cached = tokenListCache.get(cacheKey)
  if (cached) return cached

  const tokenAddresses = (await client.readContract({
    address: paymasterAddress,
    abi: ERC20_PAYMASTER_ABI,
    functionName: 'getSupportedTokens',
  })) as Address[]

  const tokens: SupportedToken[] = await Promise.all(
    tokenAddresses.map(async (tokenAddr) => {
      const [symbol, decimals, exchangeRate] = await Promise.all([
        client.readContract({
          address: tokenAddr,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }) as Promise<string>,
        client.readContract({
          address: tokenAddr,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }) as Promise<number>,
        oracleAddress
          ? (client.readContract({
              address: oracleAddress,
              abi: PRICE_ORACLE_ABI,
              functionName: 'getPrice',
              args: [tokenAddr],
            }) as Promise<bigint>)
          : Promise.resolve(0n),
      ])

      return {
        address: tokenAddr,
        symbol,
        decimals,
        exchangeRate: exchangeRate.toString(),
      }
    })
  )

  tokenListCache.set(cacheKey, tokens)
  return tokens
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
 * Calculate token amount for a given ETH amount
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

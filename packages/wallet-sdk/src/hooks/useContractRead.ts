/**
 * useContractRead - Hook for reading data from smart contracts
 *
 * Encodes function calls using viem's encodeFunctionData, executes
 * them via the provider's eth_call, and decodes results with
 * decodeFunctionResult.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { type Abi, type Address, decodeFunctionResult, encodeFunctionData } from 'viem'
import { useOptionalProvider } from '../context/WalletContext'
import type { StableNetProvider } from '../provider/StableNetProvider'

interface UseContractReadOptions<TAbi extends Abi = Abi, TFunctionName extends string = string> {
  /** Contract address */
  address: Address
  /** Contract ABI */
  abi: TAbi
  /** Function name to call */
  functionName: TFunctionName
  /** Function arguments */
  args?: readonly unknown[]
  /** Chain ID override (uses provider chain if not specified) */
  chainId?: number
  /** Whether the query is enabled (defaults to true) */
  enabled?: boolean
  /** Provider instance (auto-injected from WalletProvider if omitted) */
  provider?: StableNetProvider | null
  /** Auto-refresh on account/chain change */
  watch?: boolean
}

interface UseContractReadResult<TData = unknown> {
  /** Decoded return data */
  data: TData | null
  /** Loading state */
  isLoading: boolean
  /** Error if any */
  error: Error | null
  /** Refetch contract data */
  refetch: () => Promise<void>
}

/**
 * Build a stable cache key from call parameters.
 * Used to avoid redundant fetches when inputs have not changed.
 */
function buildCacheKey(
  address: Address,
  functionName: string,
  args: readonly unknown[] | undefined
): string {
  if (!args || args.length === 0) return `${address}:${functionName}:[]`
  // Serialize args, converting bigints to strings for JSON compatibility
  const parts = args.map((a) => (typeof a === 'bigint' ? a.toString() : JSON.stringify(a)))
  return `${address}:${functionName}:[${parts.join(',')}]`
}

/**
 * React hook for reading data from a smart contract
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useContractRead({
 *   address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *   abi: erc20Abi,
 *   functionName: 'balanceOf',
 *   args: [userAddress],
 *   provider,
 * })
 *
 * if (isLoading) return <div>Loading...</div>
 * if (error) return <div>Error: {error.message}</div>
 *
 * return <div>Balance: {String(data)}</div>
 * ```
 */
export function useContractRead<TAbi extends Abi = Abi, TFunctionName extends string = string>(
  options: UseContractReadOptions<TAbi, TFunctionName>
): UseContractReadResult {
  const contextProvider = useOptionalProvider()
  const { address, abi, functionName, args, enabled = true, provider: explicitProvider, watch = false } = options
  const provider = explicitProvider ?? contextProvider

  const [data, setData] = useState<unknown | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Stable serialization of args for value-based comparison in deps
  const argsCacheKey = buildCacheKey(address, functionName, args)

  // Keep a ref to the latest args so the callback always reads current values
  const argsRef = useRef(args)
  argsRef.current = args

  // Track the last cache key to avoid setting stale data
  const lastCacheKeyRef = useRef<string>('')

  const fetchData = useCallback(async () => {
    if (!provider || !address || !enabled) {
      setData(null)
      return
    }

    const currentArgs = argsRef.current
    const cacheKey = buildCacheKey(address, functionName, currentArgs)
    lastCacheKeyRef.current = cacheKey

    setIsLoading(true)
    setError(null)

    try {
      // Encode the function call
      // Cast required: viem's generics need concrete ABI types at compile time,
      // but this hook accepts any ABI via generic parameter
      const calldata = encodeFunctionData({
        abi,
        functionName,
        args: currentArgs,
      } as Parameters<typeof encodeFunctionData>[0])

      // Execute via eth_call
      const result = await provider.request<string>({
        method: 'eth_call',
        params: [{ to: address, data: calldata }, 'latest'],
      })

      // Guard against stale responses
      if (lastCacheKeyRef.current !== cacheKey) return

      // Decode the result (same cast rationale as encodeFunctionData above)
      const decoded = decodeFunctionResult({
        abi,
        functionName,
        data: result as `0x${string}`,
      } as Parameters<typeof decodeFunctionResult>[0])

      setData(decoded)
    } catch (err) {
      // Guard against stale error responses
      if (lastCacheKeyRef.current !== cacheKey) return

      setError(err instanceof Error ? err : new Error('Failed to read contract'))
      setData(null)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, address, abi, functionName, argsCacheKey, enabled])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Watch for account/chain changes
  useEffect(() => {
    if (!watch || !provider) return

    const unsubAccount = provider.on('accountsChanged', () => {
      fetchData()
    })

    const unsubChain = provider.on('chainChanged', () => {
      fetchData()
    })

    return () => {
      unsubAccount()
      unsubChain()
    }
  }, [watch, provider, fetchData])

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  }
}

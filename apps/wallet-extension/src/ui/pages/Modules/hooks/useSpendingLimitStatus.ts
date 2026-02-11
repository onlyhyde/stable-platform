import { type InstalledModule, MODULE_TYPE } from '@stablenet/core'
import { useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'

import { useSelectedNetwork } from '../../../hooks'

// ============================================================================
// Types
// ============================================================================

export interface SpendingLimitInfo {
  hookAddress: Address
  token: Address
  tokenSymbol: string
  limit: bigint
  spent: bigint
  period: bigint
  resetTime: bigint
}

interface UseSpendingLimitStatusReturn {
  limits: SpendingLimitInfo[]
  isLoading: boolean
  error: Error | null
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Query on-chain spending limit status for hook modules
 */
export function useSpendingLimitStatus(
  accountAddress?: Address,
  installedModules?: InstalledModule[] | null
): UseSpendingLimitStatusReturn {
  const [limits, setLimits] = useState<SpendingLimitInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const currentNetwork = useSelectedNetwork()

  // Filter to only spending limit hook modules
  const spendingLimitHooks = useMemo(() => {
    if (!installedModules) return []
    return installedModules.filter(
      (m) => m.type === MODULE_TYPE.HOOK && m.metadata.name.toLowerCase().includes('spending')
    )
  }, [installedModules])

  useEffect(() => {
    if (!accountAddress || !currentNetwork || spendingLimitHooks.length === 0) {
      setLimits([])
      return
    }

    setIsLoading(true)
    setError(null)

    const fetchLimits = async () => {
      const results: SpendingLimitInfo[] = []

      for (const hook of spendingLimitHooks) {
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'RPC_REQUEST',
            id: `spending-limit-${hook.address}-${Date.now()}`,
            payload: {
              jsonrpc: '2.0',
              id: 1,
              method: 'stablenet_getSpendingLimitStatus',
              params: [
                {
                  account: accountAddress,
                  hookAddress: hook.address,
                  chainId: currentNetwork.chainId,
                },
              ],
            },
          })

          const result = response?.payload?.result
          if (result) {
            const isNativeToken = result.token === '0x0000000000000000000000000000000000000000'

            results.push({
              hookAddress: hook.address as Address,
              token: result.token as Address,
              tokenSymbol: isNativeToken ? currentNetwork.currency.symbol : 'ERC20',
              limit: BigInt(result.limit || '0'),
              spent: BigInt(result.spent || '0'),
              period: BigInt(result.period || '0'),
              resetTime: BigInt(result.resetTime || '0'),
            })
          }
        } catch {
          // Individual hook query failure — skip silently
        }
      }

      setLimits(results)
    }

    fetchLimits()
      .catch((err) =>
        setError(err instanceof Error ? err : new Error('Failed to fetch spending limits'))
      )
      .finally(() => setIsLoading(false))
  }, [accountAddress, currentNetwork, spendingLimitHooks])

  return { limits, isLoading, error }
}

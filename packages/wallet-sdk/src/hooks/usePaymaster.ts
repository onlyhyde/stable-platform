/**
 * React hook for ERC-4337 Paymaster client management.
 *
 * Creates and memoizes a paymaster client instance for gas sponsorship
 * and ERC-20 gas payment.
 */

import { useCallback, useMemo, useState } from 'react'
import { createPaymasterClient } from '../paymaster'
import type { PaymasterResponse, ERC20PaymentEstimate, PartialUserOperationForPaymaster } from '@stablenet/core'
import type { SponsorPolicy, SupportedToken } from '@stablenet/sdk-types'
import type { Address } from 'viem'

export interface UsePaymasterConfig {
  paymasterUrl: string
  chainId: number
  apiKey?: string
}

export interface UsePaymasterResult {
  getSponsorPolicy: (sender: Address, operation: 'transfer' | 'swap' | 'contract_call') => Promise<SponsorPolicy>
  getSponsoredData: (userOp: PartialUserOperationForPaymaster) => Promise<PaymasterResponse>
  getSupportedTokens: () => Promise<SupportedToken[]>
  estimateERC20: (userOp: PartialUserOperationForPaymaster, token: Address) => Promise<ERC20PaymentEstimate>
  getERC20Data: (userOp: PartialUserOperationForPaymaster, token: Address) => Promise<PaymasterResponse & { tokenAmount: bigint }>
  isLoading: boolean
  error: Error | null
}

/**
 * React hook for managing an ERC-4337 paymaster client.
 *
 * @example
 * ```tsx
 * const { getSponsoredData, getSupportedTokens, isLoading } = usePaymaster({
 *   paymasterUrl: 'https://paymaster.example.com',
 *   chainId: 1,
 * })
 * ```
 */
export function usePaymaster(config: UsePaymasterConfig): UsePaymasterResult {
  const { paymasterUrl, chainId, apiKey } = config
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const client = useMemo(
    () => createPaymasterClient({ url: paymasterUrl, chainId, apiKey }),
    [paymasterUrl, chainId, apiKey]
  )

  const wrapAsync = useCallback(<T>(fn: () => Promise<T>) => {
    return async (): Promise<T> => {
      setIsLoading(true)
      setError(null)
      try {
        return await fn()
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Paymaster operation failed')
        setError(e)
        throw e
      } finally {
        setIsLoading(false)
      }
    }
  }, [])

  const getSponsorPolicy = useCallback(
    (sender: Address, operation: 'transfer' | 'swap' | 'contract_call') =>
      wrapAsync(() => client.getSponsorPolicy(sender, operation))(),
    [client, wrapAsync]
  )

  const getSponsoredData = useCallback(
    (userOp: PartialUserOperationForPaymaster) =>
      wrapAsync(() => client.getSponsoredPaymasterData(userOp))(),
    [client, wrapAsync]
  )

  const getSupportedTokens = useCallback(
    () => wrapAsync(() => client.getSupportedTokens())(),
    [client, wrapAsync]
  )

  const estimateERC20 = useCallback(
    (userOp: PartialUserOperationForPaymaster, token: Address) =>
      wrapAsync(() => client.estimateERC20Payment(userOp, token))(),
    [client, wrapAsync]
  )

  const getERC20Data = useCallback(
    (userOp: PartialUserOperationForPaymaster, token: Address) =>
      wrapAsync(() => client.getERC20PaymasterData(userOp, token))(),
    [client, wrapAsync]
  )

  return {
    getSponsorPolicy,
    getSponsoredData,
    getSupportedTokens,
    estimateERC20,
    getERC20Data,
    isLoading,
    error,
  }
}

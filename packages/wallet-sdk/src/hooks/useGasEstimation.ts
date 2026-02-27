/**
 * React hook for UserOperation gas estimation via bundler.
 */

import { useCallback, useState } from 'react'
import type { BundlerClient, UserOperation, UserOperationGasEstimation } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'

export interface UseGasEstimationConfig {
  bundlerClient: BundlerClient | null
}

export interface UseGasEstimationResult {
  gasEstimate: UserOperationGasEstimation | null
  estimate: (userOp: Partial<UserOperation> & { sender: Address; callData: Hex }) => Promise<UserOperationGasEstimation>
  isLoading: boolean
  error: Error | null
}

/**
 * React hook for estimating UserOperation gas via bundler.
 *
 * @example
 * ```tsx
 * const { estimate, gasEstimate, isLoading } = useGasEstimation({ bundlerClient })
 *
 * const gas = await estimate({ sender, callData })
 * ```
 */
export function useGasEstimation(config: UseGasEstimationConfig): UseGasEstimationResult {
  const { bundlerClient } = config
  const [gasEstimate, setGasEstimate] = useState<UserOperationGasEstimation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const estimate = useCallback(async (
    userOp: Partial<UserOperation> & { sender: Address; callData: Hex }
  ): Promise<UserOperationGasEstimation> => {
    if (!bundlerClient) {
      throw new Error('Bundler client not configured')
    }

    setIsLoading(true)
    setError(null)
    try {
      const result = await bundlerClient.estimateUserOperationGas(userOp)
      setGasEstimate(result)
      return result
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Gas estimation failed')
      setError(e)
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [bundlerClient])

  return { gasEstimate, estimate, isLoading, error }
}

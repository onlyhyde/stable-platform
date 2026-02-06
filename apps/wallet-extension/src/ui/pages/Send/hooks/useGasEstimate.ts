import type { GasEstimate, MultiModeTransactionRequest } from '@stablenet/core'
import { useCallback, useEffect, useState } from 'react'
import { useDebounce, useSelectedNetwork } from '../../../hooks'

interface UseGasEstimateParams extends Partial<MultiModeTransactionRequest> {
  enabled?: boolean
}

interface UseGasEstimateReturn {
  gasEstimate: GasEstimate | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook for estimating gas for multi-mode transactions
 *
 * Automatically debounces requests to avoid excessive API calls
 */
export function useGasEstimate(params: UseGasEstimateParams): UseGasEstimateReturn {
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const currentNetwork = useSelectedNetwork()

  // Debounce params to avoid excessive API calls
  const debouncedParams = useDebounce(params, 500)

  const fetchEstimate = useCallback(async () => {
    if (!debouncedParams.from || !debouncedParams.to || !debouncedParams.mode) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Call background service for gas estimate
      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `estimate-gas-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'stablenet_estimateGas',
          params: [
            {
              mode: debouncedParams.mode,
              from: debouncedParams.from,
              to: debouncedParams.to,
              value: debouncedParams.value?.toString() ?? '0',
              data: debouncedParams.data ?? '0x',
              gasPayment: debouncedParams.gasPayment,
              chainId: currentNetwork?.chainId,
            },
          ],
        },
      })

      if (response?.payload?.error) {
        throw new Error(response.payload.error.message || 'Failed to estimate gas')
      }

      const result = response?.payload?.result
      if (result) {
        setGasEstimate({
          gasLimit: BigInt(result.gasLimit || '0'),
          maxFeePerGas: BigInt(result.maxFeePerGas || '0'),
          maxPriorityFeePerGas: BigInt(result.maxPriorityFeePerGas || '0'),
          estimatedCost: BigInt(result.estimatedCost || '0'),
          // Smart Account specific
          preVerificationGas: result.preVerificationGas
            ? BigInt(result.preVerificationGas)
            : undefined,
          verificationGasLimit: result.verificationGasLimit
            ? BigInt(result.verificationGasLimit)
            : undefined,
          callGasLimit: result.callGasLimit ? BigInt(result.callGasLimit) : undefined,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to estimate gas'))
    } finally {
      setIsLoading(false)
    }
  }, [debouncedParams, currentNetwork])

  useEffect(() => {
    if (params.enabled !== false) {
      fetchEstimate()
    }
  }, [fetchEstimate, params.enabled])

  return {
    gasEstimate,
    isLoading,
    error,
    refetch: fetchEstimate,
  }
}

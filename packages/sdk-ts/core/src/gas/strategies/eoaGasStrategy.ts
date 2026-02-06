/**
 * EOA Gas Estimation Strategy
 *
 * Strategy for estimating gas for standard EOA transactions.
 */

import type { GasEstimate, MultiModeTransactionRequest } from '@stablenet/sdk-types'
import { TRANSACTION_MODE } from '@stablenet/sdk-types'
import { BASE_TRANSFER_GAS, GAS_BUFFER_DIVISOR, GAS_BUFFER_MULTIPLIER } from '../../config'
import { GasEstimationError } from '../../errors'
import type { GasEstimationStrategy, GasPrices, GasStrategyConfig } from './types'

// ============================================================================
// EOA Gas Strategy
// ============================================================================

/**
 * Create EOA gas estimation strategy
 */
export function createEOAGasStrategy(config: GasStrategyConfig): GasEstimationStrategy {
  const { provider } = config

  return {
    mode: TRANSACTION_MODE.EOA,

    supports(request: MultiModeTransactionRequest): boolean {
      return request.mode === TRANSACTION_MODE.EOA
    },

    async estimate(
      request: MultiModeTransactionRequest,
      gasPrices: GasPrices
    ): Promise<GasEstimate> {
      // Estimate gas limit
      let gasLimit: bigint
      try {
        gasLimit = await provider.estimateGas({
          from: request.from,
          to: request.to,
          value: request.value,
          data: request.data,
        })
      } catch (error) {
        // Fallback to base transfer gas for simple transfers
        if (!request.data || request.data === '0x') {
          gasLimit = BASE_TRANSFER_GAS
        } else {
          throw new GasEstimationError(
            `EOA gas estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            { operation: 'eoaGasStrategy.estimate', reason: 'ESTIMATION_FAILED' }
          )
        }
      }

      // Apply buffer
      gasLimit = (gasLimit * GAS_BUFFER_MULTIPLIER) / GAS_BUFFER_DIVISOR

      return {
        gasLimit,
        maxFeePerGas: gasPrices.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
        estimatedCost: gasLimit * gasPrices.maxFeePerGas,
      }
    },
  }
}

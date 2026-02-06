/**
 * EIP-7702 Gas Estimation Strategy
 *
 * Strategy for estimating gas for EIP-7702 delegation transactions.
 * Includes authorization list overhead calculation.
 */

import type { GasEstimate, MultiModeTransactionRequest } from '@stablenet/sdk-types'
import { TRANSACTION_MODE } from '@stablenet/sdk-types'
import {
  BASE_TRANSFER_GAS,
  EIP7702_AUTH_GAS,
  GAS_BUFFER_DIVISOR,
  GAS_BUFFER_MULTIPLIER,
  GAS_PER_AUTHORIZATION,
} from '../../config'
import type { GasEstimationStrategy, GasPrices, GasStrategyConfig } from './types'

// ============================================================================
// EIP-7702 Gas Strategy
// ============================================================================

/**
 * Create EIP-7702 gas estimation strategy
 */
export function createEIP7702GasStrategy(config: GasStrategyConfig): GasEstimationStrategy {
  const { provider } = config

  return {
    mode: TRANSACTION_MODE.EIP7702,

    supports(request: MultiModeTransactionRequest): boolean {
      return request.mode === TRANSACTION_MODE.EIP7702
    },

    async estimate(
      request: MultiModeTransactionRequest,
      gasPrices: GasPrices
    ): Promise<GasEstimate> {
      // Base EOA estimation
      let baseGas: bigint
      try {
        baseGas = await provider.estimateGas({
          from: request.from,
          to: request.to,
          value: request.value,
          data: request.data,
        })
      } catch {
        baseGas = BASE_TRANSFER_GAS
      }

      // Add EIP-7702 specific overhead
      const authCount = request.authorizationList?.length ?? 1
      const authGas = EIP7702_AUTH_GAS + GAS_PER_AUTHORIZATION * BigInt(authCount)

      const gasLimit = ((baseGas + authGas) * GAS_BUFFER_MULTIPLIER) / GAS_BUFFER_DIVISOR

      return {
        gasLimit,
        maxFeePerGas: gasPrices.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
        estimatedCost: gasLimit * gasPrices.maxFeePerGas,
      }
    },
  }
}

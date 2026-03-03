/**
 * Smart Account Gas Estimation Strategy
 *
 * Strategy for estimating gas for ERC-4337 Smart Account UserOperations.
 * Handles bundler integration and paymaster gas overhead.
 */

import type { GasEstimate, MultiModeTransactionRequest } from '@stablenet/sdk-types'
import { GAS_PAYMENT_TYPE, TRANSACTION_MODE } from '@stablenet/sdk-types'
import {
  BASE_TRANSFER_GAS,
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  GAS_BUFFER_DIVISOR,
  GAS_BUFFER_MULTIPLIER,
  PAYMASTER_POST_OP_GAS,
  PAYMASTER_VERIFICATION_GAS,
  calculateUnusedGasPenalty,
} from '../../config'
import { GasEstimationError } from '../../errors'
import type { GasEstimationStrategy, GasPrices, GasStrategyConfig } from './types'

// ============================================================================
// Smart Account Gas Strategy
// ============================================================================

/**
 * Create Smart Account gas estimation strategy
 */
export function createSmartAccountGasStrategy(config: GasStrategyConfig): GasEstimationStrategy {
  const { provider, bundlerUrl } = config

  return {
    mode: TRANSACTION_MODE.SMART_ACCOUNT,

    supports(request: MultiModeTransactionRequest): boolean {
      return request.mode === TRANSACTION_MODE.SMART_ACCOUNT
    },

    async estimate(
      request: MultiModeTransactionRequest,
      gasPrices: GasPrices
    ): Promise<GasEstimate> {
      if (!bundlerUrl) {
        throw new GasEstimationError('Bundler URL required for Smart Account gas estimation', {
          operation: 'smartAccountGasStrategy.estimate',
          reason: 'BUNDLER_NOT_CONFIGURED',
        })
      }

      // Estimate actual call gas via provider or bundler
      let estimatedCallGas: bigint
      try {
        estimatedCallGas = await provider.estimateGas({
          from: request.from,
          to: request.to,
          value: request.value,
          data: request.data,
        })
      } catch {
        estimatedCallGas = BASE_TRANSFER_GAS * 2n
      }

      // Apply buffer to get the allocated callGasLimit
      const callGasLimit = (estimatedCallGas * GAS_BUFFER_MULTIPLIER) / GAS_BUFFER_DIVISOR

      // Standard verification gas limits
      const verificationGasLimit = DEFAULT_VERIFICATION_GAS_LIMIT
      const preVerificationGas = DEFAULT_PRE_VERIFICATION_GAS

      // Add paymaster gas if needed
      let paymasterVerificationGasLimit = 0n
      let paymasterPostOpGasLimit = 0n
      // Estimated actual postOp usage (~80% of allocated is typical for ERC20Paymaster)
      let estimatedPostOpGas = 0n

      if (request.gasPayment?.type !== GAS_PAYMENT_TYPE.NATIVE) {
        paymasterVerificationGasLimit = PAYMASTER_VERIFICATION_GAS
        paymasterPostOpGasLimit = PAYMASTER_POST_OP_GAS
        estimatedPostOpGas = (PAYMASTER_POST_OP_GAS * 80n) / 100n
      }

      // EIP-4337 v0.9: Calculate 10% unused gas penalty
      const unusedGasPenalty = calculateUnusedGasPenalty(
        callGasLimit,
        estimatedCallGas,
        paymasterPostOpGasLimit,
        estimatedPostOpGas
      )

      // Total gas including penalty
      const totalGas =
        preVerificationGas +
        verificationGasLimit +
        callGasLimit +
        paymasterVerificationGasLimit +
        paymasterPostOpGasLimit +
        unusedGasPenalty

      // For sponsored transactions, user cost is 0
      const isSponsoredOrERC20 =
        request.gasPayment?.type === GAS_PAYMENT_TYPE.SPONSOR ||
        request.gasPayment?.type === GAS_PAYMENT_TYPE.ERC20

      return {
        gasLimit: totalGas,
        maxFeePerGas: gasPrices.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
        estimatedCost: isSponsoredOrERC20 ? 0n : totalGas * gasPrices.maxFeePerGas,
        // Smart Account specific fields
        preVerificationGas,
        verificationGasLimit,
        callGasLimit,
        paymasterVerificationGasLimit:
          paymasterVerificationGasLimit > 0n ? paymasterVerificationGasLimit : undefined,
        paymasterPostOpGasLimit: paymasterPostOpGasLimit > 0n ? paymasterPostOpGasLimit : undefined,
        unusedGasPenalty: unusedGasPenalty > 0n ? unusedGasPenalty : undefined,
      }
    },
  }
}

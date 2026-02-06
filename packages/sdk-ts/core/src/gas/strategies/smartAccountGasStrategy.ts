/**
 * Smart Account Gas Estimation Strategy
 *
 * Strategy for estimating gas for ERC-4337 Smart Account UserOperations.
 * Handles bundler integration and paymaster gas overhead.
 */

import type { GasEstimate, MultiModeTransactionRequest } from '@stablenet/sdk-types'
import { TRANSACTION_MODE, GAS_PAYMENT_TYPE } from '@stablenet/sdk-types'
import { GasEstimationError } from '../../errors'
import {
  BASE_TRANSFER_GAS,
  GAS_BUFFER_MULTIPLIER,
  GAS_BUFFER_DIVISOR,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  PAYMASTER_VERIFICATION_GAS,
  PAYMASTER_POST_OP_GAS,
} from '../../config'
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
        throw new GasEstimationError(
          'Bundler URL required for Smart Account gas estimation',
          { operation: 'smartAccountGasStrategy.estimate', reason: 'BUNDLER_NOT_CONFIGURED' }
        )
      }

      // For now, use simplified estimation
      // Real implementation would call bundler's eth_estimateUserOperationGas
      let callGasLimit: bigint
      try {
        callGasLimit = await provider.estimateGas({
          from: request.from,
          to: request.to,
          value: request.value,
          data: request.data,
        })
      } catch {
        callGasLimit = BASE_TRANSFER_GAS * 2n
      }

      // Apply buffer
      callGasLimit = (callGasLimit * GAS_BUFFER_MULTIPLIER) / GAS_BUFFER_DIVISOR

      // Standard verification gas limits
      const verificationGasLimit = DEFAULT_VERIFICATION_GAS_LIMIT
      const preVerificationGas = DEFAULT_PRE_VERIFICATION_GAS

      // Add paymaster gas if needed
      let paymasterVerificationGasLimit = 0n
      let paymasterPostOpGasLimit = 0n

      if (request.gasPayment?.type !== GAS_PAYMENT_TYPE.NATIVE) {
        paymasterVerificationGasLimit = PAYMASTER_VERIFICATION_GAS
        paymasterPostOpGasLimit = PAYMASTER_POST_OP_GAS
      }

      // Total gas
      const totalGas =
        preVerificationGas +
        verificationGasLimit +
        callGasLimit +
        paymasterVerificationGasLimit +
        paymasterPostOpGasLimit

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
          paymasterVerificationGasLimit > 0n
            ? paymasterVerificationGasLimit
            : undefined,
        paymasterPostOpGasLimit:
          paymasterPostOpGasLimit > 0n ? paymasterPostOpGasLimit : undefined,
      }
    },
  }
}

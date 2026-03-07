/**
 * Gas Estimation Module
 *
 * Re-exports @stablenet/core's gas estimation infrastructure.
 * Provides convenience wrappers for common gas estimation patterns.
 */

// Gas estimation factory and types
// Gas constants
export {
  createGasEstimator,
  createSmartAccountGasStrategy,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  type ERC20GasEstimate,
  GAS_BUFFER_DIVISOR,
  GAS_BUFFER_MULTIPLIER,
  type GasEstimationStrategy,
  type GasEstimator,
  type GasEstimatorConfig,
  type GasPriceInfo,
  type GasStrategyConfig,
  type GasStrategyRegistry,
  MAX_GAS_LIMIT,
  PAYMASTER_POST_OP_GAS,
  PAYMASTER_VERIFICATION_GAS,
} from '@stablenet/core'

// Types
export type { UserOperationGasEstimation } from '@stablenet/sdk-types'

import type { BundlerClient, UserOperationGasEstimation } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'

/**
 * Convenience function to estimate gas for a UserOperation via bundler client.
 *
 * @param bundlerClient - Bundler client instance
 * @param userOp - Partial UserOperation (at minimum sender + callData)
 */
export async function estimateUserOperationGas(
  bundlerClient: BundlerClient,
  userOp: { sender: Address; callData: Hex } & Record<string, unknown>
): Promise<UserOperationGasEstimation> {
  return bundlerClient.estimateUserOperationGas(
    userOp as Parameters<BundlerClient['estimateUserOperationGas']>[0]
  )
}

/**
 * Gas Estimation Module
 *
 * Re-exports @stablenet/core's gas estimation infrastructure.
 * Provides convenience wrappers for common gas estimation patterns.
 */

// Gas estimation factory and types
export {
  createGasEstimator,
  createSmartAccountGasStrategy,
  type GasEstimator,
  type GasEstimatorConfig,
  type GasPriceInfo,
  type ERC20GasEstimate,
  type GasEstimationStrategy,
  type GasStrategyConfig,
  type GasStrategyRegistry,
} from '@stablenet/core'

// Gas constants
export {
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  PAYMASTER_VERIFICATION_GAS,
  PAYMASTER_POST_OP_GAS,
  GAS_BUFFER_MULTIPLIER,
  GAS_BUFFER_DIVISOR,
  MAX_GAS_LIMIT,
} from '@stablenet/core'

// Types
export type {
  UserOperationGasEstimation,
} from '@stablenet/sdk-types'

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
  return bundlerClient.estimateUserOperationGas(userOp as Parameters<BundlerClient['estimateUserOperationGas']>[0])
}

/**
 * Bundler Client Module
 *
 * Re-exports @stablenet/core's bundler client for ERC-4337 UserOperation management.
 * Provides full bundler RPC client with 7 standard methods.
 */

// Client factory
export { createBundlerClient } from '@stablenet/core'

// Types
export type {
  BundlerClient,
  BundlerClientConfig,
  UserOperationGasEstimation,
  UserOperationReceipt,
  WaitForUserOperationReceiptOptions,
} from '@stablenet/sdk-types'

// EntryPoint address constant
export { ENTRY_POINT_ADDRESS, ENTRY_POINT_V07_ADDRESS } from '@stablenet/sdk-types'

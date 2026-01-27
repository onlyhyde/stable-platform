/**
 * @stablenet/types - Shared Type Definitions
 *
 * Core types used across StableNet platform:
 * - ERC-4337 UserOperation types
 * - Network configuration types
 * - RPC error codes and types
 * - Smart Account types
 * - Bundler client types
 */

// Re-export viem types for convenience
export type { Address, Hex, Hash } from 'viem'

// Export original type modules
export * from './userOp'
export * from './network'
export * from './rpc'
export * from './token'

// User Operation types (from SDK)
export type {
  UserOperation,
  PartialUserOperation,
  PackedUserOperation,
  UserOperationReceipt,
  UserOperationLog,
  UserOperationGasEstimation,
  TransactionReceipt,
} from './userOperation'

// Smart Account types
export type {
  SmartAccount,
  Call,
  SmartAccountClientConfig,
  PaymasterClient,
  PaymasterStubData,
  PaymasterData,
  UserOperationMiddleware,
  Validator,
  KernelAccountConfig,
  SignerType,
  AccountFactoryConfig,
} from './smartAccount'

// Bundler types
export type {
  BundlerRpcMethod,
  BundlerClientConfig,
  BundlerClient,
  UserOperationWithTransactionHash,
  WaitForUserOperationReceiptOptions,
  BundlerRpcRequest,
  BundlerRpcResponse,
  BundlerRpcError,
} from './bundler'

// Constants
export {
  ENTRY_POINT_V07_ADDRESS,
  KERNEL_V3_1_FACTORY_ADDRESS,
  ECDSA_VALIDATOR_ADDRESS,
  KERNEL_ADDRESSES,
  MODULE_TYPE,
  EXEC_MODE,
  CALL_TYPE,
} from './constants'

export { BUNDLER_ERROR_CODES } from './bundler'

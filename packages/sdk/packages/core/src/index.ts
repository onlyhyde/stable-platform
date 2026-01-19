// Clients
export { createBundlerClient, BundlerError } from './clients/bundlerClient'
export {
  createSmartAccountClient,
  type SmartAccountClientActions,
  type SendUserOperationArgs,
  type SendTransactionArgs,
} from './clients/smartAccountClient'

// Utils
export {
  packUserOperation,
  unpackUserOperation,
  getUserOperationHash,
} from './utils/userOperation'

// Re-export types for convenience
export type {
  UserOperation,
  PartialUserOperation,
  PackedUserOperation,
  UserOperationReceipt,
  UserOperationGasEstimation,
  SmartAccount,
  Call,
  SmartAccountClientConfig,
  PaymasterClient,
  PaymasterStubData,
  PaymasterData,
  Validator,
  BundlerClient,
  BundlerClientConfig,
} from '@stablenet/types'

export {
  ENTRY_POINT_V07_ADDRESS,
  KERNEL_V3_1_FACTORY_ADDRESS,
  ECDSA_VALIDATOR_ADDRESS,
  KERNEL_ADDRESSES,
  MODULE_TYPE,
  EXEC_MODE,
  CALL_TYPE,
  BUNDLER_ERROR_CODES,
} from '@stablenet/types'

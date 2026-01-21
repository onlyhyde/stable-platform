import type { Address, Hex } from 'viem'

/**
 * UserOperation types for ERC-4337
 */

/**
 * User Operation v0.7 (Packed format)
 */
export interface UserOperation {
  sender: Address
  nonce: bigint
  factory?: Address
  factoryData?: Hex
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymaster?: Address
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
  paymasterData?: Hex
  signature: Hex
}

/**
 * User Operation for bundler submission
 */
export interface PackedUserOperation {
  sender: Address
  nonce: Hex
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex // verificationGasLimit || callGasLimit
  preVerificationGas: Hex
  gasFees: Hex // maxPriorityFeePerGas || maxFeePerGas
  paymasterAndData: Hex
  signature: Hex
}

/**
 * Gas estimate from bundler
 */
export interface UserOpGasEstimate {
  preVerificationGas: bigint
  verificationGasLimit: bigint
  callGasLimit: bigint
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
}

/**
 * Builder options
 */
export interface UserOpBuilderOptions {
  sender: Address
  nonce?: bigint
  factory?: Address
  factoryData?: Hex
  callData: Hex
  // Gas (optional, will be estimated if not provided)
  callGasLimit?: bigint
  verificationGasLimit?: bigint
  preVerificationGas?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  // Paymaster (optional)
  paymaster?: Address
  paymasterData?: Hex
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
}

/**
 * Execution call for batching
 */
export interface ExecutionCall {
  to: Address
  value: bigint
  data: Hex
}

/**
 * Bundler JSON-RPC types
 */
export interface BundlerRpcMethods {
  eth_sendUserOperation: [PackedUserOperation, Address]
  eth_estimateUserOperationGas: [PackedUserOperation, Address]
  eth_getUserOperationByHash: [Hex]
  eth_getUserOperationReceipt: [Hex]
  eth_supportedEntryPoints: []
}

export interface UserOperationReceipt {
  userOpHash: Hex
  entryPoint: Address
  sender: Address
  nonce: Hex
  paymaster?: Address
  actualGasCost: Hex
  actualGasUsed: Hex
  success: boolean
  reason?: string
  logs: Array<{
    address: Address
    topics: Hex[]
    data: Hex
  }>
  receipt: {
    transactionHash: Hex
    blockNumber: Hex
    blockHash: Hex
    gasUsed: Hex
  }
}

import type { Address, Hex } from 'viem'

/**
 * ERC-4337 UserOperation Types
 * Based on EntryPoint v0.7 specification
 */

/**
 * UserOperation v0.7 (Unpacked format)
 * Used internally before packing for bundler submission
 */
export interface UserOperation {
  /** Smart account address */
  sender: Address
  /** Account nonce */
  nonce: bigint
  /** Factory address for account creation (optional) */
  factory?: Address
  /** Factory initialization data (optional) */
  factoryData?: Hex
  /** Encoded call data to execute */
  callData: Hex
  /** Gas limit for execution phase */
  callGasLimit: bigint
  /** Gas limit for validation phase */
  verificationGasLimit: bigint
  /** Gas for pre-verification (covers calldata cost) */
  preVerificationGas: bigint
  /** Maximum fee per gas (EIP-1559) */
  maxFeePerGas: bigint
  /** Maximum priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas: bigint
  /** Paymaster address (optional) */
  paymaster?: Address
  /** Paymaster verification gas limit (required if paymaster set) */
  paymasterVerificationGasLimit?: bigint
  /** Paymaster post-op gas limit (required if paymaster set) */
  paymasterPostOpGasLimit?: bigint
  /** Paymaster-specific data (optional) */
  paymasterData?: Hex
  /** Signature over the UserOperation hash */
  signature: Hex
}

/**
 * Packed UserOperation for bundler RPC
 * Gas values and paymaster fields are packed into combined hex values
 */
export interface PackedUserOperation {
  /** Smart account address */
  sender: Address
  /** Account nonce (hex) */
  nonce: Hex
  /** Packed initCode: factory + factoryData (0x if none) */
  initCode: Hex
  /** Encoded call data */
  callData: Hex
  /** Packed gas limits: verificationGasLimit (16 bytes) || callGasLimit (16 bytes) */
  accountGasLimits: Hex
  /** Pre-verification gas (hex) */
  preVerificationGas: Hex
  /** Packed gas fees: maxPriorityFeePerGas (16 bytes) || maxFeePerGas (16 bytes) */
  gasFees: Hex
  /** Packed paymaster data: paymaster + verificationGasLimit + postOpGasLimit + paymasterData */
  paymasterAndData: Hex
  /** Signature */
  signature: Hex
}

/**
 * Gas estimation result from bundler
 */
export interface UserOpGasEstimate {
  /** Pre-verification gas */
  preVerificationGas: bigint
  /** Verification gas limit */
  verificationGasLimit: bigint
  /** Call gas limit */
  callGasLimit: bigint
  /** Paymaster verification gas limit (if paymaster) */
  paymasterVerificationGasLimit?: bigint
  /** Paymaster post-op gas limit (if paymaster) */
  paymasterPostOpGasLimit?: bigint
}

/**
 * UserOperation receipt from bundler
 */
export interface UserOperationReceipt {
  /** UserOperation hash */
  userOpHash: Hex
  /** EntryPoint address */
  entryPoint: Address
  /** Sender address */
  sender: Address
  /** Nonce */
  nonce: Hex
  /** Paymaster address (if used) */
  paymaster?: Address
  /** Actual gas cost in wei */
  actualGasCost: Hex
  /** Actual gas used */
  actualGasUsed: Hex
  /** Whether execution succeeded */
  success: boolean
  /** Revert reason (if failed) */
  reason?: string
  /** Logs emitted during execution */
  logs: UserOpLog[]
  /** Transaction receipt */
  receipt: {
    transactionHash: Hex
    blockNumber: Hex
    blockHash: Hex
    gasUsed: Hex
  }
}

/**
 * Log entry from UserOperation execution
 */
export interface UserOpLog {
  /** Contract address */
  address: Address
  /** Log topics */
  topics: Hex[]
  /** Log data */
  data: Hex
}

/**
 * UserOperation status in mempool
 */
export type UserOperationStatus = 'pending' | 'submitted' | 'included' | 'failed' | 'dropped'

/**
 * Builder options for creating UserOperations
 */
export interface UserOpBuilderOptions {
  /** Smart account address */
  sender: Address
  /** Nonce (auto-fetched if not provided) */
  nonce?: bigint
  /** Factory address for new accounts */
  factory?: Address
  /** Factory data for new accounts */
  factoryData?: Hex
  /** Call data to execute */
  callData: Hex
  /** Gas limits (estimated if not provided) */
  callGasLimit?: bigint
  verificationGasLimit?: bigint
  preVerificationGas?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  /** Paymaster configuration */
  paymaster?: Address
  paymasterData?: Hex
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
}

/**
 * Execution call for batching multiple calls
 */
export interface ExecutionCall {
  /** Target contract address */
  to: Address
  /** ETH value to send */
  value: bigint
  /** Call data */
  data: Hex
}

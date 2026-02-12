import type { Address, Hex } from 'viem'

/**
 * ERC-4337 UserOperation v0.7
 * @see https://eips.ethereum.org/EIPS/eip-4337
 */
export interface UserOperation {
  /** The account making the operation */
  sender: Address
  /** Anti-replay parameter */
  nonce: bigint
  /** Account factory address (for account creation) */
  factory?: Address
  /** Data for account factory */
  factoryData?: Hex
  /** The data to pass to the sender during the main execution call */
  callData: Hex
  /** The amount of gas to allocate the main execution call */
  callGasLimit: bigint
  /** The amount of gas to allocate for the verification step */
  verificationGasLimit: bigint
  /** The amount of gas to pay for to compensate the bundler for pre-verification execution */
  preVerificationGas: bigint
  /** Maximum fee per gas */
  maxFeePerGas: bigint
  /** Maximum priority fee per gas */
  maxPriorityFeePerGas: bigint
  /** Address of paymaster contract */
  paymaster?: Address
  /** Extra data to send to the paymaster for verification */
  paymasterVerificationGasLimit?: bigint
  /** Extra data to send to the paymaster for post-op */
  paymasterPostOpGasLimit?: bigint
  /** Data to send to the paymaster */
  paymasterData?: Hex
  /** Data passed into the account to verify authorization */
  signature: Hex
}

/**
 * Partial UserOperation for building
 */
export type PartialUserOperation = Partial<UserOperation> & {
  sender: Address
  callData: Hex
}

/**
 * UserOperation for RPC (hex string format)
 */
export interface PackedUserOperation {
  sender: Address
  nonce: Hex
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: Hex
  gasFees: Hex
  paymasterAndData: Hex
  signature: Hex
}

/**
 * UserOperation receipt
 */
export interface UserOperationReceipt {
  userOpHash: Hex
  entryPoint: Address
  sender: Address
  nonce: bigint
  paymaster?: Address
  actualGasCost: bigint
  actualGasUsed: bigint
  success: boolean
  reason?: string
  logs: UserOperationLog[]
  receipt: TransactionReceipt
}

/**
 * UserOperation log
 */
export interface UserOperationLog {
  logIndex: number
  transactionIndex: number
  transactionHash: Hex
  blockHash: Hex
  blockNumber: bigint
  address: Address
  data: Hex
  topics: Hex[]
}

/**
 * Transaction receipt (simplified)
 */
export interface TransactionReceipt {
  transactionHash: Hex
  transactionIndex: number
  blockHash: Hex
  blockNumber: bigint
  from: Address
  to?: Address
  cumulativeGasUsed: bigint
  gasUsed: bigint
  contractAddress?: Address
  logs: UserOperationLog[]
  status: 'success' | 'reverted'
  effectiveGasPrice: bigint
}

/**
 * Gas estimation result
 */
export interface UserOperationGasEstimation {
  preVerificationGas: bigint
  verificationGasLimit: bigint
  callGasLimit: bigint
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
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

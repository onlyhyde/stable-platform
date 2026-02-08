import type { Address, Hex } from 'viem'
import type {
  UserOperation,
  UserOperationGasEstimation,
  UserOperationReceipt,
} from './userOperation'

/**
 * Bundler RPC methods
 */
export type BundlerRpcMethod =
  | 'eth_sendUserOperation'
  | 'eth_estimateUserOperationGas'
  | 'eth_getUserOperationByHash'
  | 'eth_getUserOperationReceipt'
  | 'eth_supportedEntryPoints'
  | 'eth_chainId'

/**
 * Bundler client configuration
 */
export interface BundlerClientConfig {
  /** The bundler RPC URL */
  url: string
  /** The EntryPoint address to use (defaults to V0.7) */
  entryPoint?: Address
  /** The chain ID (optional, only needed for certain operations) */
  chainId?: bigint
}

/**
 * Bundler client interface
 */
export interface BundlerClient {
  /** Send a user operation to the bundler */
  sendUserOperation: (userOp: UserOperation) => Promise<Hex>
  /** Estimate gas for a user operation */
  estimateUserOperationGas: (
    userOp: Partial<UserOperation> & { sender: Address; callData: Hex }
  ) => Promise<UserOperationGasEstimation>
  /** Get a user operation by its hash */
  getUserOperationByHash: (hash: Hex) => Promise<UserOperationWithTransactionHash | null>
  /** Get the receipt of a user operation */
  getUserOperationReceipt: (hash: Hex) => Promise<UserOperationReceipt | null>
  /** Get the supported entry points */
  getSupportedEntryPoints: () => Promise<Address[]>
  /** Get the chain ID */
  getChainId: () => Promise<bigint>
  /** Wait for a user operation to be included */
  waitForUserOperationReceipt: (
    hash: Hex,
    options?: WaitForUserOperationReceiptOptions
  ) => Promise<UserOperationReceipt>
}

/**
 * User operation with transaction hash
 */
export interface UserOperationWithTransactionHash {
  userOperation: UserOperation
  entryPoint: Address
  transactionHash: Hex
  blockHash: Hex
  blockNumber: bigint
}

/**
 * Options for waiting for user operation receipt
 */
export interface WaitForUserOperationReceiptOptions {
  /** Polling interval in milliseconds */
  pollingInterval?: number
  /** Timeout in milliseconds */
  timeout?: number
  /** Number of confirmations to wait for */
  confirmations?: number
}

/**
 * Bundler RPC request
 */
export interface BundlerRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: BundlerRpcMethod
  params: unknown[]
}

/**
 * Bundler RPC response
 */
export interface BundlerRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number
  result?: T
  error?: BundlerRpcError
}

/**
 * Bundler RPC error
 */
export interface BundlerRpcError {
  code: number
  message: string
  data?: unknown
}

/**
 * Common bundler error codes
 */
export const BUNDLER_ERROR_CODES = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // ERC-4337 specific
  REJECTED_BY_EP_OR_ACCOUNT: -32500,
  REJECTED_BY_PAYMASTER: -32501,
  BANNED_OPCODE: -32502,
  SHORT_DEADLINE: -32503,
  BANNED_OR_THROTTLED: -32504,
  STAKE_OR_DELAY_TOO_LOW: -32505,
  UNSUPPORTED_AGGREGATOR: -32506,
  INVALID_SIGNATURE: -32507,
} as const

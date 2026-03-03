import type { Address, Hex } from 'viem'

/**
 * Bundler configuration
 */
export interface BundlerConfig {
  /** Network name */
  network: string
  /** Chain ID (overrides RPC-reported chainId when set) */
  chainId?: number
  /** Native currency symbol (default: ETH) */
  nativeCurrencySymbol: string
  /** RPC port */
  port: number
  /** EntryPoint addresses */
  entryPoints: Address[]
  /** Beneficiary address for bundle fees */
  beneficiary: Address
  /** RPC URL for the chain */
  rpcUrl: string
  /** Private key for signing bundles */
  privateKey: Hex
  /** Minimum balance for executor wallet */
  minBalance: bigint
  /** Bundle interval in milliseconds */
  bundleInterval: number
  /** Maximum operations per bundle */
  maxBundleSize: number
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  /** Enable debug mode */
  debug: boolean
  /** Maximum allowed nonce gap from on-chain nonce (default: 10) */
  maxNonceGap?: bigint
  /** Minimum seconds before validUntil for a valid operation (default: 30) */
  minValidUntilBuffer?: bigint
  /** Enable mempool nonce continuity validation (default: false) */
  validateNonceContinuity?: boolean
  /** Maximum nonce gap in mempool when continuity validation enabled (default: 0) */
  mempoolMaxNonceGap?: number
  /** CORS allowed origins (default: localhost only in production, all in debug mode) */
  corsOrigins?: string[]
  /** Enable ERC-7562 opcode validation (requires debug_traceCall support, default: true) */
  enableOpcodeValidation?: boolean
  /** Bundle submission strategy: 'direct' | 'flashbots' (default: 'direct') */
  bundleSubmissionStrategy?: 'direct' | 'flashbots'
  /** Flashbots relay URL (required when strategy is 'flashbots') */
  flashbotsRelayUrl?: string
  /** Flashbots auth key for signing relay requests (required when strategy is 'flashbots') */
  flashbotsAuthKey?: Hex
  /** Enable profitability checks before bundle submission (default: false) */
  enableProfitabilityCheck?: boolean
  /** Minimum net profit in wei to submit a bundle (default: 0) */
  minBundleProfit?: bigint
  /** Enable aggregator support for signature aggregation (EIP-4337 Section 15, default: false) */
  enableAggregation?: boolean
}

/**
 * UserOperation for ERC-4337 v0.9
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
 * Packed UserOperation for RPC
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
 * UserOperation status in mempool
 */
export type UserOperationStatus = 'pending' | 'submitted' | 'included' | 'failed' | 'dropped'

/**
 * Mempool entry
 */
export interface MempoolEntry {
  userOp: UserOperation
  userOpHash: Hex
  entryPoint: Address
  status: UserOperationStatus
  addedAt: number
  submittedAt?: number
  transactionHash?: Hex
  blockNumber?: bigint
  error?: string
  /** Aggregator address if this op uses signature aggregation */
  aggregator?: Address
}

/**
 * Gas estimation result
 */
export interface GasEstimation {
  preVerificationGas: bigint
  verificationGasLimit: bigint
  callGasLimit: bigint
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
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
  logs: Log[]
  receipt: TransactionReceipt
}

/**
 * Log entry
 */
export interface Log {
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
 * Transaction receipt
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
  logs: Log[]
  status: 'success' | 'reverted'
  effectiveGasPrice: bigint
}

/**
 * RPC error codes
 */
export const RPC_ERROR_CODES = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  PARSE_ERROR: -32700,
  // ERC-4337 specific
  REJECTED_BY_EP_OR_ACCOUNT: -32500,
  REJECTED_BY_PAYMASTER: -32501,
  BANNED_OPCODE: -32502,
  SHORT_DEADLINE: -32503,
  BANNED_OR_THROTTLED: -32504,
  STAKE_OR_UNSTAKE_DELAY: -32505,
  UNSUPPORTED_AGGREGATOR: -32506,
  INVALID_SIGNATURE: -32507,
} as const

/**
 * RPC error
 */
export class RpcError extends Error {
  code: number
  data?: unknown

  constructor(message: string, code: number, data?: unknown) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.data = data
  }
}

// Re-export validation types for convenience
export type {
  // Aggregator types
  AggregatorInfo,
  AggregatorValidationResult,
  IAggregatorValidator,
  PackedUserOperation as ValidationPackedUserOperation,
  ReputationConfig,
  ReputationEntry,
  ReputationStatus,
  ReturnInfo,
  StakeInfo,
  UserOpsPerAggregator,
  ValidationResult,
  ValidationResultWithAggregation,
} from '../validation/types'

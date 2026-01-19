import type { Address, Hex } from 'viem'

/**
 * Paymaster Proxy configuration
 */
export interface PaymasterProxyConfig {
  /** Server port */
  port: number
  /** Paymaster contract address */
  paymasterAddress: Address
  /** Signer private key for paymaster signatures */
  signerPrivateKey: Hex
  /** RPC URL for chain interaction */
  rpcUrl: string
  /** Supported chain IDs */
  supportedChainIds: number[]
  /** Enable debug mode */
  debug: boolean
}

/**
 * UserOperation for ERC-4337 v0.7 (JSON-RPC format)
 */
export interface UserOperationRpc {
  sender: Address
  nonce: Hex
  factory?: Address
  factoryData?: Hex
  callData: Hex
  callGasLimit: Hex
  verificationGasLimit: Hex
  preVerificationGas: Hex
  maxFeePerGas: Hex
  maxPriorityFeePerGas: Hex
  paymaster?: Address
  paymasterVerificationGasLimit?: Hex
  paymasterPostOpGasLimit?: Hex
  paymasterData?: Hex
  signature: Hex
}

/**
 * Packed UserOperation format
 */
export interface PackedUserOperationRpc {
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
 * JSON-RPC request
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params: unknown[]
}

/**
 * JSON-RPC response
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: JsonRpcError
}

/**
 * JSON-RPC error
 */
export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

/**
 * pm_getPaymasterStubData request params
 */
export interface GetPaymasterStubDataParams {
  /** UserOperation */
  userOp: UserOperationRpc | PackedUserOperationRpc
  /** EntryPoint address */
  entryPoint: Address
  /** Chain ID (hex) */
  chainId: Hex
  /** Optional context */
  context?: Record<string, unknown>
}

/**
 * pm_getPaymasterStubData response (ERC-4337 v0.7)
 */
export interface PaymasterStubDataResponse {
  paymaster: Address
  paymasterData: Hex
  paymasterVerificationGasLimit: Hex
  paymasterPostOpGasLimit: Hex
  /** Optional sponsor info */
  sponsor?: {
    name: string
    icon?: string
  }
  /** Whether this operation is sponsored */
  isFinal?: boolean
}

/**
 * pm_getPaymasterData request params
 */
export interface GetPaymasterDataParams {
  /** UserOperation with gas filled */
  userOp: UserOperationRpc | PackedUserOperationRpc
  /** EntryPoint address */
  entryPoint: Address
  /** Chain ID (hex) */
  chainId: Hex
  /** Optional context */
  context?: Record<string, unknown>
}

/**
 * pm_getPaymasterData response
 */
export interface PaymasterDataResponse {
  paymaster: Address
  paymasterData: Hex
}

/**
 * Sponsor policy configuration
 */
export interface SponsorPolicy {
  /** Policy ID */
  id: string
  /** Policy name */
  name: string
  /** Whether the policy is active */
  active: boolean
  /** Whitelist of sender addresses */
  whitelist?: Address[]
  /** Blacklist of sender addresses */
  blacklist?: Address[]
  /** Maximum gas limit per operation */
  maxGasLimit?: bigint
  /** Maximum total gas cost per operation (in wei) */
  maxGasCost?: bigint
  /** Daily spending limit per sender (in wei) */
  dailyLimitPerSender?: bigint
  /** Global daily spending limit (in wei) */
  globalDailyLimit?: bigint
  /** Allowed target contracts */
  allowedTargets?: Address[]
  /** Blocked target contracts */
  blockedTargets?: Address[]
  /** Start time (unix timestamp) */
  startTime?: number
  /** End time (unix timestamp) */
  endTime?: number
}

/**
 * Sponsor tracking data
 */
export interface SponsorTracker {
  /** Sender address */
  sender: Address
  /** Total gas spent today */
  dailyGasSpent: bigint
  /** Number of operations today */
  dailyOpCount: number
  /** Last reset date (YYYY-MM-DD) */
  lastResetDate: string
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
  // Paymaster specific
  REJECTED_BY_POLICY: -32001,
  UNSUPPORTED_CHAIN: -32002,
  UNSUPPORTED_ENTRY_POINT: -32003,
  RATE_LIMITED: -32004,
} as const

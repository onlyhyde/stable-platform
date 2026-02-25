import type { Address, Hex } from 'viem'

/**
 * Supported paymaster types
 */
export type PaymasterType = 'verifying' | 'erc20' | 'permit2' | 'sponsor'

/**
 * Paymaster addresses by type
 */
export type PaymasterAddresses = Partial<Record<PaymasterType, Address>>

/**
 * Paymaster Proxy configuration
 */
export interface PaymasterProxyConfig {
  /** Server port */
  port: number
  /** Paymaster contract address (backward compat: verifying paymaster) */
  paymasterAddress: Address
  /** Paymaster addresses by type */
  paymasterAddresses: PaymasterAddresses
  /** Signer private key for paymaster signatures */
  signerPrivateKey: Hex
  /** RPC URL for chain interaction */
  rpcUrl: string
  /** Supported chain IDs */
  supportedChainIds: number[]
  /** Enable debug mode */
  debug: boolean
  /** Supported EntryPoint addresses */
  supportedEntryPoints: Address[]
  /** Price oracle contract address */
  oracleAddress?: Address
  /** Permit2 contract address */
  permit2Address?: Address
  /** Bundler RPC URL (enables receipt-based settlement when set) */
  bundlerRpcUrl?: string
  /** Settlement polling interval in ms (default: 15000) */
  settlementPollMs?: number
  /** Explicitly enable/disable settlement (default: true when bundlerRpcUrl is set) */
  settlementEnabled?: boolean
}

/**
 * Supported ERC-20 token info
 */
export interface SupportedToken {
  /** Token contract address */
  address: Address
  /** Token symbol */
  symbol: string
  /** Token decimals */
  decimals: number
  /** Exchange rate (token per ETH, scaled by 1e18) */
  exchangeRate: string
}

/**
 * Token payment estimate
 */
export interface TokenPaymentEstimate {
  /** Token address used for payment */
  tokenAddress: Address
  /** Estimated token amount needed */
  estimatedAmount: string
  /** Exchange rate used */
  exchangeRate: string
  /** Markup percentage (basis points) */
  markup: number
}

/**
 * Sponsor policy response
 */
export interface SponsorPolicyResponse {
  /** Whether sponsoring is available for this sender */
  isAvailable: boolean
  /** Reason if not available */
  reason?: string
  /** Remaining daily limit in wei */
  dailyLimitRemaining?: string
  /** Per-transaction limit in wei */
  perTxLimit?: string
}

/**
 * Context parameter for paymaster type routing
 */
export interface PaymasterContext {
  /** Paymaster type to use */
  paymasterType?: PaymasterType

  /** Policy ID (verifying/sponsor) */
  policyId?: string

  // --- Sponsor-specific fields (type 1) ---
  /** Campaign ID (bytes32 hex) */
  campaignId?: Hex
  /** Per-user gas limit (wei, string for bigint) */
  perUserLimit?: string
  /** Allowed target contract address */
  targetContract?: Address
  /** Allowed function selector (bytes4 hex) */
  targetSelector?: Hex

  // --- ERC20-specific fields (type 2) ---
  /** Token address for payment */
  tokenAddress?: Address
  /** Maximum token cost (string for bigint) */
  maxTokenCost?: string
  /** Oracle quote ID (string for bigint) */
  quoteId?: string

  // --- Permit2-specific fields (type 3) ---
  /** Permit amount (uint160, string for bigint) */
  permitAmount?: string
  /** Permit expiration (uint48 timestamp) */
  permitExpiration?: number
  /** Permit nonce (uint48) */
  permitNonce?: number
  /** Permit2 signature (hex) */
  permitSig?: Hex
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
  context?: PaymasterContext
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
  context?: PaymasterContext
}

/**
 * pm_getPaymasterData response
 */
export interface PaymasterDataResponse {
  paymaster: Address
  paymasterData: Hex
  /** Reservation ID for accounting settlement (internal tracking) */
  reservationId?: string
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
 * Pending spending reservation
 */
export interface SpendingReservation {
  /** Unique reservation ID */
  id: string
  /** Estimated gas cost */
  amount: bigint
  /** Creation timestamp (ms) */
  createdAt: number
}

/**
 * Sponsor tracking data
 */
export interface SponsorTracker {
  /** Sender address */
  sender: Address
  /** Total gas spent today (confirmed) */
  dailyGasSpent: bigint
  /** Number of operations today */
  dailyOpCount: number
  /** Last reset date (YYYY-MM-DD) */
  lastResetDate: string
  /** Pending spending reservations */
  pendingReservations: SpendingReservation[]
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
  UNSUPPORTED_PAYMASTER_TYPE: -32005,
  UNSUPPORTED_TOKEN: -32006,
} as const

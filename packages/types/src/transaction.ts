import type { Address, Hex } from 'viem'

// ============================================================================
// EIP-7702 Types (re-defined here for types package independence)
// ============================================================================

/**
 * EIP-7702 Authorization structure
 */
export interface Authorization {
  chainId: bigint
  address: Address
  nonce: bigint
}

/**
 * Signed Authorization with ECDSA signature components
 */
export interface SignedAuthorization extends Authorization {
  v: number
  r: Hex
  s: Hex
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Transaction execution modes
 */
export const TRANSACTION_MODE = {
  /** Direct EOA transaction via eth_sendTransaction */
  EOA: 'eoa',
  /** EIP-7702 SetCode transaction for delegation */
  EIP7702: 'eip7702',
  /** Smart Account UserOperation via Bundler */
  SMART_ACCOUNT: 'smartAccount',
} as const

export type TransactionMode = (typeof TRANSACTION_MODE)[keyof typeof TRANSACTION_MODE]

/**
 * Gas payment strategies for Smart Account mode
 */
export const GAS_PAYMENT_TYPE = {
  /** Paymaster sponsors gas (free for user) */
  SPONSOR: 'sponsor',
  /** User pays with native token (ETH) */
  NATIVE: 'native',
  /** User pays with ERC20 token */
  ERC20: 'erc20',
} as const

export type GasPaymentType = (typeof GAS_PAYMENT_TYPE)[keyof typeof GAS_PAYMENT_TYPE]

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Gas payment configuration for Smart Account transactions
 */
export interface GasPaymentConfig {
  /** Payment strategy type */
  type: GasPaymentType

  /** ERC20 token address (required when type is 'erc20') */
  tokenAddress?: Address

  /** Token symbol for UI display */
  tokenSymbol?: string

  /** Token decimals for formatting */
  tokenDecimals?: number

  /** Estimated token amount for gas (in token's smallest unit) */
  estimatedAmount?: bigint
}

/**
 * Multi-mode transaction request
 * Unified interface for all transaction types
 */
export interface MultiModeTransactionRequest {
  /** Transaction execution mode */
  mode: TransactionMode

  /** Sender address */
  from: Address

  /** Recipient address */
  to: Address

  /** Value in wei */
  value: bigint

  /** Transaction calldata */
  data: Hex

  /** Chain ID */
  chainId?: number

  // ---- EOA/EIP-7702 specific ----

  /** Gas limit */
  gas?: bigint

  /** Max fee per gas (EIP-1559) */
  maxFeePerGas?: bigint

  /** Max priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: bigint

  /** Transaction nonce */
  nonce?: number

  // ---- EIP-7702 specific ----

  /** Authorization list for SetCode transaction */
  authorizationList?: SignedAuthorization[]

  // ---- Smart Account specific ----

  /** Gas payment configuration */
  gasPayment?: GasPaymentConfig
}

/**
 * Gas estimation result
 */
export interface GasEstimate {
  /** Estimated gas limit */
  gasLimit: bigint

  /** Max fee per gas */
  maxFeePerGas: bigint

  /** Max priority fee per gas */
  maxPriorityFeePerGas: bigint

  /** Total estimated cost in wei */
  estimatedCost: bigint

  /** Estimated cost in USD (optional) */
  estimatedCostUsd?: number

  // ---- Smart Account specific ----

  /** Pre-verification gas */
  preVerificationGas?: bigint

  /** Verification gas limit */
  verificationGasLimit?: bigint

  /** Call gas limit */
  callGasLimit?: bigint

  /** Paymaster verification gas limit */
  paymasterVerificationGasLimit?: bigint

  /** Paymaster post-op gas limit */
  paymasterPostOpGasLimit?: bigint

  /** EIP-4337 v0.9 unused gas penalty (10% of unused callGas + postOpGas above 40K threshold) */
  unusedGasPenalty?: bigint
}

/**
 * Transaction result
 */
export interface TransactionResult {
  /** Transaction hash (EOA/EIP-7702) or UserOp hash (Smart Account) */
  hash: Hex

  /** Transaction mode used */
  mode: TransactionMode

  /** Chain ID */
  chainId: number

  /** Timestamp when sent */
  timestamp: number
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if mode is EOA
 */
export function isEOAMode(mode: TransactionMode): mode is 'eoa' {
  return mode === TRANSACTION_MODE.EOA
}

/**
 * Check if mode is EIP-7702
 */
export function isEIP7702Mode(mode: TransactionMode): mode is 'eip7702' {
  return mode === TRANSACTION_MODE.EIP7702
}

/**
 * Check if mode is Smart Account
 */
export function isSmartAccountMode(mode: TransactionMode): mode is 'smartAccount' {
  return mode === TRANSACTION_MODE.SMART_ACCOUNT
}

/**
 * Check if gas payment is sponsor type
 */
export function isSponsoredGas(config?: GasPaymentConfig): boolean {
  return config?.type === GAS_PAYMENT_TYPE.SPONSOR
}

/**
 * Check if gas payment is ERC20 type
 */
export function isERC20Gas(
  config?: GasPaymentConfig
): config is GasPaymentConfig & { tokenAddress: Address } {
  return config?.type === GAS_PAYMENT_TYPE.ERC20 && !!config.tokenAddress
}

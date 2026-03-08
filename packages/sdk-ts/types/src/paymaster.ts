import type { Address, Hex } from 'viem'

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Extended Paymaster data returned from paymaster service
 * Extends the basic PaymasterData from smartAccount.ts with gas limits
 */
export interface ExtendedPaymasterData {
  /** Paymaster contract address */
  paymaster: Address

  /** Encoded paymaster data */
  paymasterData: Hex

  /** Gas limit for paymaster verification */
  paymasterVerificationGasLimit: bigint

  /** Gas limit for paymaster post-operation */
  paymasterPostOpGasLimit: bigint
}

/**
 * Supported token for ERC20 gas payment
 */
export interface SupportedToken {
  /** Token contract address */
  address: Address

  /** Token symbol */
  symbol: string

  /** Token decimals */
  decimals: number

  /** Exchange rate: tokens per 1 ETH (in token's smallest unit) */
  exchangeRate: bigint

  /** Optional: Token logo URL */
  logoUrl?: string
}

/**
 * Paymaster sponsor policy
 */
export interface SponsorPolicy {
  /** Whether sponsorship is available */
  isAvailable: boolean

  /** Reason if not available */
  reason?: string

  /** Daily limit remaining (in wei) */
  dailyLimitRemaining?: bigint

  /** Per-transaction limit (in wei) */
  perTxLimit?: bigint
}

/**
 * Paymaster client configuration
 */
export interface PaymasterClientConfig {
  /** Paymaster service URL */
  url: string

  /** Chain ID */
  chainId: number

  /** Optional: API key for authentication */
  apiKey?: string

  /** Optional: Request timeout in ms (default: 10000) */
  timeout?: number
}

/**
 * Paymaster RPC method names
 */
/**
 * EIP-4337 v0.9 PostOp mode
 *
 * v0.9 behavior change: if postOp reverts, EntryPoint does NOT re-call postOp.
 * Instead, the execution is reverted and the paymaster is charged from its prefund.
 */
export enum PostOpMode {
  /** UserOp execution succeeded */
  opSucceeded = 0,
  /** UserOp execution reverted (paymaster still pays gas) */
  opReverted = 1,
}

export const PAYMASTER_RPC_METHODS = {
  /** Get sponsored paymaster data */
  SPONSOR_USER_OPERATION: 'pm_sponsorUserOperation',
  /** Get paymaster data for ERC20 payment */
  GET_PAYMASTER_DATA: 'pm_getPaymasterData',
  /** Get supported tokens for gas payment */
  SUPPORTED_TOKENS: 'pm_supportedTokens',
  /** Get sponsor policy */
  GET_SPONSOR_POLICY: 'pm_getSponsorPolicy',
} as const

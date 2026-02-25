import type { Address, LocalAccount } from 'viem'

/**
 * Default validity window for paymaster signatures (1 hour)
 */
export const DEFAULT_VALIDITY_SECONDS = 3600

/**
 * Paymaster type string union (backward-compatible alias)
 * @deprecated Use PaymasterType enum (CorePaymasterType) from @stablenet/core instead
 */
export type PaymasterType = 'verifying' | 'erc20' | 'sponsor' | 'permit2'

/**
 * Verifying Paymaster configuration
 */
export interface VerifyingPaymasterConfig {
  /** The paymaster contract address */
  paymasterAddress: Address
  /** The signer account for signing paymaster data */
  signer: LocalAccount
  /** Chain ID */
  chainId: bigint
  /** EntryPoint address (required for domain separator computation) */
  entryPoint?: Address
  /** Validity window in seconds (default: 3600 = 1 hour) */
  validitySeconds?: number
}

/**
 * ERC20 Paymaster configuration
 */
export interface ERC20PaymasterConfig {
  /** The paymaster contract address */
  paymasterAddress: Address
  /** The ERC20 token address for gas payment */
  tokenAddress: Address
  /** Chain ID */
  chainId: bigint
}

/**
 * Sponsor Paymaster configuration (API-based)
 */
export interface SponsorPaymasterConfig {
  /** The paymaster API URL */
  paymasterUrl: string
  /** Optional API key */
  apiKey?: string
  /** Chain ID */
  chainId: bigint
}

/**
 * Permit2 Paymaster configuration
 */
export interface Permit2PaymasterConfig {
  /** The Permit2Paymaster contract address */
  paymasterAddress: Address
  /** The Permit2 contract address */
  permit2Address: Address
  /** The signer account for signing permits */
  signer: LocalAccount
  /** Chain ID */
  chainId: bigint
  /** The ERC20 token address for gas payment */
  tokenAddress: Address
  /** Optional: Permit validity in seconds (default: 3600) */
  validitySeconds?: number
  /** Optional: Custom nonce (auto-fetched if not provided) */
  nonce?: bigint
}

/**
 * Gas estimation response
 */
export interface PaymasterGasEstimation {
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
}

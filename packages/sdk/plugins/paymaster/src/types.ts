import type { Address, Hex, LocalAccount } from 'viem'
import type { UserOperation, PaymasterClient, PaymasterStubData, PaymasterData } from '@stablenet/types'

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
 * Paymaster type enum
 */
export type PaymasterType = 'verifying' | 'erc20' | 'sponsor'

/**
 * Gas estimation response
 */
export interface PaymasterGasEstimation {
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
}

/**
 * Verifying Paymaster data structure
 * [validUntil (6 bytes)][validAfter (6 bytes)][signature (65 bytes)]
 */
export interface VerifyingPaymasterData {
  validUntil: bigint
  validAfter: bigint
  signature: Hex
}

/**
 * ERC20 Paymaster data structure
 */
export interface ERC20PaymasterData {
  token: Address
  maxTokenCost: bigint
  priceMarkup: bigint
}

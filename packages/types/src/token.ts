import type { Address } from 'viem'

/**
 * Token Types
 */

/**
 * Token definition
 */
export interface TokenDefinition {
  /** Contract address (use zero address for native token) */
  address: Address
  /** Token name */
  name: string
  /** Token symbol */
  symbol: string
  /** Decimal places */
  decimals: number
  /** Logo URL (optional) */
  logoUrl?: string
  /** Chain ID this token belongs to */
  chainId?: number
}

/**
 * Token balance
 */
export interface TokenBalance {
  /** Token definition */
  token: TokenDefinition
  /** Balance in base units */
  balance: bigint
  /** Formatted balance as string */
  formatted: string
}

/**
 * Token approval
 */
export interface TokenApproval {
  /** Token address */
  token: Address
  /** Spender address */
  spender: Address
  /** Approved amount */
  amount: bigint
}

/**
 * ERC-20 token metadata
 */
export interface ERC20Metadata {
  /** Token name */
  name: string
  /** Token symbol */
  symbol: string
  /** Decimal places */
  decimals: number
  /** Total supply */
  totalSupply?: bigint
}

/**
 * Native currency constants
 */
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

/**
 * Check if address is native token
 */
export function isNativeToken(address: Address): boolean {
  return address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
}

/**
 * EIP-7702 Type Definitions
 *
 * Based on EIP-7702 specification: EOA Code Delegation
 */

import type { Address, Hex } from 'viem'

/**
 * EIP-7702 Authorization structure
 */
export interface Authorization {
  chainId: bigint
  address: Address // Delegate target contract
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

/**
 * Preset delegate contracts for Smart Account
 */
export interface DelegatePreset {
  name: string
  description: string
  address: Address
  features: string[]
}

/**
 * EIP-7702 delegation status
 */
export interface DelegationStatus {
  isDelegated: boolean
  delegateAddress: Address | null
  code: Hex | null
}

/**
 * EIP-7702 upgrade/revoke result
 */
export interface EIP7702Result {
  success: boolean
  transactionHash: Hex | null
  error?: string
}

/**
 * EIP-7702 SetCode transaction parameters
 */
export interface SetCodeTransactionParams {
  authorizationList: SignedAuthorization[]
  to?: Address
  data?: Hex
  value?: bigint
}

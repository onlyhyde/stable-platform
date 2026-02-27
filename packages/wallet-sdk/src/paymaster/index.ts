/**
 * Paymaster Client Module
 *
 * Re-exports @stablenet/core's paymaster client for gas sponsorship and ERC-20 payment.
 * Adds ERC-7677 compatible stub/data wrapper methods.
 */

import type { Address, Hex } from 'viem'

// Client factory
export { createPaymasterClient } from '@stablenet/core'

// Types from core
export type {
  ERC20PaymentEstimate,
  PartialUserOperationForPaymaster,
  PaymasterClientInstance,
  PaymasterResponse,
} from '@stablenet/core'

// Types from sdk-types
export type {
  PaymasterClientConfig,
  SponsorPolicy,
  SupportedToken,
} from '@stablenet/sdk-types'

// ============================================================================
// ERC-7677 Compatible Wrappers
// ============================================================================

/**
 * ERC-7677 stub data response for gas estimation
 */
export interface PaymasterStubDataResponse {
  paymaster: Address
  paymasterData: Hex
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
  isFinal: boolean
}

/**
 * ERC-7677 paymaster data response
 */
export interface PaymasterDataResponse {
  paymaster: Address
  paymasterData: Hex
}

/**
 * ERC-7677 UserOperation context for paymaster requests
 */
export interface PaymasterUserOpContext {
  sender: Address
  nonce: Hex
  callData: Hex
  callGasLimit: Hex
  verificationGasLimit: Hex
  preVerificationGas: Hex
  maxFeePerGas: Hex
  maxPriorityFeePerGas: Hex
  signature?: Hex
}

/**
 * Get paymaster stub data for gas estimation (ERC-7677: pm_getPaymasterStubData).
 *
 * Used during gas estimation phase — returns stub paymaster data so the bundler
 * can estimate gas limits. The returned data may not be final.
 *
 * @param paymasterUrl - Paymaster service URL
 * @param userOp - Partial UserOperation for estimation
 * @param entryPoint - EntryPoint address
 * @param chainId - Chain ID as hex
 */
export async function getPaymasterStubData(
  paymasterUrl: string,
  userOp: PaymasterUserOpContext,
  entryPoint: Address,
  chainId: Hex
): Promise<PaymasterStubDataResponse> {
  const response = await fetch(paymasterUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterStubData',
      params: [userOp, entryPoint, chainId],
    }),
  })

  const json = await response.json()

  if (json.error) {
    throw new Error(`pm_getPaymasterStubData failed: ${json.error.message}`)
  }

  const result = json.result
  return {
    paymaster: result.paymaster,
    paymasterData: result.paymasterData,
    paymasterVerificationGasLimit: BigInt(result.paymasterVerificationGasLimit ?? '0x0'),
    paymasterPostOpGasLimit: BigInt(result.paymasterPostOpGasLimit ?? '0x0'),
    isFinal: result.isFinal ?? false,
  }
}

/**
 * Get final paymaster data for submission (ERC-7677: pm_getPaymasterData).
 *
 * Called after gas estimation with final gas values. Returns the definitive
 * paymaster signature/data for the UserOperation.
 *
 * @param paymasterUrl - Paymaster service URL
 * @param userOp - Complete UserOperation with gas limits
 * @param entryPoint - EntryPoint address
 * @param chainId - Chain ID as hex
 */
export async function getPaymasterData(
  paymasterUrl: string,
  userOp: PaymasterUserOpContext,
  entryPoint: Address,
  chainId: Hex
): Promise<PaymasterDataResponse> {
  const response = await fetch(paymasterUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterData',
      params: [userOp, entryPoint, chainId],
    }),
  })

  const json = await response.json()

  if (json.error) {
    throw new Error(`pm_getPaymasterData failed: ${json.error.message}`)
  }

  return {
    paymaster: json.result.paymaster,
    paymasterData: json.result.paymasterData,
  }
}

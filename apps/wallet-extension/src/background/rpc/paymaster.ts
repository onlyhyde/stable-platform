/**
 * Paymaster interaction utilities
 *
 * Extracted from handler.ts to reduce file size and improve maintainability.
 */

import type { UserOperation } from '@stablenet/core'
import type { Address, Hex } from 'viem'
import { createLogger } from '../../shared/utils/logger'

const logger = createLogger('Paymaster')

/**
 * Send a JSON-RPC request to the paymaster-proxy service
 */
export async function fetchFromPaymaster(
  paymasterUrl: string,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const response = await fetch(paymasterUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  })

  if (!response.ok) {
    throw new Error(`Paymaster request failed: ${response.status}`)
  }

  const data = (await response.json()) as { result?: unknown; error?: { message?: string } }
  if (data.error) {
    throw new Error(data.error.message ?? 'Paymaster error')
  }

  return data.result
}

/**
 * Request paymaster sponsorship for a UserOperation
 * Returns sponsored fields or null if paymaster is unavailable (graceful fallback)
 */
export async function requestPaymasterSponsorship(
  paymasterUrl: string,
  userOp: UserOperation,
  entryPoint: Address,
  chainId: number
): Promise<{
  paymaster: Address
  paymasterData: Hex
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
} | null> {
  try {
    const chainIdHex = `0x${chainId.toString(16)}`

    // Convert UserOp fields to hex strings for JSON-RPC
    const userOpHex = {
      sender: userOp.sender,
      nonce: `0x${userOp.nonce.toString(16)}`,
      callData: userOp.callData,
      callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
      verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
      preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
      maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
      signature: userOp.signature,
      factory: userOp.factory ?? undefined,
      factoryData: userOp.factoryData ?? undefined,
    }

    // Step 1: Get stub data for gas estimation
    const stubResult = (await fetchFromPaymaster(paymasterUrl, 'pm_getPaymasterStubData', [
      userOpHex,
      entryPoint,
      chainIdHex,
    ])) as
      | {
          paymaster?: string
          paymasterData?: string
          paymasterVerificationGasLimit?: string
          paymasterPostOpGasLimit?: string
        }
      | undefined

    if (!stubResult?.paymaster) {
      return null
    }

    // Step 2: Get final signed paymaster data
    const finalResult = (await fetchFromPaymaster(paymasterUrl, 'pm_getPaymasterData', [
      {
        ...userOpHex,
        paymaster: stubResult.paymaster,
        paymasterData: stubResult.paymasterData ?? '0x',
        paymasterVerificationGasLimit: stubResult.paymasterVerificationGasLimit ?? '0x0',
        paymasterPostOpGasLimit: stubResult.paymasterPostOpGasLimit ?? '0x0',
      },
      entryPoint,
      chainIdHex,
    ])) as
      | {
          paymaster?: string
          paymasterData?: string
          paymasterVerificationGasLimit?: string
          paymasterPostOpGasLimit?: string
        }
      | undefined

    if (!finalResult?.paymaster) {
      return null
    }

    return {
      paymaster: finalResult.paymaster as Address,
      paymasterData: (finalResult.paymasterData ?? '0x') as Hex,
      paymasterVerificationGasLimit: BigInt(finalResult.paymasterVerificationGasLimit ?? '0'),
      paymasterPostOpGasLimit: BigInt(finalResult.paymasterPostOpGasLimit ?? '0'),
    }
  } catch (err) {
    logger.warn(
      `Paymaster sponsorship unavailable, falling back to self-pay: ${err instanceof Error ? err.message : String(err)}`
    )
    return null
  }
}

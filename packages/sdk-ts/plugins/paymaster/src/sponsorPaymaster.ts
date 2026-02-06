import type {
  PaymasterClient,
  PaymasterData,
  PaymasterStubData,
  UserOperation,
} from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import type { SponsorPaymasterConfig } from './types'

/**
 * Create a Sponsor Paymaster client (API-based)
 *
 * The SponsorPaymaster uses a backend API to get paymaster data.
 * The API handles the signature generation and policy enforcement.
 *
 * @example
 * ```ts
 * import { createSponsorPaymaster } from '@stablenet/plugin-paymaster'
 *
 * const paymaster = createSponsorPaymaster({
 *   paymasterUrl: 'https://paymaster.example.com',
 *   apiKey: 'your-api-key',
 *   chainId: 1n,
 * })
 * ```
 */
export function createSponsorPaymaster(config: SponsorPaymasterConfig): PaymasterClient {
  const { paymasterUrl, apiKey, chainId } = config

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (apiKey && apiKey.trim().length > 0) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  /**
   * Get stub data for gas estimation
   */
  const getPaymasterStubData = async (
    userOperation: UserOperation,
    entryPoint: Address,
    _chainId: bigint
  ): Promise<PaymasterStubData> => {
    const response = await fetch(`${paymasterUrl}/pm_getPaymasterStubData`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_getPaymasterStubData',
        params: [serializeUserOperation(userOperation), entryPoint, toHexString(chainId)],
      }),
    })

    if (!response.ok) {
      throw new Error(`Paymaster API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`Paymaster error: ${data.error.message}`)
    }

    const result = data.result as {
      paymaster: Address
      paymasterData: Hex
      paymasterVerificationGasLimit: string
      paymasterPostOpGasLimit: string
    }

    return {
      paymaster: result.paymaster,
      paymasterData: result.paymasterData,
      paymasterVerificationGasLimit: BigInt(result.paymasterVerificationGasLimit),
      paymasterPostOpGasLimit: BigInt(result.paymasterPostOpGasLimit),
    }
  }

  /**
   * Get paymaster data with signature
   */
  const getPaymasterData = async (
    userOperation: UserOperation,
    entryPoint: Address,
    _chainId: bigint
  ): Promise<PaymasterData> => {
    const response = await fetch(`${paymasterUrl}/pm_getPaymasterData`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_getPaymasterData',
        params: [serializeUserOperation(userOperation), entryPoint, toHexString(chainId)],
      }),
    })

    if (!response.ok) {
      throw new Error(`Paymaster API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`Paymaster error: ${data.error.message}`)
    }

    const result = data.result as {
      paymaster: Address
      paymasterData: Hex
    }

    return {
      paymaster: result.paymaster,
      paymasterData: result.paymasterData,
    }
  }

  return {
    getPaymasterStubData,
    getPaymasterData,
  }
}

/**
 * Serialize a UserOperation for JSON-RPC (ERC-4337 v0.7 format)
 */
function serializeUserOperation(userOp: UserOperation): Record<string, string> {
  return {
    sender: userOp.sender,
    nonce: toHexString(userOp.nonce),
    factory: userOp.factory || '',
    factoryData: userOp.factoryData || '0x',
    callData: userOp.callData,
    callGasLimit: toHexString(userOp.callGasLimit),
    verificationGasLimit: toHexString(userOp.verificationGasLimit),
    preVerificationGas: toHexString(userOp.preVerificationGas),
    maxFeePerGas: toHexString(userOp.maxFeePerGas),
    maxPriorityFeePerGas: toHexString(userOp.maxPriorityFeePerGas),
    paymaster: userOp.paymaster || '',
    paymasterData: userOp.paymasterData || '0x',
    paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit
      ? toHexString(userOp.paymasterVerificationGasLimit)
      : '0x0',
    paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit
      ? toHexString(userOp.paymasterPostOpGasLimit)
      : '0x0',
    signature: userOp.signature || '0x',
  }
}

/**
 * Convert bigint to hex string
 */
function toHexString(value: bigint): string {
  return `0x${value.toString(16)}`
}

/**
 * Create sponsor paymaster with sponsorship policy
 */
export interface SponsorshipPolicy {
  /** Policy ID from the paymaster service */
  policyId: string
  /** Optional metadata to include with requests */
  metadata?: Record<string, string>
}

export function createSponsorPaymasterWithPolicy(
  config: SponsorPaymasterConfig & { policy: SponsorshipPolicy }
): PaymasterClient {
  const basePaymaster = createSponsorPaymaster(config)
  const { policy: _policy } = config

  // Wrap the base methods to include policy (policy is available for future use)
  return {
    getPaymasterStubData: async (userOp, entryPoint, chainId) => {
      // The policy would be included in the API request in a real implementation
      return basePaymaster.getPaymasterStubData(userOp, entryPoint, chainId)
    },
    getPaymasterData: async (userOp, entryPoint, chainId) => {
      return basePaymaster.getPaymasterData(userOp, entryPoint, chainId)
    },
  }
}

/**
 * Paymaster Client
 *
 * Client for gas sponsorship and ERC20 payment via paymaster service.
 * Follows SRP: handles only paymaster-specific operations.
 * Follows DIP: uses JsonRpcClient abstraction for RPC communication.
 */

import type {
  GasPaymentConfig,
  PaymasterClientConfig,
  SponsorPolicy,
  SupportedToken,
} from '@stablenet/sdk-types'
import { GAS_PAYMENT_TYPE } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { createPaymasterRpcClient, type JsonRpcClient, RpcError } from './rpc'

// ============================================================================
// Types
// ============================================================================

/**
 * UserOperation for paymaster estimation
 * Subset of full UserOperation needed for paymaster
 */
export interface PartialUserOperationForPaymaster {
  sender: Address
  nonce: bigint
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/**
 * Paymaster service response
 */
export interface PaymasterResponse {
  /** Paymaster contract address */
  paymaster: Address

  /** Encoded paymaster data */
  paymasterData: Hex

  /** Verification gas limit */
  paymasterVerificationGasLimit: bigint

  /** Post-op gas limit */
  paymasterPostOpGasLimit: bigint
}

/**
 * ERC20 payment estimation response
 */
export interface ERC20PaymentEstimate {
  /** Token address */
  tokenAddress: Address

  /** Token symbol */
  symbol: string

  /** Token decimals */
  decimals: number

  /** Estimated token amount required */
  estimatedAmount: bigint

  /** Exchange rate (tokens per 1 ETH in wei) */
  exchangeRate: bigint

  /** Maximum slippage percentage */
  maxSlippage: number
}

// ============================================================================
// Raw Response Types
// ============================================================================

interface RawPaymasterResponse {
  paymaster: Address
  paymasterData: Hex
  paymasterVerificationGasLimit: string
  paymasterPostOpGasLimit: string
}

interface RawPaymasterWithTokenResponse extends RawPaymasterResponse {
  tokenAmount: string
}

interface RawSupportedToken {
  address: Address
  symbol: string
  decimals: number
  exchangeRate: string
  logoUrl?: string
}

interface RawERC20Estimate {
  tokenAddress: Address
  symbol: string
  decimals: number
  estimatedAmount: string
  exchangeRate: string
  maxSlippage: number
}

// ============================================================================
// Constants
// ============================================================================

/** Paymaster RPC method names */
const RPC_METHODS = {
  SPONSOR_USER_OPERATION: 'pm_sponsorUserOperation',
  GET_PAYMASTER_DATA: 'pm_getPaymasterData',
  SUPPORTED_TOKENS: 'pm_supportedTokens',
  GET_SPONSOR_POLICY: 'pm_getSponsorPolicy',
  ESTIMATE_ERC20_PAYMENT: 'pm_estimateERC20Payment',
} as const

// ============================================================================
// Paymaster Client Implementation
// ============================================================================

/**
 * Create a Paymaster client for gas sponsorship and ERC20 payment
 *
 * @example
 * ```typescript
 * const paymaster = createPaymasterClient({
 *   url: 'https://paymaster.example.com',
 *   chainId: 1,
 *   apiKey: 'your-api-key',
 * })
 *
 * // Get sponsored paymaster data
 * const data = await paymaster.getSponsoredPaymasterData(userOp)
 *
 * // Or pay with ERC20
 * const erc20Data = await paymaster.getERC20PaymasterData(userOp, tokenAddress)
 * ```
 */
export function createPaymasterClient(config: PaymasterClientConfig) {
  const { url, chainId, apiKey, timeout } = config

  // Use shared RPC client
  const rpcClient: JsonRpcClient = createPaymasterRpcClient(url, apiKey, { timeout })

  /**
   * Check if sponsor policy allows sponsorship
   */
  async function getSponsorPolicy(
    sender: Address,
    operation: 'transfer' | 'swap' | 'contract_call'
  ): Promise<SponsorPolicy> {
    return rpcClient.request<SponsorPolicy>(RPC_METHODS.GET_SPONSOR_POLICY, [
      sender,
      operation,
      chainId,
    ])
  }

  /**
   * Get paymaster data for sponsored (free) transaction
   */
  async function getSponsoredPaymasterData(
    userOp: PartialUserOperationForPaymaster
  ): Promise<PaymasterResponse> {
    // First check sponsor policy
    const policy = await getSponsorPolicy(userOp.sender, 'transfer')

    if (!policy.isAvailable) {
      throw new RpcError(
        'PAYMASTER_ERROR',
        `Sponsorship not available: ${policy.reason ?? 'Unknown reason'}`,
        { code: -33001, data: { reason: policy.reason } }
      )
    }

    const result = await rpcClient.request<RawPaymasterResponse>(
      RPC_METHODS.SPONSOR_USER_OPERATION,
      [formatUserOpForRpc(userOp), chainId]
    )

    return parsePaymasterResponse(result)
  }

  /**
   * Get supported ERC20 tokens for gas payment
   */
  async function getSupportedTokens(): Promise<SupportedToken[]> {
    const result = await rpcClient.request<RawSupportedToken[]>(RPC_METHODS.SUPPORTED_TOKENS, [
      chainId,
    ])

    return result.map((token) => ({
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      exchangeRate: BigInt(token.exchangeRate),
      logoUrl: token.logoUrl,
    }))
  }

  /**
   * Estimate ERC20 token amount for gas payment
   */
  async function estimateERC20Payment(
    userOp: PartialUserOperationForPaymaster,
    tokenAddress: Address
  ): Promise<ERC20PaymentEstimate> {
    const result = await rpcClient.request<RawERC20Estimate>(RPC_METHODS.ESTIMATE_ERC20_PAYMENT, [
      formatUserOpForRpc(userOp),
      tokenAddress,
      chainId,
    ])

    return {
      tokenAddress: result.tokenAddress,
      symbol: result.symbol,
      decimals: result.decimals,
      estimatedAmount: BigInt(result.estimatedAmount),
      exchangeRate: BigInt(result.exchangeRate),
      maxSlippage: result.maxSlippage,
    }
  }

  /**
   * Get paymaster data for ERC20 token payment
   */
  async function getERC20PaymasterData(
    userOp: PartialUserOperationForPaymaster,
    tokenAddress: Address
  ): Promise<PaymasterResponse & { tokenAmount: bigint }> {
    const result = await rpcClient.request<RawPaymasterWithTokenResponse>(
      RPC_METHODS.GET_PAYMASTER_DATA,
      [
        formatUserOpForRpc(userOp),
        {
          type: 'erc20',
          tokenAddress,
          chainId,
        },
      ]
    )

    return {
      ...parsePaymasterResponse(result),
      tokenAmount: BigInt(result.tokenAmount),
    }
  }

  /**
   * Get paymaster data based on gas payment configuration
   */
  async function getPaymasterData(
    userOp: PartialUserOperationForPaymaster,
    gasPayment: GasPaymentConfig
  ): Promise<PaymasterResponse | null> {
    switch (gasPayment.type) {
      case GAS_PAYMENT_TYPE.NATIVE:
        // No paymaster needed for native payment
        return null

      case GAS_PAYMENT_TYPE.SPONSOR:
        return getSponsoredPaymasterData(userOp)

      case GAS_PAYMENT_TYPE.ERC20:
        if (!gasPayment.tokenAddress) {
          throw new RpcError('PAYMASTER_ERROR', 'Token address required for ERC20 gas payment', {
            code: -33002,
          })
        }
        return getERC20PaymasterData(userOp, gasPayment.tokenAddress)

      default:
        throw new RpcError(
          'PAYMASTER_ERROR',
          `Unknown gas payment type: ${(gasPayment as GasPaymentConfig).type}`,
          { code: -33000 }
        )
    }
  }

  /**
   * Check if paymaster service is available
   */
  async function isAvailable(): Promise<boolean> {
    try {
      await getSupportedTokens()
      return true
    } catch {
      return false
    }
  }

  return {
    getSponsorPolicy,
    getSponsoredPaymasterData,
    getSupportedTokens,
    estimateERC20Payment,
    getERC20PaymasterData,
    getPaymasterData,
    isAvailable,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format UserOperation for RPC (convert bigints to hex strings)
 */
function formatUserOpForRpc(userOp: PartialUserOperationForPaymaster): Record<string, string> {
  return {
    sender: userOp.sender,
    nonce: toHexString(userOp.nonce),
    callData: userOp.callData,
    callGasLimit: toHexString(userOp.callGasLimit),
    verificationGasLimit: toHexString(userOp.verificationGasLimit),
    preVerificationGas: toHexString(userOp.preVerificationGas),
    maxFeePerGas: toHexString(userOp.maxFeePerGas),
    maxPriorityFeePerGas: toHexString(userOp.maxPriorityFeePerGas),
  }
}

/**
 * Convert bigint to hex string
 */
function toHexString(value: bigint): string {
  return `0x${value.toString(16)}`
}

/**
 * Parse raw paymaster response
 */
function parsePaymasterResponse(raw: RawPaymasterResponse): PaymasterResponse {
  return {
    paymaster: raw.paymaster,
    paymasterData: raw.paymasterData,
    paymasterVerificationGasLimit: BigInt(raw.paymasterVerificationGasLimit),
    paymasterPostOpGasLimit: BigInt(raw.paymasterPostOpGasLimit),
  }
}

// ============================================================================
// Exports
// ============================================================================

export type PaymasterClientInstance = ReturnType<typeof createPaymasterClient>

import type { Address, Hex } from 'viem'
import type {
  SupportedToken,
  SponsorPolicy,
  PaymasterClientConfig,
  GasPaymentConfig,
} from '@stablenet/types'
import { GAS_PAYMENT_TYPE } from '@stablenet/types'
import { createPaymasterError } from './errors'

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
// Constants
// ============================================================================

/** Default request timeout */
const DEFAULT_TIMEOUT = 10_000

/** Maximum retry attempts */
const MAX_RETRIES = 3

/** Retry delay in milliseconds */
const RETRY_DELAY = 1_000

/** Paymaster RPC method names */
const RPC_METHODS = {
  SPONSOR_USER_OPERATION: 'pm_sponsorUserOperation',
  GET_PAYMASTER_DATA: 'pm_getPaymasterData',
  SUPPORTED_TOKENS: 'pm_supportedTokens',
  GET_SPONSOR_POLICY: 'pm_getSponsorPolicy',
  ESTIMATE_ERC20_PAYMENT: 'pm_estimateERC20Payment',
} as const

// ============================================================================
// Paymaster Client
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
  const { url, chainId, apiKey, timeout = DEFAULT_TIMEOUT } = config

  /**
   * Make JSON-RPC request to paymaster service
   */
  async function rpcRequest<T>(
    method: string,
    params: unknown[],
    retries = MAX_RETRIES
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: Date.now(),
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw createPaymasterError(
          'HTTP_ERROR',
          `Paymaster HTTP error: ${response.status} ${response.statusText}`
        )
      }

      const result = await response.json()

      if (result.error) {
        throw createPaymasterError(
          'RPC_ERROR',
          `Paymaster RPC error: ${result.error.message}`,
          { rpcCode: result.error.code }
        )
      }

      return result.result as T
    } catch (error) {
      clearTimeout(timeoutId)

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw createPaymasterError(
          'TIMEOUT',
          `Paymaster request timeout after ${timeout}ms`
        )
      }

      // Retry logic for transient errors
      if (retries > 0 && isRetryableError(error)) {
        await sleep(RETRY_DELAY)
        return rpcRequest(method, params, retries - 1)
      }

      throw error
    }
  }

  /**
   * Check if sponsor policy allows sponsorship
   */
  async function getSponsorPolicy(
    sender: Address,
    operation: 'transfer' | 'swap' | 'contract_call'
  ): Promise<SponsorPolicy> {
    const result = await rpcRequest<SponsorPolicy>(
      RPC_METHODS.GET_SPONSOR_POLICY,
      [sender, operation, chainId]
    )

    return result
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
      throw createPaymasterError(
        'SPONSOR_NOT_AVAILABLE',
        `Sponsorship not available: ${policy.reason ?? 'Unknown reason'}`,
        { reason: policy.reason }
      )
    }

    const result = await rpcRequest<{
      paymaster: Address
      paymasterData: Hex
      paymasterVerificationGasLimit: string
      paymasterPostOpGasLimit: string
    }>(RPC_METHODS.SPONSOR_USER_OPERATION, [
      formatUserOpForRpc(userOp),
      chainId,
    ])

    return {
      paymaster: result.paymaster,
      paymasterData: result.paymasterData,
      paymasterVerificationGasLimit: BigInt(result.paymasterVerificationGasLimit),
      paymasterPostOpGasLimit: BigInt(result.paymasterPostOpGasLimit),
    }
  }

  /**
   * Get supported ERC20 tokens for gas payment
   */
  async function getSupportedTokens(): Promise<SupportedToken[]> {
    const result = await rpcRequest<Array<{
      address: Address
      symbol: string
      decimals: number
      exchangeRate: string
      logoUrl?: string
    }>>(RPC_METHODS.SUPPORTED_TOKENS, [chainId])

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
    const result = await rpcRequest<{
      tokenAddress: Address
      symbol: string
      decimals: number
      estimatedAmount: string
      exchangeRate: string
      maxSlippage: number
    }>(RPC_METHODS.ESTIMATE_ERC20_PAYMENT, [
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
    // First estimate the token amount
    const _estimate = await estimateERC20Payment(userOp, tokenAddress)

    const result = await rpcRequest<{
      paymaster: Address
      paymasterData: Hex
      paymasterVerificationGasLimit: string
      paymasterPostOpGasLimit: string
      tokenAmount: string
    }>(RPC_METHODS.GET_PAYMASTER_DATA, [
      formatUserOpForRpc(userOp),
      {
        type: 'erc20',
        tokenAddress,
        chainId,
      },
    ])

    return {
      paymaster: result.paymaster,
      paymasterData: result.paymasterData,
      paymasterVerificationGasLimit: BigInt(result.paymasterVerificationGasLimit),
      paymasterPostOpGasLimit: BigInt(result.paymasterPostOpGasLimit),
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
          throw createPaymasterError(
            'INVALID_CONFIG',
            'Token address required for ERC20 gas payment'
          )
        }
        return getERC20PaymasterData(userOp, gasPayment.tokenAddress)

      default:
        throw createPaymasterError(
          'INVALID_CONFIG',
          `Unknown gas payment type: ${(gasPayment as GasPaymentConfig).type}`
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
  return '0x' + value.toString(16)
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors, timeouts, etc.
    return (
      error.name === 'TypeError' ||
      error.message.includes('network') ||
      error.message.includes('fetch')
    )
  }
  return false
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Exports
// ============================================================================

export type PaymasterClientInstance = ReturnType<typeof createPaymasterClient>

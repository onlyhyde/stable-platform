import type { Address, PublicClient } from 'viem'
import { calculateTokenAmount, getTokenConfig, isTokenSupported } from '../chain/contracts'
import type { PackedUserOperationRpc, TokenPaymentEstimate, UserOperationRpc } from '../types'
import { estimateGasCost } from '../utils/gasEstimator'
import { normalizeUserOp } from '../utils/userOpNormalizer'
import { validateEntryPoint } from '../utils/validation'

export interface EstimateTokenPaymentConfig {
  client: PublicClient
  erc20PaymasterAddress: Address
  supportedChainIds: number[]
  supportedEntryPoints: Address[]
}

export type EstimateTokenPaymentResult =
  | { success: true; data: TokenPaymentEstimate }
  | { success: false; error: { code: number; message: string; data?: unknown } }

/**
 * Handle pm_estimateTokenPayment request
 *
 * Estimates how much ERC-20 token is needed to pay for a UserOperation's gas.
 */
export async function handleEstimateTokenPayment(
  userOp: UserOperationRpc | PackedUserOperationRpc,
  entryPoint: Address,
  chainId: string,
  tokenAddress: Address,
  config: EstimateTokenPaymentConfig
): Promise<EstimateTokenPaymentResult> {
  const chainIdNum = Number(chainId)
  if (!config.supportedChainIds.includes(chainIdNum)) {
    return {
      success: false,
      error: {
        code: -32002,
        message: `Chain ${chainIdNum} not supported`,
        data: { supportedChainIds: config.supportedChainIds },
      },
    }
  }

  const entryPointError = validateEntryPoint(entryPoint, config.supportedEntryPoints)
  if (entryPointError) {
    return { success: false, error: entryPointError }
  }

  try {
    const supported = await isTokenSupported(
      config.client,
      config.erc20PaymasterAddress,
      tokenAddress
    )
    if (!supported) {
      return {
        success: false,
        error: {
          code: -32006,
          message: `Token ${tokenAddress} is not supported`,
        },
      }
    }

    const normalized = normalizeUserOp(userOp)
    const estimatedGasCost = estimateGasCost(normalized)

    const [tokenAmount, tokenConfig] = await Promise.all([
      calculateTokenAmount(config.client, config.erc20PaymasterAddress, tokenAddress, estimatedGasCost),
      getTokenConfig(config.client, config.erc20PaymasterAddress, tokenAddress),
    ])

    return {
      success: true,
      data: {
        tokenAddress,
        estimatedAmount: tokenAmount.toString(),
        exchangeRate: '0', // Derived from on-chain calculation
        markup: tokenConfig.markup,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: -32603,
        message: `Failed to estimate token payment: ${error instanceof Error ? error.message : 'unknown error'}`,
      },
    }
  }
}


import type { Address, PublicClient } from 'viem'
import {
  calculateTokenAmount,
  getTokenConfig,
  getTokenPrice,
  isTokenSupported,
} from '../chain/contracts'
import type { PackedUserOperationRpc, TokenPaymentEstimate, UserOperationRpc } from '../types'
import { estimateGasCost } from '../utils/gasEstimator'
import { normalizeUserOp } from '../utils/userOpNormalizer'
import { validateEntryPoint } from '../utils/validation'

export interface EstimateTokenPaymentConfig {
  client: PublicClient
  erc20PaymasterAddress: Address
  oracleAddress?: Address
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
      calculateTokenAmount(
        config.client,
        config.erc20PaymasterAddress,
        tokenAddress,
        estimatedGasCost
      ),
      getTokenConfig(config.client, config.erc20PaymasterAddress, tokenAddress),
    ])

    // Fetch exchange rate from oracle if available
    let exchangeRate = '0'
    const oracleAddr = config.oracleAddress ?? tokenConfig.oracle
    if (oracleAddr && oracleAddr !== '0x0000000000000000000000000000000000000000') {
      try {
        exchangeRate = await getTokenPrice(config.client, oracleAddr, tokenAddress)
      } catch {
        // Oracle unavailable — fall back to computed ratio
        if (estimatedGasCost > 0n) {
          // ratio = tokenAmount * 1e18 / ethAmount (scaled to 18 decimals)
          exchangeRate = ((tokenAmount * 10n ** 18n) / estimatedGasCost).toString()
        }
      }
    } else if (estimatedGasCost > 0n) {
      // No oracle configured — derive from on-chain calculateTokenAmount result
      exchangeRate = ((tokenAmount * 10n ** 18n) / estimatedGasCost).toString()
    }

    return {
      success: true,
      data: {
        tokenAddress,
        estimatedAmount: tokenAmount.toString(),
        exchangeRate,
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

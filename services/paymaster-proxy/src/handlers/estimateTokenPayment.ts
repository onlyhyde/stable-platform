import type { Address, PublicClient } from 'viem'
import { calculateTokenAmount, getTokenConfig, isTokenSupported } from '../chain/contracts'
import type { PackedUserOperationRpc, TokenPaymentEstimate, UserOperationRpc } from '../types'

export interface EstimateTokenPaymentConfig {
  client: PublicClient
  erc20PaymasterAddress: Address
  supportedChainIds: number[]
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
  _entryPoint: Address,
  chainId: string,
  tokenAddress: Address,
  config: EstimateTokenPaymentConfig
): Promise<EstimateTokenPaymentResult> {
  const chainIdNum = Number.parseInt(chainId, 16)
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

function normalizeUserOp(userOp: UserOperationRpc | PackedUserOperationRpc): UserOperationRpc {
  if ('callGasLimit' in userOp) return userOp

  const packed = userOp as PackedUserOperationRpc
  const accountGasLimitsHex = packed.accountGasLimits.slice(2)
  const gasFeesHex = packed.gasFees.slice(2)

  return {
    sender: packed.sender,
    nonce: packed.nonce,
    callData: packed.callData,
    callGasLimit: `0x${accountGasLimitsHex.slice(32, 64)}` as `0x${string}`,
    verificationGasLimit: `0x${accountGasLimitsHex.slice(0, 32)}` as `0x${string}`,
    preVerificationGas: packed.preVerificationGas,
    maxFeePerGas: `0x${gasFeesHex.slice(32, 64)}` as `0x${string}`,
    maxPriorityFeePerGas: `0x${gasFeesHex.slice(0, 32)}` as `0x${string}`,
    signature: packed.signature,
  }
}

function estimateGasCost(userOp: UserOperationRpc): bigint {
  const totalGas =
    BigInt(userOp.callGasLimit) +
    BigInt(userOp.verificationGasLimit) +
    BigInt(userOp.preVerificationGas)
  return totalGas * BigInt(userOp.maxFeePerGas)
}

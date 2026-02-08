import type { Address, Hex } from 'viem'
import type { SponsorPolicyManager } from '../policy/sponsorPolicy'
import type { PaymasterSigner } from '../signer/paymasterSigner'
import type {
  GetPaymasterDataParams,
  PackedUserOperationRpc,
  PaymasterDataResponse,
  UserOperationRpc,
} from '../types'

export type { GetPaymasterDataParams }

/**
 * Handler configuration
 */
export interface GetPaymasterDataConfig {
  paymasterAddress: Address
  signer: PaymasterSigner
  policyManager: SponsorPolicyManager
  supportedChainIds: number[]
  supportedEntryPoints?: Address[]
}

/**
 * Handler result
 */
export type GetPaymasterDataResult =
  | { success: true; data: PaymasterDataResponse }
  | { success: false; error: { code: number; message: string; data?: unknown } }

/**
 * Handle pm_getPaymasterData request
 *
 * This method returns final paymaster data with actual signature
 * that can be used to submit the UserOperation.
 */
export async function handleGetPaymasterData(
  params: GetPaymasterDataParams,
  config: GetPaymasterDataConfig
): Promise<GetPaymasterDataResult> {
  const { userOp, entryPoint, chainId, context } = params
  const { paymasterAddress, signer, policyManager, supportedChainIds, supportedEntryPoints } =
    config

  // Validate chain ID
  const chainIdNum = Number.parseInt(chainId, 16)
  if (!supportedChainIds.includes(chainIdNum)) {
    return {
      success: false,
      error: {
        code: -32002,
        message: `Chain ${chainIdNum} not supported`,
        data: { supportedChainIds },
      },
    }
  }

  // Validate entry point (if configured)
  if (supportedEntryPoints && supportedEntryPoints.length > 0) {
    const entryPointLower = entryPoint.toLowerCase()
    const isSupported = supportedEntryPoints.some((ep) => ep.toLowerCase() === entryPointLower)
    if (!isSupported) {
      return {
        success: false,
        error: {
          code: -32003,
          message: 'EntryPoint not supported',
          data: { supportedEntryPoints },
        },
      }
    }
  }

  // Get policy ID from context
  const policyId = (context?.policyId as string) || 'default'

  // Estimate gas cost for policy check
  const normalizedUserOp = normalizeUserOp(userOp)
  const estimatedGasCost = estimateGasCost(normalizedUserOp)

  // Check policy with gas cost
  const policyResult = policyManager.checkPolicy(normalizedUserOp, policyId, estimatedGasCost)

  if (!policyResult.allowed) {
    return {
      success: false,
      error: policyResult.rejection,
    }
  }

  // Generate signed paymaster data
  const { paymasterData } = await signer.generateSignedData(userOp, entryPoint, BigInt(chainIdNum))

  // Record spending (gas cost will be finalized after execution)
  // For now, we record the estimated cost
  policyManager.recordSpending(normalizedUserOp.sender, estimatedGasCost)

  return {
    success: true,
    data: {
      paymaster: paymasterAddress,
      paymasterData,
    },
  }
}

/**
 * Normalize UserOperation to unpacked format
 */
function normalizeUserOp(userOp: UserOperationRpc | PackedUserOperationRpc): UserOperationRpc {
  if ('callGasLimit' in userOp) {
    return userOp
  }

  // Convert packed to unpacked format
  const packed = userOp as PackedUserOperationRpc

  // Extract gas limits from accountGasLimits
  const accountGasLimitsHex = packed.accountGasLimits.slice(2)
  const verificationGasLimit = `0x${accountGasLimitsHex.slice(0, 32)}`
  const callGasLimit = `0x${accountGasLimitsHex.slice(32, 64)}`

  // Extract gas fees
  const gasFeesHex = packed.gasFees.slice(2)
  const maxPriorityFeePerGas = `0x${gasFeesHex.slice(0, 32)}`
  const maxFeePerGas = `0x${gasFeesHex.slice(32, 64)}`

  // Extract factory from initCode
  let factory: Address | undefined
  let factoryData: Hex | undefined
  if (packed.initCode && packed.initCode !== '0x' && packed.initCode.length > 2) {
    factory = `0x${packed.initCode.slice(2, 42)}` as Address
    factoryData = `0x${packed.initCode.slice(42)}` as Hex
  }

  return {
    sender: packed.sender,
    nonce: packed.nonce,
    factory,
    factoryData,
    callData: packed.callData,
    callGasLimit: callGasLimit as Hex,
    verificationGasLimit: verificationGasLimit as Hex,
    preVerificationGas: packed.preVerificationGas,
    maxFeePerGas: maxFeePerGas as Hex,
    maxPriorityFeePerGas: maxPriorityFeePerGas as Hex,
    signature: packed.signature,
  }
}

/**
 * Estimate gas cost for a UserOperation
 */
function estimateGasCost(userOp: UserOperationRpc): bigint {
  const totalGas =
    BigInt(userOp.callGasLimit) +
    BigInt(userOp.verificationGasLimit) +
    BigInt(userOp.preVerificationGas)

  const maxFeePerGas = BigInt(userOp.maxFeePerGas)

  return totalGas * maxFeePerGas
}

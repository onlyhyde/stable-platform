import type { Address, Hex } from 'viem'
import type {
  UserOperationRpc,
  PackedUserOperationRpc,
  PaymasterStubDataResponse,
  GetPaymasterStubDataParams,
} from '../types'
import type { PaymasterSigner } from '../signer/paymasterSigner'
import type { SponsorPolicyManager } from '../policy/sponsorPolicy'

export type { GetPaymasterStubDataParams }

/**
 * Default gas limits for paymaster operations
 */
const DEFAULT_GAS_LIMITS = {
  paymasterVerificationGasLimit: 100000n,
  paymasterPostOpGasLimit: 50000n,
} as const

/**
 * Handler configuration
 */
export interface GetPaymasterStubDataConfig {
  paymasterAddress: Address
  signer: PaymasterSigner
  policyManager: SponsorPolicyManager
  supportedChainIds: number[]
  supportedEntryPoints?: Address[]
  sponsorName?: string
  sponsorIcon?: string
}

/**
 * Handler result
 */
export type GetPaymasterStubDataResult =
  | { success: true; data: PaymasterStubDataResponse }
  | { success: false; error: { code: number; message: string; data?: unknown } }

/**
 * Handle pm_getPaymasterStubData request
 *
 * This method returns stub paymaster data that can be used for gas estimation.
 * The returned data includes placeholder signature that will be replaced
 * with actual signature in pm_getPaymasterData.
 */
export function handleGetPaymasterStubData(
  params: GetPaymasterStubDataParams,
  config: GetPaymasterStubDataConfig
): GetPaymasterStubDataResult {
  const { userOp, entryPoint, chainId, context } = params
  const {
    paymasterAddress,
    signer,
    policyManager,
    supportedChainIds,
    supportedEntryPoints,
    sponsorName,
    sponsorIcon,
  } = config

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
    const isSupported = supportedEntryPoints.some(
      (ep) => ep.toLowerCase() === entryPointLower
    )
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

  // Check policy (without gas cost estimation for stub data)
  const normalizedUserOp = normalizeUserOp(userOp)
  const policyResult = policyManager.checkPolicy(normalizedUserOp, policyId)

  if (!policyResult.allowed) {
    return {
      success: false,
      error: policyResult.rejection,
    }
  }

  // Generate stub paymaster data
  const { paymasterData } = signer.generateStubData()

  const response: PaymasterStubDataResponse = {
    paymaster: paymasterAddress,
    paymasterData,
    paymasterVerificationGasLimit: `0x${DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit.toString(16)}`,
    paymasterPostOpGasLimit: `0x${DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit.toString(16)}`,
    isFinal: false,
  }

  // Add sponsor info if configured
  if (sponsorName) {
    response.sponsor = {
      name: sponsorName,
      icon: sponsorIcon,
    }
  }

  return {
    success: true,
    data: response,
  }
}

/**
 * Normalize UserOperation to unpacked format for policy checking
 */
function normalizeUserOp(
  userOp: UserOperationRpc | PackedUserOperationRpc
): UserOperationRpc {
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

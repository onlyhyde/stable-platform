import type { Address, Hex } from 'viem'
import type { SponsorPolicyManager } from '../policy/sponsorPolicy'
import type { PaymasterSigner } from '../signer/paymasterSigner'
import type {
  GetPaymasterDataParams,
  PackedUserOperationRpc,
  PaymasterAddresses,
  PaymasterContext,
  PaymasterDataResponse,
  PaymasterType,
  UserOperationRpc,
} from '../types'

export type { GetPaymasterDataParams }

/**
 * Handler configuration
 */
export interface GetPaymasterDataConfig {
  paymasterAddress: Address
  paymasterAddresses: PaymasterAddresses
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
 * Routes to the appropriate paymaster type based on context.paymasterType.
 * Returns final paymaster data with actual signature (for verifying/sponsor)
 * or encoded token data (for erc20/permit2).
 */
export async function handleGetPaymasterData(
  params: GetPaymasterDataParams,
  config: GetPaymasterDataConfig
): Promise<GetPaymasterDataResult> {
  const { entryPoint, chainId, context } = params
  const { supportedChainIds, supportedEntryPoints } = config

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

  const paymasterType = resolvePaymasterType(context)
  return routePaymasterData(paymasterType, params, config)
}

/**
 * Resolve paymaster type from context, defaulting to 'verifying'
 */
function resolvePaymasterType(context?: PaymasterContext): PaymasterType {
  return context?.paymasterType ?? 'verifying'
}

/**
 * Route to appropriate paymaster data handler based on type
 */
async function routePaymasterData(
  type: PaymasterType,
  params: GetPaymasterDataParams,
  config: GetPaymasterDataConfig
): Promise<GetPaymasterDataResult> {
  const address = config.paymasterAddresses[type]
  if (!address) {
    return {
      success: false,
      error: {
        code: -32005,
        message: `Paymaster type '${type}' not configured`,
      },
    }
  }

  switch (type) {
    case 'verifying':
    case 'sponsor':
      return handleVerifyingData(params, config, address)
    case 'erc20':
      return handleErc20Data(params, address)
    case 'permit2':
      return handlePermit2Data(address)
  }
}

/**
 * Verifying/Sponsor paymaster data (signature-based)
 */
async function handleVerifyingData(
  params: GetPaymasterDataParams,
  config: GetPaymasterDataConfig,
  paymasterAddress: Address
): Promise<GetPaymasterDataResult> {
  const { userOp, entryPoint, chainId, context } = params
  const { signer, policyManager } = config

  const policyId = (context?.policyId as string) || 'default'
  const normalizedUserOp = normalizeUserOp(userOp)
  const estimatedGasCost = estimateGasCost(normalizedUserOp)

  const policyResult = policyManager.checkPolicy(normalizedUserOp, policyId, estimatedGasCost)
  if (!policyResult.allowed) {
    return { success: false, error: policyResult.rejection }
  }

  const chainIdNum = Number.parseInt(chainId, 16)
  const { paymasterData } = await signer.generateSignedData(
    userOp,
    entryPoint,
    BigInt(chainIdNum)
  )

  policyManager.recordSpending(normalizedUserOp.sender, estimatedGasCost)

  return {
    success: true,
    data: { paymaster: paymasterAddress, paymasterData },
  }
}

/**
 * ERC20 paymaster data
 * paymasterData = tokenAddress (no signature needed, on-chain verification)
 */
function handleErc20Data(
  params: GetPaymasterDataParams,
  paymasterAddress: Address
): GetPaymasterDataResult {
  const { context } = params
  const tokenAddress = context?.tokenAddress

  if (!tokenAddress) {
    return {
      success: false,
      error: {
        code: -32602,
        message: 'tokenAddress required in context for erc20 paymaster',
      },
    }
  }

  return {
    success: true,
    data: {
      paymaster: paymasterAddress,
      paymasterData: tokenAddress.toLowerCase() as Hex,
    },
  }
}

/**
 * Permit2 paymaster data
 * Proxy only returns paymaster address. Actual permit data is generated client-side.
 */
function handlePermit2Data(paymasterAddress: Address): GetPaymasterDataResult {
  return {
    success: true,
    data: {
      paymaster: paymasterAddress,
      paymasterData: '0x' as Hex,
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

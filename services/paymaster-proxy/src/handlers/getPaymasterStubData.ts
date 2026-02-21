import type { Address, Hex } from 'viem'
import type { SponsorPolicyManager } from '../policy/sponsorPolicy'
import type { PaymasterSigner } from '../signer/paymasterSigner'
import type {
  GetPaymasterStubDataParams,
  PackedUserOperationRpc,
  PaymasterAddresses,
  PaymasterContext,
  PaymasterStubDataResponse,
  PaymasterType,
  UserOperationRpc,
} from '../types'

export type { GetPaymasterStubDataParams }

/**
 * Default gas limits for paymaster operations
 */
const DEFAULT_GAS_LIMITS = {
  verifying: { verification: 100000n, postOp: 50000n },
  sponsor: { verification: 100000n, postOp: 50000n },
  erc20: { verification: 150000n, postOp: 100000n },
  permit2: { verification: 200000n, postOp: 100000n },
} as const

/**
 * Handler configuration
 */
export interface GetPaymasterStubDataConfig {
  paymasterAddress: Address
  paymasterAddresses: PaymasterAddresses
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
 * Routes to the appropriate paymaster type based on context.paymasterType.
 * Returns stub paymaster data for gas estimation.
 */
export function handleGetPaymasterStubData(
  params: GetPaymasterStubDataParams,
  config: GetPaymasterStubDataConfig
): GetPaymasterStubDataResult {
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
  return routeStubData(paymasterType, params, config)
}

/**
 * Resolve paymaster type from context, defaulting to 'verifying'
 */
function resolvePaymasterType(context?: PaymasterContext): PaymasterType {
  return context?.paymasterType ?? 'verifying'
}

/**
 * Route to appropriate stub data handler based on type
 */
function routeStubData(
  type: PaymasterType,
  params: GetPaymasterStubDataParams,
  config: GetPaymasterStubDataConfig
): GetPaymasterStubDataResult {
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
      return handleVerifyingStubData(params, config, address, type)
    case 'erc20':
      return handleErc20StubData(params, config, address)
    case 'permit2':
      return handlePermit2StubData(params, config, address)
  }
}

/**
 * Verifying/Sponsor paymaster stub data (signature-based)
 */
function handleVerifyingStubData(
  params: GetPaymasterStubDataParams,
  config: GetPaymasterStubDataConfig,
  paymasterAddress: Address,
  type: PaymasterType
): GetPaymasterStubDataResult {
  const { userOp, context } = params
  const { signer, policyManager, sponsorName, sponsorIcon } = config

  const policyId = (context?.policyId as string) || 'default'
  const normalizedUserOp = normalizeUserOp(userOp)
  const policyResult = policyManager.checkPolicy(normalizedUserOp, policyId)

  if (!policyResult.allowed) {
    return { success: false, error: policyResult.rejection }
  }

  const { paymasterData } = signer.generateStubData()
  const gasLimits = DEFAULT_GAS_LIMITS[type]

  const response: PaymasterStubDataResponse = {
    paymaster: paymasterAddress,
    paymasterData,
    paymasterVerificationGasLimit: `0x${gasLimits.verification.toString(16)}`,
    paymasterPostOpGasLimit: `0x${gasLimits.postOp.toString(16)}`,
    isFinal: false,
  }

  if (sponsorName) {
    response.sponsor = { name: sponsorName, icon: sponsorIcon }
  }

  return { success: true, data: response }
}

/**
 * ERC20 paymaster stub data
 * encodes tokenAddress in paymasterData
 */
function handleErc20StubData(
  params: GetPaymasterStubDataParams,
  config: GetPaymasterStubDataConfig,
  paymasterAddress: Address
): GetPaymasterStubDataResult {
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

  // paymasterData = token address (20 bytes, no 0x prefix padding needed)
  const paymasterData = tokenAddress.toLowerCase() as Hex
  const gasLimits = DEFAULT_GAS_LIMITS.erc20

  return {
    success: true,
    data: {
      paymaster: paymasterAddress,
      paymasterData,
      paymasterVerificationGasLimit: `0x${gasLimits.verification.toString(16)}`,
      paymasterPostOpGasLimit: `0x${gasLimits.postOp.toString(16)}`,
      isFinal: false,
    },
  }
}

/**
 * Permit2 paymaster stub data
 * Returns paymaster address + high gas limits. Actual paymasterData is generated client-side.
 */
function handlePermit2StubData(
  _params: GetPaymasterStubDataParams,
  _config: GetPaymasterStubDataConfig,
  paymasterAddress: Address
): GetPaymasterStubDataResult {
  const gasLimits = DEFAULT_GAS_LIMITS.permit2

  return {
    success: true,
    data: {
      paymaster: paymasterAddress,
      paymasterData: '0x' as Hex,
      paymasterVerificationGasLimit: `0x${gasLimits.verification.toString(16)}`,
      paymasterPostOpGasLimit: `0x${gasLimits.postOp.toString(16)}`,
      isFinal: false,
    },
  }
}

/**
 * Normalize UserOperation to unpacked format for policy checking
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

import type { Address, Hex } from 'viem'
import {
  PaymasterType as PaymasterTypeEnum,
  encodePaymasterData,
  encodeSponsorPayload,
  encodeErc20Payload,
  encodeVerifyingPayload,
  // encodePermit2Payload intentionally not imported: Permit2 stub returns
  // empty paymasterData; user builds the full envelope client-side via SDK.
} from '@stablenet/core'
import type { SponsorPolicyManager } from '../policy/sponsorPolicy'
import type { PaymasterSigner } from '../signer/paymasterSigner'
import type {
  GetPaymasterStubDataParams,
  PaymasterAddresses,
  PaymasterContext,
  PaymasterStubDataResponse,
  PaymasterType,
} from '../types'
import { normalizeUserOp } from '../utils/userOpNormalizer'
import { toPolicyIdBytes32, validateChainId, validateEntryPoint, validateTimeRange } from '../utils/validation'

export type { GetPaymasterStubDataParams }

/** Default validity window for non-signed envelope types (ERC20) */
const DEFAULT_VALID_UNTIL_SECONDS = 300
const DEFAULT_CLOCK_SKEW_SECONDS = 60

/**
 * Base gas limits for paymaster operations.
 * These serve as minimum floors; actual limits are adjusted dynamically
 * based on paymaster type complexity and UserOperation characteristics.
 */
const BASE_GAS_LIMITS = {
  verifying: { verification: 100_000n, postOp: 50_000n },
  sponsor: { verification: 100_000n, postOp: 50_000n },
  erc20: { verification: 150_000n, postOp: 100_000n },
  permit2: { verification: 200_000n, postOp: 100_000n },
} as const

/**
 * Gas overhead per complexity factor (additive to base)
 */
const GAS_OVERHEAD = {
  /** Extra verification gas when factory (account deployment) is present */
  factoryDeployment: 50_000n,
  /** Extra verification gas for large paymasterData (>256 bytes) */
  largePaymasterData: 30_000n,
  /** Extra postOp gas for token transfer operations (ERC20/Permit2) */
  tokenPostOp: 50_000n,
  /** Extra verification gas for large callData (>1KB) */
  largeCallData: 20_000n,
} as const

/**
 * Estimate gas limits dynamically based on paymaster type and UserOperation context.
 *
 * Adjusts base limits upward when the operation involves:
 * - Account deployment (factory present → higher verification gas)
 * - Large callData (>1KB → higher verification gas for hashing)
 * - Token operations (ERC20/Permit2 → higher postOp for transfers)
 */
function estimateGasLimits(
  type: PaymasterType,
  userOp?: { factory?: string; callData?: string; paymasterData?: string }
): { verification: bigint; postOp: bigint } {
  const base = BASE_GAS_LIMITS[type]
  let verification = base.verification
  let postOp = base.postOp

  if (!userOp) {
    return { verification, postOp }
  }

  // Account deployment requires extra verification gas for initCode execution
  const hasFactory = userOp.factory && userOp.factory !== '0x' && userOp.factory !== undefined
  if (hasFactory) {
    verification += GAS_OVERHEAD.factoryDeployment
  }

  // Large callData increases hashing cost in verification
  const callDataBytes = userOp.callData ? (userOp.callData.length - 2) / 2 : 0
  if (callDataBytes > 1024) {
    verification += GAS_OVERHEAD.largeCallData
  }

  // Token-based paymasters need extra postOp for token transfer/accounting
  if (type === 'erc20' || type === 'permit2') {
    postOp += GAS_OVERHEAD.tokenPostOp
  }

  // Large paymasterData (>256 bytes) adds verification overhead
  const paymasterDataBytes = userOp.paymasterData ? (userOp.paymasterData.length - 2) / 2 : 0
  if (paymasterDataBytes > 256) {
    verification += GAS_OVERHEAD.largePaymasterData
  }

  return { verification, postOp }
}

/**
 * Handler configuration
 */
export interface GetPaymasterStubDataConfig {
  paymasterAddress: Address
  paymasterAddresses: PaymasterAddresses
  signer: PaymasterSigner
  policyManager: SponsorPolicyManager
  supportedChainIds: number[]
  supportedEntryPoints: Address[]
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

  const chainError = validateChainId(chainId, supportedChainIds)
  if (chainError) {
    return { success: false, error: chainError }
  }

  const entryPointError = validateEntryPoint(entryPoint, supportedEntryPoints)
  if (entryPointError) {
    return { success: false, error: entryPointError }
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
      return handleVerifyingStubData(params, config, address)
    case 'sponsor':
      return handleSponsorStubData(params, config, address)
    case 'erc20':
      return handleErc20StubData(params, config, address)
    case 'permit2':
      return handlePermit2StubData(params, config, address)
  }
}

/**
 * Verifying paymaster stub data (type 0)
 */
function handleVerifyingStubData(
  params: GetPaymasterStubDataParams,
  config: GetPaymasterStubDataConfig,
  paymasterAddress: Address
): GetPaymasterStubDataResult {
  const { userOp, context } = params
  const { signer, policyManager, sponsorName, sponsorIcon } = config

  const policyId = context?.policyId ?? 'default'
  const normalizedUserOp = normalizeUserOp(userOp)
  const policyResult = policyManager.checkPolicy(normalizedUserOp, policyId)

  if (!policyResult.allowed) {
    return { success: false, error: policyResult.rejection }
  }

  const payload = encodeVerifyingPayload({
    policyId: toPolicyIdBytes32(context?.policyId),
    sponsor: paymasterAddress,
    maxCost: 0n,
    verifierExtra: '0x' as Hex,
  })

  const { paymasterData } = signer.generateStubData(
    PaymasterTypeEnum.VERIFYING,
    payload
  )
  const gasLimits = estimateGasLimits('verifying', userOp)

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
 * Sponsor paymaster stub data (type 1)
 */
function handleSponsorStubData(
  params: GetPaymasterStubDataParams,
  config: GetPaymasterStubDataConfig,
  paymasterAddress: Address
): GetPaymasterStubDataResult {
  const { userOp, context } = params
  const { signer, policyManager, sponsorName, sponsorIcon } = config

  const policyId = context?.policyId ?? 'default'
  const normalizedUserOp = normalizeUserOp(userOp)
  const policyResult = policyManager.checkPolicy(normalizedUserOp, policyId)

  if (!policyResult.allowed) {
    return { success: false, error: policyResult.rejection }
  }

  const payload = encodeSponsorPayload({
    campaignId: context?.campaignId ?? ('0x' + '00'.repeat(32)) as Hex,
    perUserLimit: BigInt(context?.perUserLimit ?? 0),
    targetContract: context?.targetContract ?? ('0x' + '00'.repeat(20)) as Address,
    targetSelector: context?.targetSelector ?? '0x00000000' as Hex,
    sponsorExtra: '0x' as Hex,
  })

  const { paymasterData } = signer.generateStubData(
    PaymasterTypeEnum.SPONSOR,
    payload
  )
  const gasLimits = estimateGasLimits('sponsor', userOp)

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
 * ERC20 paymaster stub data (type 2, envelope-based)
 */
function handleErc20StubData(
  params: GetPaymasterStubDataParams,
  _config: GetPaymasterStubDataConfig,
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

  const payload = encodeErc20Payload({
    token: tokenAddress,
    maxTokenCost: BigInt(context?.maxTokenCost ?? 0),
    quoteId: BigInt(context?.quoteId ?? 0),
    erc20Extra: '0x' as Hex,
  })

  const now = Math.floor(Date.now() / 1000)
  const validUntil = now + DEFAULT_VALID_UNTIL_SECONDS
  const validAfter = now - DEFAULT_CLOCK_SKEW_SECONDS

  const timeError = validateTimeRange(validUntil, validAfter, now)
  if (timeError) {
    return { success: false, error: timeError }
  }

  const paymasterData = encodePaymasterData({
    paymasterType: PaymasterTypeEnum.ERC20,
    flags: 0,
    validUntil: BigInt(validUntil),
    validAfter: BigInt(validAfter),
    nonce: 0n,
    payload,
  })

  const gasLimits = estimateGasLimits('erc20', params.userOp)

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
 * Permit2 paymaster stub data (type 3)
 * Returns paymaster address + gas limits. Actual paymasterData is generated client-side.
 */
function handlePermit2StubData(
  params: GetPaymasterStubDataParams,
  _config: GetPaymasterStubDataConfig,
  paymasterAddress: Address
): GetPaymasterStubDataResult {
  const gasLimits = estimateGasLimits('permit2', params.userOp)

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

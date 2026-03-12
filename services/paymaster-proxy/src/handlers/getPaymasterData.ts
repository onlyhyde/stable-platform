import {
  encodeErc20Payload,
  encodePaymasterData,
  encodePermit2Payload,
  encodeSponsorPayload,
  encodeVerifyingPayload,
  PaymasterType as PaymasterTypeEnum,
} from '@stablenet/core'
import type { Address, Hex } from 'viem'
import type { SponsorPolicyManager } from '../policy/sponsorPolicy'
import type { ReservationTracker } from '../settlement/reservationTracker'
import { computeUserOpHash } from '../settlement/userOpHasher'
import type { PaymasterSigner } from '../signer/paymasterSigner'
import type {
  GetPaymasterDataParams,
  PaymasterAddresses,
  PaymasterContext,
  PaymasterDataResponse,
  PaymasterType,
} from '../types'
import { estimateGasCost } from '../utils/gasEstimator'
import { normalizeUserOp } from '../utils/userOpNormalizer'
import {
  toPolicyIdBytes32,
  validateChainId,
  validateEntryPoint,
  validateTimeRange,
} from '../utils/validation'

/** Default validity window for non-signed envelope types (ERC20, Permit2) */
const DEFAULT_VALID_UNTIL_SECONDS = 300
const DEFAULT_CLOCK_SKEW_SECONDS = 60

/**
 * Fallback KRWC→USDC conversion rate for display purposes.
 * 1 USDC = 1500 KRWC → 1 KRWC = 1/1500 USDC.
 * To avoid precision loss with integer division, we multiply by a scale factor first.
 *
 * Formula: usdcAmount = gasCostWei * USDC_SCALE / (KRWC_PER_USDC * NATIVE_DECIMALS_FACTOR)
 * where USDC_SCALE = 1e6 (USDC has 6 decimals)
 */
const KRWC_PER_USDC = 1500n
const USDC_SCALE = 10n ** 6n
const NATIVE_DECIMALS_FACTOR = 10n ** 18n
/** Buffer for price volatility + paymaster markup (30%) */
const PRICE_BUFFER_PERCENT = 30n

/**
 * Estimate maxTokenCost (USDC, 6 decimals) from gas cost in native wei (KRWC).
 * Adds a 30% buffer over the base estimate for price safety.
 */
function estimateMaxTokenCostFromGas(gasCostWei: bigint): bigint {
  if (gasCostWei <= 0n) return 0n
  const baseCost = (gasCostWei * USDC_SCALE) / (KRWC_PER_USDC * NATIVE_DECIMALS_FACTOR)
  return baseCost + (baseCost * PRICE_BUFFER_PERCENT) / 100n
}

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
  supportedEntryPoints: Address[]
  /** Reservation tracker for userOpHash ↔ reservation mapping (Phase 1) */
  reservationTracker?: ReservationTracker
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
 * or envelope-encoded token data (for erc20/permit2).
 */
export async function handleGetPaymasterData(
  params: GetPaymasterDataParams,
  config: GetPaymasterDataConfig
): Promise<GetPaymasterDataResult> {
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
      return handleVerifyingData(params, config, address)
    case 'sponsor':
      return handleSponsorData(params, config, address)
    case 'erc20':
      return handleErc20Data(params, config, address)
    case 'permit2':
      return handlePermit2Data(params, config, address)
  }
}

/**
 * Verifying paymaster data (signature-based, type 0)
 */
async function handleVerifyingData(
  params: GetPaymasterDataParams,
  config: GetPaymasterDataConfig,
  paymasterAddress: Address
): Promise<GetPaymasterDataResult> {
  const { userOp, entryPoint, chainId, context } = params
  const { signer, policyManager, reservationTracker } = config

  const policyId = context?.policyId ?? 'default'
  const normalizedUserOp = normalizeUserOp(userOp)
  const estimatedGasCost = estimateGasCost(normalizedUserOp)

  // Atomically check policy and reserve spending to prevent TOCTOU race
  // where concurrent requests could exceed the spending limit.
  const policyResult = policyManager.checkAndReserve(normalizedUserOp, policyId, estimatedGasCost)
  if (!policyResult.allowed) {
    return { success: false, error: policyResult.rejection }
  }
  const { reservationId } = policyResult

  const payload = encodeVerifyingPayload({
    policyId: toPolicyIdBytes32(context?.policyId),
    sponsor: paymasterAddress,
    maxCost: estimatedGasCost,
    verifierExtra: '0x' as Hex,
  })

  const { paymasterData } = await signer.generateSignedData(
    userOp,
    entryPoint,
    BigInt(chainId),
    PaymasterTypeEnum.VERIFYING,
    payload,
    undefined,
    undefined,
    paymasterAddress
  )

  // Phase 1: Track reservation with userOpHash for receipt-based settlement
  if (reservationTracker) {
    const userOpHash = computeUserOpHash(
      userOp,
      { paymaster: paymasterAddress, paymasterData },
      entryPoint,
      BigInt(chainId)
    )
    reservationTracker.track(userOpHash, normalizedUserOp.sender, reservationId, estimatedGasCost)
  }

  return {
    success: true,
    data: { paymaster: paymasterAddress, paymasterData, reservationId },
  }
}

/**
 * Sponsor paymaster data (signature-based, type 1)
 */
async function handleSponsorData(
  params: GetPaymasterDataParams,
  config: GetPaymasterDataConfig,
  paymasterAddress: Address
): Promise<GetPaymasterDataResult> {
  const { userOp, entryPoint, chainId, context } = params
  const { signer, policyManager, reservationTracker } = config

  const campaignId = context?.campaignId ?? (('0x' + '00'.repeat(32)) as Hex)
  const perUserLimit = BigInt(context?.perUserLimit ?? 0)
  const targetContract = context?.targetContract ?? (('0x' + '00'.repeat(20)) as Address)
  const targetSelector = context?.targetSelector ?? ('0x00000000' as Hex)

  const payload = encodeSponsorPayload({
    campaignId,
    perUserLimit,
    targetContract,
    targetSelector,
    sponsorExtra: '0x' as Hex,
  })

  const policyId = context?.policyId ?? 'default'
  const normalizedUserOp = normalizeUserOp(userOp)
  const estimatedGasCost = estimateGasCost(normalizedUserOp)

  // Atomically check policy and reserve spending to prevent TOCTOU race
  const policyResult = policyManager.checkAndReserve(normalizedUserOp, policyId, estimatedGasCost)
  if (!policyResult.allowed) {
    return { success: false, error: policyResult.rejection }
  }
  const { reservationId } = policyResult

  const { paymasterData } = await signer.generateSignedData(
    userOp,
    entryPoint,
    BigInt(chainId),
    PaymasterTypeEnum.SPONSOR,
    payload,
    undefined,
    undefined,
    paymasterAddress
  )

  // Phase 1: Track reservation with userOpHash for receipt-based settlement
  if (reservationTracker) {
    const userOpHash = computeUserOpHash(
      userOp,
      { paymaster: paymasterAddress, paymasterData },
      entryPoint,
      BigInt(chainId)
    )
    reservationTracker.track(userOpHash, normalizedUserOp.sender, reservationId, estimatedGasCost)
  }

  return {
    success: true,
    data: { paymaster: paymasterAddress, paymasterData, reservationId },
  }
}

/**
 * ERC20 paymaster data (envelope-based, no signature, type 2)
 * Contract uses oracle-based on-chain verification.
 */
function handleErc20Data(
  params: GetPaymasterDataParams,
  config: GetPaymasterDataConfig,
  paymasterAddress: Address
): GetPaymasterDataResult {
  const { userOp, context } = params
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

  // Apply policy and risk checks (same as verifying/sponsor paths)
  const normalizedUserOp = normalizeUserOp(userOp)
  const estimatedGasCost = estimateGasCost(normalizedUserOp)
  const policyId = context?.policyId ?? 'default'
  const policyResult = config.policyManager.checkPolicy(
    normalizedUserOp,
    policyId,
    estimatedGasCost
  )
  if (!policyResult.allowed) {
    return { success: false, error: policyResult.rejection }
  }

  // Calculate maxTokenCost from gas estimate if not provided by context.
  // This allows the wallet UI to display the estimated USDC cost to the user.
  const contextMaxTokenCost = context?.maxTokenCost ? BigInt(context.maxTokenCost) : 0n
  const maxTokenCost =
    contextMaxTokenCost > 0n ? contextMaxTokenCost : estimateMaxTokenCostFromGas(estimatedGasCost)
  const quoteId = BigInt(context?.quoteId ?? 0)

  const payload = encodeErc20Payload({
    token: tokenAddress,
    maxTokenCost,
    quoteId,
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
    nonce: generateEnvelopeNonce(),
    payload,
  })

  return {
    success: true,
    data: { paymaster: paymasterAddress, paymasterData },
  }
}

/**
 * Generate a cryptographically random nonce for non-signed envelope types.
 * Uses crypto.getRandomValues to avoid collision risk from Date.now().
 */
function generateEnvelopeNonce(): bigint {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n)
}

/**
 * Permit2 paymaster data (type 3)
 *
 * Permit2 signature is the user's signature (not paymaster's), generated client-side.
 * If client provides permit fields in context, build the full envelope.
 * Otherwise return paymaster address only (client builds envelope via SDK).
 */
function handlePermit2Data(
  params: GetPaymasterDataParams,
  config: GetPaymasterDataConfig,
  paymasterAddress: Address
): GetPaymasterDataResult {
  const { userOp, context } = params

  // Apply policy and risk checks
  const normalizedUserOp = normalizeUserOp(userOp)
  const estimatedGasCost = estimateGasCost(normalizedUserOp)
  const policyId = context?.policyId ?? 'default'
  const policyResult = config.policyManager.checkPolicy(
    normalizedUserOp,
    policyId,
    estimatedGasCost
  )
  if (!policyResult.allowed) {
    return { success: false, error: policyResult.rejection }
  }

  if (context?.tokenAddress && context?.permitSig) {
    const payload = encodePermit2Payload({
      token: context.tokenAddress,
      permitAmount: BigInt(context.permitAmount ?? 0),
      permitExpiration: context.permitExpiration ?? 0,
      permitNonce: context.permitNonce ?? 0,
      permitSig: context.permitSig,
      permit2Extra: '0x' as Hex,
    })

    const now = Math.floor(Date.now() / 1000)
    const validUntil = now + DEFAULT_VALID_UNTIL_SECONDS
    const validAfter = now - DEFAULT_CLOCK_SKEW_SECONDS

    const timeError = validateTimeRange(validUntil, validAfter, now)
    if (timeError) {
      return { success: false, error: timeError }
    }

    const paymasterData = encodePaymasterData({
      paymasterType: PaymasterTypeEnum.PERMIT2,
      flags: 0,
      validUntil: BigInt(validUntil),
      validAfter: BigInt(validAfter),
      nonce: generateEnvelopeNonce(),
      payload,
    })

    return {
      success: true,
      data: { paymaster: paymasterAddress, paymasterData },
    }
  }

  // Client will build the full envelope via SDK
  return {
    success: true,
    data: {
      paymaster: paymasterAddress,
      paymasterData: '0x' as Hex,
    },
  }
}

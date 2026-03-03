/**
 * Paymaster interaction utilities
 *
 * Extracted from handler.ts to reduce file size and improve maintainability.
 */

import { buildUserOpTypedData, createBundlerClient, type UserOperation } from '@stablenet/core'
import type { Address, Hex } from 'viem'
import { createLogger } from '../../shared/utils/logger'

const logger = createLogger('Paymaster')

/**
 * Send a JSON-RPC request to the paymaster-proxy service
 */
export async function fetchFromPaymaster(
  paymasterUrl: string,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const response = await fetch(paymasterUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  })

  if (!response.ok) {
    throw new Error(`Paymaster request failed: ${response.status}`)
  }

  const data = (await response.json()) as { result?: unknown; error?: { message?: string } }
  if (data.error) {
    throw new Error(data.error.message ?? 'Paymaster error')
  }

  return data.result
}

/**
 * Request paymaster sponsorship for a UserOperation
 * Returns sponsored fields or null if paymaster is unavailable (graceful fallback)
 */
export async function requestPaymasterSponsorship(
  paymasterUrl: string,
  userOp: UserOperation,
  entryPoint: Address,
  chainId: number,
  /** ERC-20 token address for token-based gas payment. If omitted, requests sponsored gas. */
  tokenAddress?: Address
): Promise<{
  paymaster: Address
  paymasterData: Hex
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
} | null> {
  try {
    const chainIdHex = `0x${chainId.toString(16)}`

    // Convert UserOp fields to hex strings for JSON-RPC
    const userOpHex = {
      sender: userOp.sender,
      nonce: `0x${userOp.nonce.toString(16)}`,
      callData: userOp.callData,
      callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
      verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
      preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
      maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
      signature: userOp.signature,
      factory: userOp.factory ?? undefined,
      factoryData: userOp.factoryData ?? undefined,
    }

    // Build context for paymaster (includes token info for ERC-20 payments)
    const paymasterContext: Record<string, unknown> = tokenAddress
      ? { paymasterType: 'erc20', tokenAddress }
      : {}

    // Step 1: Get stub data for gas estimation (ERC-7677 pm_getPaymasterStubData)
    const stubResult = (await fetchFromPaymaster(paymasterUrl, 'pm_getPaymasterStubData', [
      userOpHex,
      entryPoint,
      chainIdHex,
      paymasterContext,
    ])) as
      | {
          paymaster?: string
          paymasterData?: string
          paymasterVerificationGasLimit?: string
          paymasterPostOpGasLimit?: string
          isFinal?: boolean
        }
      | undefined

    if (!stubResult?.paymaster) {
      return null
    }

    // ERC-7677: If stub response is final, skip the pm_getPaymasterData call
    if (stubResult.isFinal) {
      return {
        paymaster: stubResult.paymaster as Address,
        paymasterData: (stubResult.paymasterData ?? '0x') as Hex,
        paymasterVerificationGasLimit: BigInt(stubResult.paymasterVerificationGasLimit ?? '0'),
        paymasterPostOpGasLimit: BigInt(stubResult.paymasterPostOpGasLimit ?? '0'),
      }
    }

    // Step 2: Get final signed paymaster data (ERC-7677 pm_getPaymasterData)
    const finalResult = (await fetchFromPaymaster(paymasterUrl, 'pm_getPaymasterData', [
      {
        ...userOpHex,
        paymaster: stubResult.paymaster,
        paymasterData: stubResult.paymasterData ?? '0x',
        paymasterVerificationGasLimit: stubResult.paymasterVerificationGasLimit ?? '0x0',
        paymasterPostOpGasLimit: stubResult.paymasterPostOpGasLimit ?? '0x0',
      },
      entryPoint,
      chainIdHex,
      paymasterContext,
    ])) as
      | {
          paymaster?: string
          paymasterData?: string
        }
      | undefined

    if (!finalResult?.paymaster) {
      return null
    }

    // Gas limits come from stub (final response doesn't include them per ERC-7677)
    return {
      paymaster: finalResult.paymaster as Address,
      paymasterData: (finalResult.paymasterData ?? '0x') as Hex,
      paymasterVerificationGasLimit: BigInt(stubResult.paymasterVerificationGasLimit ?? '0'),
      paymasterPostOpGasLimit: BigInt(stubResult.paymasterPostOpGasLimit ?? '0'),
    }
  } catch (err) {
    logger.warn(
      `Paymaster sponsorship unavailable, falling back to self-pay: ${err instanceof Error ? err.message : String(err)}`
    )
    return null
  }
}

/**
 * Convert UserOperation bigint fields to hex strings for JSON-RPC transport
 */
function serializeUserOpToHex(userOp: UserOperation) {
  return {
    sender: userOp.sender,
    nonce: `0x${userOp.nonce.toString(16)}`,
    callData: userOp.callData,
    callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
    verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
    preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
    maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
    maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
    signature: userOp.signature,
    factory: userOp.factory ?? undefined,
    factoryData: userOp.factoryData ?? undefined,
    paymaster: userOp.paymaster ?? undefined,
    paymasterData: userOp.paymasterData ?? undefined,
    paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit
      ? `0x${userOp.paymasterVerificationGasLimit.toString(16)}`
      : undefined,
    paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit
      ? `0x${userOp.paymasterPostOpGasLimit.toString(16)}`
      : undefined,
  }
}

/**
 * ERC-7677 compliant paymaster sponsorship + signing flow.
 *
 * Executes the correct order: stub → estimate → final → sign
 * Returns a fully signed UserOperation, or null if paymaster is unavailable
 * (caller should fall back to self-pay).
 */
export async function sponsorAndSign(params: {
  userOp: UserOperation
  paymasterUrl: string
  entryPoint: Address
  chainId: number
  context: Record<string, unknown>
  bundlerUrl: string
  signer: (userOp: UserOperation) => Promise<Hex>
}): Promise<UserOperation | null> {
  const { userOp, paymasterUrl, entryPoint, chainId, context, bundlerUrl, signer } = params
  const chainIdHex = `0x${chainId.toString(16)}`

  // ── Step 1: Stub RPC ─────────────────────────────────────────────────
  const userOpHex = serializeUserOpToHex(userOp)
  logger.info(`[sponsorAndSign] Step 1: stub RPC → ${paymasterUrl} (sender=${userOp.sender}, nonce=${userOp.nonce})`)

  let stubResult: {
    paymaster?: string
    paymasterData?: string
    paymasterVerificationGasLimit?: string
    paymasterPostOpGasLimit?: string
    isFinal?: boolean
  } | undefined

  try {
    stubResult = (await fetchFromPaymaster(paymasterUrl, 'pm_getPaymasterStubData', [
      userOpHex,
      entryPoint,
      chainIdHex,
      context,
    ])) as typeof stubResult
  } catch (err) {
    logger.error(`[sponsorAndSign] Step 1 FAILED (stub RPC): ${err instanceof Error ? err.message : String(err)}`)
    return null
  }

  if (!stubResult?.paymaster) {
    logger.warn('[sponsorAndSign] Step 1: stub returned no paymaster, falling back to self-pay')
    return null
  }

  logger.info(`[sponsorAndSign] Step 1 OK: paymaster=${stubResult.paymaster}, isFinal=${stubResult.isFinal ?? false}`)

  // Apply stub fields to userOp (needed for accurate gas estimation)
  userOp.paymaster = stubResult.paymaster as Address
  userOp.paymasterData = (stubResult.paymasterData ?? '0x') as Hex
  userOp.paymasterVerificationGasLimit = BigInt(stubResult.paymasterVerificationGasLimit ?? '0')
  userOp.paymasterPostOpGasLimit = BigInt(stubResult.paymasterPostOpGasLimit ?? '0')

  // ── Step 2: Bundler gas estimation (with paymaster context) ──────────
  logger.info(`[sponsorAndSign] Step 2: bundler gas estimation → ${bundlerUrl}`)

  try {
    const bundlerClient = createBundlerClient({ url: bundlerUrl, entryPoint })
    const gasEstimate = await bundlerClient.estimateUserOperationGas(userOp)

    userOp.preVerificationGas = gasEstimate.preVerificationGas
    userOp.verificationGasLimit =
      gasEstimate.verificationGasLimit + gasEstimate.verificationGasLimit / 5n
    userOp.callGasLimit = gasEstimate.callGasLimit + gasEstimate.callGasLimit / 5n

    logger.info(
      `[sponsorAndSign] Step 2 OK: preVerif=${userOp.preVerificationGas}, verifLimit=${userOp.verificationGasLimit}, callLimit=${userOp.callGasLimit}`
    )
  } catch (err) {
    logger.error(`[sponsorAndSign] Step 2 FAILED (gas estimation): ${err instanceof Error ? err.message : String(err)}`)
    return null
  }

  // ── Step 3: Final RPC (if stub was not final) ────────────────────────
  if (!stubResult.isFinal) {
    logger.info('[sponsorAndSign] Step 3: final RPC (isFinal=false)')

    try {
      const updatedUserOpHex = serializeUserOpToHex(userOp)

      const finalResult = (await fetchFromPaymaster(paymasterUrl, 'pm_getPaymasterData', [
        updatedUserOpHex,
        entryPoint,
        chainIdHex,
        context,
      ])) as { paymaster?: string; paymasterData?: string } | undefined

      if (!finalResult?.paymaster) {
        logger.warn('[sponsorAndSign] Step 3: final RPC returned no paymaster, falling back to self-pay')
        return null
      }

      userOp.paymaster = finalResult.paymaster as Address
      userOp.paymasterData = (finalResult.paymasterData ?? '0x') as Hex
      logger.info(`[sponsorAndSign] Step 3 OK: paymaster=${finalResult.paymaster}, dataLen=${(finalResult.paymasterData ?? '0x').length}`)
    } catch (err) {
      logger.error(`[sponsorAndSign] Step 3 FAILED (final RPC): ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  } else {
    logger.info('[sponsorAndSign] Step 3: SKIPPED (isFinal=true)')
  }

  // ── Step 4: Sign ─────────────────────────────────────────────────────
  logger.info('[sponsorAndSign] Step 4: signing UserOp')

  try {
    const signature = await signer(userOp)
    logger.info(`[sponsorAndSign] Step 4 OK: sigLen=${signature.length} chars`)
    return { ...userOp, signature }
  } catch (err) {
    logger.error(`[sponsorAndSign] Step 4 FAILED (signing): ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

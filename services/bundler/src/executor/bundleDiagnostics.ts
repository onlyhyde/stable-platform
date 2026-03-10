import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { decodeEventLog } from 'viem'
import { ENTRY_POINT_ABI, EVENT_SIGNATURES } from '../abi'
import type { MempoolEntry } from '../types'
import type { Logger } from '../utils/logger'
import {
  decodeFailedOp,
  decodeFailedOpWithRevert,
  extractErrorData,
  formatRevertReason,
  matchesErrorSelector,
  parseSimulationError,
} from '../validation/errors'
import type { UserOperationEventData } from '../validation/types'

/**
 * Structured result from bundle failure diagnosis
 */
export interface DiagnosisResult {
  decodedReason?: string
  failedOpIndex?: number
  failedOpReason?: string
  innerRevertData?: string
  errorSelector?: string
  rawErrorData?: string
  userOpDetails?: Record<string, unknown>[]
}

/**
 * Diagnose why a bundle submission failed.
 * Extracts structured revert data from the error and optionally
 * re-runs handleOps via eth_call to get detailed revert info.
 */
export async function diagnoseBundleFailure(
  error: unknown,
  handleOpsData: Hex,
  entries: MempoolEntry[],
  publicClient: PublicClient,
  walletClient: WalletClient,
  entryPoint: Address,
  logger: Logger
): Promise<DiagnosisResult> {
  const result: DiagnosisResult = {}

  // Step 1: Extract error data from the caught exception
  const errorData = extractErrorData(error)

  if (errorData) {
    result.rawErrorData = errorData
    result.errorSelector = errorData.length >= 10 ? errorData.slice(0, 10) : undefined

    // Decode FailedOp(uint256 opIndex, string reason)
    if (matchesErrorSelector(errorData, 'FailedOp')) {
      try {
        const { opIndex, reason } = decodeFailedOp(errorData)
        result.failedOpIndex = Number(opIndex)
        result.failedOpReason = reason
        result.decodedReason = `FailedOp[${opIndex}]: ${formatRevertReason(reason)}`
        logger.error(
          { opIndex: Number(opIndex), reason, userOpHash: entries[Number(opIndex)]?.userOpHash },
          `handleOps FailedOp at index ${opIndex}: ${reason}`
        )
      } catch (decodeErr) {
        logger.warn({ err: decodeErr }, 'Failed to decode FailedOp data')
      }
    }

    // Decode FailedOpWithRevert(uint256 opIndex, string reason, bytes inner)
    else if (matchesErrorSelector(errorData, 'FailedOpWithRevert')) {
      try {
        const { opIndex, reason, inner } = decodeFailedOpWithRevert(errorData)
        result.failedOpIndex = Number(opIndex)
        result.failedOpReason = reason
        result.innerRevertData = inner
        result.decodedReason = `FailedOpWithRevert[${opIndex}]: ${formatRevertReason(reason)} | inner=${inner}`
        logger.error(
          {
            opIndex: Number(opIndex),
            reason,
            inner,
            innerLength: inner.length,
            userOpHash: entries[Number(opIndex)]?.userOpHash,
          },
          `handleOps FailedOpWithRevert at index ${opIndex}: ${reason}`
        )
      } catch (decodeErr) {
        logger.warn({ err: decodeErr }, 'Failed to decode FailedOpWithRevert data')
      }
    }

    // Decode SignatureValidationFailed
    else if (matchesErrorSelector(errorData, 'SignatureValidationFailed')) {
      result.decodedReason = 'SignatureValidationFailed: on-chain signature check failed'
      logger.error(
        'handleOps SignatureValidationFailed: ECDSA signature validation failed on-chain'
      )
    }

    // Unknown selector — log raw data for analysis
    else {
      result.decodedReason = `Unknown revert (selector=${result.errorSelector}): ${errorData.slice(0, 66)}...`
    }
  }

  // Step 2: If no structured data was extracted, try eth_call to get revert reason
  if (!result.decodedReason) {
    try {
      await publicClient.call({
        account: walletClient.account!,
        to: entryPoint,
        data: handleOpsData,
      })
      // If eth_call succeeds, the revert was transient (state changed between attempts)
      result.decodedReason =
        'Transient failure: eth_call succeeded on retry (state may have changed)'
    } catch (callError) {
      const callErrorData = extractErrorData(callError)
      if (callErrorData) {
        result.rawErrorData = callErrorData

        const parsed = parseSimulationError(callError)
        if (parsed.failedOp) {
          result.failedOpIndex = Number(parsed.failedOp.opIndex)
          result.failedOpReason = parsed.failedOp.reason
          result.innerRevertData = parsed.failedOp.inner
          result.decodedReason = `FailedOp[${parsed.failedOp.opIndex}]: ${formatRevertReason(parsed.failedOp.reason)}${parsed.failedOp.inner ? ` | inner=${parsed.failedOp.inner}` : ''}`
        } else if (parsed.rawError) {
          result.decodedReason = `eth_call revert: ${parsed.rawError}`
        }

        logger.error(
          { callErrorData: callErrorData.slice(0, 200), parsed },
          'handleOps eth_call diagnostic result'
        )
      } else {
        result.decodedReason = `eth_call also reverted: ${callError instanceof Error ? callError.message : String(callError)}`
      }
    }
  }

  // Step 3: Log UserOp details for the failed operation(s)
  const failedEntry =
    result.failedOpIndex !== undefined ? entries[result.failedOpIndex] : undefined
  const opsToLog = failedEntry ? [failedEntry] : entries

  result.userOpDetails = opsToLog.map((e) => ({
    userOpHash: e.userOpHash,
    sender: e.userOp.sender,
    nonce: e.userOp.nonce.toString(),
    hasFactory: !!(e.userOp.factory && e.userOp.factory !== '0x'),
    factory: e.userOp.factory || 'none',
    hasPaymaster: !!(e.userOp.paymaster && e.userOp.paymaster !== '0x'),
    signatureLength: e.userOp.signature?.length ?? 0,
    callDataSelector: e.userOp.callData?.slice(0, 10) ?? 'none',
    verificationGasLimit: e.userOp.verificationGasLimit.toString(),
    callGasLimit: e.userOp.callGasLimit.toString(),
    preVerificationGas: e.userOp.preVerificationGas.toString(),
    maxFeePerGas: e.userOp.maxFeePerGas.toString(),
    maxPriorityFeePerGas: e.userOp.maxPriorityFeePerGas.toString(),
  }))

  for (const detail of result.userOpDetails) {
    logger.error(detail, 'Failed UserOp details')
  }

  return result
}

/**
 * Parse UserOperationEvent logs from transaction receipt
 */
export function parseUserOperationEvents(
  logs: Array<{
    address: Address
    topics: Hex[]
    data: Hex
  }>,
  entryPoint: Address,
  logger: Logger
): UserOperationEventData[] {
  const events: UserOperationEventData[] = []

  for (const log of logs) {
    // Check if this is a UserOperationEvent
    if (
      log.address.toLowerCase() === entryPoint.toLowerCase() &&
      log.topics[0]?.toLowerCase() === EVENT_SIGNATURES.UserOperationEvent.toLowerCase()
    ) {
      try {
        // Type cast required for decodeEventLog topics parameter
        const topics = log.topics as [Hex, ...Hex[]]
        const decoded = decodeEventLog({
          abi: ENTRY_POINT_ABI,
          data: log.data,
          topics,
        })

        if (decoded.eventName === 'UserOperationEvent') {
          const args = decoded.args as {
            userOpHash: Hex
            sender: Address
            paymaster: Address
            nonce: bigint
            success: boolean
            actualGasCost: bigint
            actualGasUsed: bigint
          }

          events.push({
            userOpHash: args.userOpHash,
            sender: args.sender,
            paymaster: args.paymaster,
            nonce: args.nonce,
            success: args.success,
            actualGasCost: args.actualGasCost,
            actualGasUsed: args.actualGasUsed,
          })
        }
      } catch (error) {
        logger.warn({ error, log }, 'Failed to decode UserOperationEvent')
      }
    }
  }

  return events
}

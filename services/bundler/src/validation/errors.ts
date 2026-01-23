import type { Address, Hex } from 'viem'
import { decodeAbiParameters, slice } from 'viem'
import { ERROR_SELECTORS } from '../abi'
import type {
  ValidationResult,
  ValidationResultWithAggregation,
  ExecutionResult,
  StakeInfo,
  ReturnInfo,
  AggregatorInfo,
  ParsedValidationData,
} from './types'
import { VALIDATION_CONSTANTS } from './types'

/**
 * Check if error data matches a specific error selector
 */
export function matchesErrorSelector(
  data: Hex,
  selector: keyof typeof ERROR_SELECTORS
): boolean {
  if (!data || data.length < 10) return false
  const actualSelector = slice(data, 0, 4)
  return actualSelector.toLowerCase() === ERROR_SELECTORS[selector].toLowerCase()
}

/**
 * Check if error is a ValidationResult error (success case)
 */
export function isValidationResultError(error: unknown): boolean {
  const data = extractErrorData(error)
  if (!data) return false
  return matchesErrorSelector(data, 'ValidationResult')
}

/**
 * Check if error is a ValidationResultWithAggregation error
 */
export function isValidationResultWithAggregationError(error: unknown): boolean {
  const data = extractErrorData(error)
  if (!data) return false
  return matchesErrorSelector(data, 'ValidationResultWithAggregation')
}

/**
 * Check if error is a FailedOp error
 */
export function isFailedOpError(error: unknown): boolean {
  const data = extractErrorData(error)
  if (!data) return false
  return matchesErrorSelector(data, 'FailedOp')
}

/**
 * Check if error is a FailedOpWithRevert error
 */
export function isFailedOpWithRevertError(error: unknown): boolean {
  const data = extractErrorData(error)
  if (!data) return false
  return matchesErrorSelector(data, 'FailedOpWithRevert')
}

/**
 * Check if error is an ExecutionResult error
 */
export function isExecutionResultError(error: unknown): boolean {
  const data = extractErrorData(error)
  if (!data) return false
  return matchesErrorSelector(data, 'ExecutionResult')
}

/**
 * Extract error data from various error formats
 */
export function extractErrorData(error: unknown): Hex | null {
  if (!error) return null

  // Direct hex data
  if (typeof error === 'string' && error.startsWith('0x')) {
    return error as Hex
  }

  // Error object with data property
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>

    // viem error format
    if (err.data && typeof err.data === 'string' && err.data.startsWith('0x')) {
      return err.data as Hex
    }

    // Nested error formats
    if (err.cause) {
      return extractErrorData(err.cause)
    }

    // ethers.js format
    if (err.error) {
      return extractErrorData(err.error)
    }

    // Raw hex in message
    if (typeof err.message === 'string') {
      const hexMatch = err.message.match(/(0x[a-fA-F0-9]+)/)
      if (hexMatch?.[1] && hexMatch[1].length > 10) {
        return hexMatch[1] as Hex
      }
    }
  }

  return null
}

/**
 * Decode ValidationResult error data
 */
export function decodeValidationResult(data: Hex): ValidationResult {
  // Skip the 4-byte selector
  const params = slice(data, 4)

  const decoded = decodeAbiParameters(
    [
      {
        name: 'returnInfo',
        type: 'tuple',
        components: [
          { name: 'preOpGas', type: 'uint256' },
          { name: 'prefund', type: 'uint256' },
          { name: 'accountValidationData', type: 'uint256' },
          { name: 'paymasterValidationData', type: 'uint256' },
          { name: 'paymasterContext', type: 'bytes' },
        ],
      },
      {
        name: 'senderInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
      {
        name: 'factoryInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
      {
        name: 'paymasterInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
    ],
    params
  )

  const [returnInfo, senderInfo, factoryInfo, paymasterInfo] = decoded

  return {
    returnInfo: returnInfo as unknown as ReturnInfo,
    senderInfo: senderInfo as unknown as StakeInfo,
    factoryInfo: factoryInfo as unknown as StakeInfo,
    paymasterInfo: paymasterInfo as unknown as StakeInfo,
  }
}

/**
 * Decode ValidationResultWithAggregation error data
 */
export function decodeValidationResultWithAggregation(
  data: Hex
): ValidationResultWithAggregation {
  const params = slice(data, 4)

  const decoded = decodeAbiParameters(
    [
      {
        name: 'returnInfo',
        type: 'tuple',
        components: [
          { name: 'preOpGas', type: 'uint256' },
          { name: 'prefund', type: 'uint256' },
          { name: 'accountValidationData', type: 'uint256' },
          { name: 'paymasterValidationData', type: 'uint256' },
          { name: 'paymasterContext', type: 'bytes' },
        ],
      },
      {
        name: 'senderInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
      {
        name: 'factoryInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
      {
        name: 'paymasterInfo',
        type: 'tuple',
        components: [
          { name: 'stake', type: 'uint256' },
          { name: 'unstakeDelaySec', type: 'uint256' },
        ],
      },
      {
        name: 'aggregatorInfo',
        type: 'tuple',
        components: [
          { name: 'aggregator', type: 'address' },
          {
            name: 'stakeInfo',
            type: 'tuple',
            components: [
              { name: 'stake', type: 'uint256' },
              { name: 'unstakeDelaySec', type: 'uint256' },
            ],
          },
        ],
      },
    ],
    params
  )

  const [returnInfo, senderInfo, factoryInfo, paymasterInfo, aggregatorInfo] =
    decoded

  return {
    returnInfo: returnInfo as unknown as ReturnInfo,
    senderInfo: senderInfo as unknown as StakeInfo,
    factoryInfo: factoryInfo as unknown as StakeInfo,
    paymasterInfo: paymasterInfo as unknown as StakeInfo,
    aggregatorInfo: aggregatorInfo as unknown as AggregatorInfo,
  }
}

/**
 * Decode FailedOp error data
 */
export function decodeFailedOp(data: Hex): { opIndex: bigint; reason: string } {
  const params = slice(data, 4)

  const decoded = decodeAbiParameters(
    [
      { name: 'opIndex', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    params
  )

  return {
    opIndex: decoded[0] as bigint,
    reason: decoded[1] as string,
  }
}

/**
 * Decode FailedOpWithRevert error data
 */
export function decodeFailedOpWithRevert(data: Hex): {
  opIndex: bigint
  reason: string
  inner: Hex
} {
  const params = slice(data, 4)

  const decoded = decodeAbiParameters(
    [
      { name: 'opIndex', type: 'uint256' },
      { name: 'reason', type: 'string' },
      { name: 'inner', type: 'bytes' },
    ],
    params
  )

  return {
    opIndex: decoded[0] as bigint,
    reason: decoded[1] as string,
    inner: decoded[2] as Hex,
  }
}

/**
 * Decode ExecutionResult error data
 */
export function decodeExecutionResult(data: Hex): ExecutionResult {
  const params = slice(data, 4)

  const decoded = decodeAbiParameters(
    [
      { name: 'preOpGas', type: 'uint256' },
      { name: 'paid', type: 'uint256' },
      { name: 'accountValidationData', type: 'uint256' },
      { name: 'paymasterValidationData', type: 'uint256' },
      { name: 'targetSuccess', type: 'bool' },
      { name: 'targetResult', type: 'bytes' },
    ],
    params
  )

  return {
    preOpGas: decoded[0] as bigint,
    paid: decoded[1] as bigint,
    accountValidationData: decoded[2] as bigint,
    paymasterValidationData: decoded[3] as bigint,
    targetSuccess: decoded[4] as boolean,
    targetResult: decoded[5] as Hex,
  }
}

/**
 * Parse validation data (packed uint256 with aggregator, validAfter, validUntil)
 * Format: [aggregator (20 bytes)][validUntil (6 bytes)][validAfter (6 bytes)]
 */
export function parseValidationData(validationData: bigint): ParsedValidationData {
  // validAfter is the lower 48 bits
  const validAfter = validationData & 0xffffffffffffn

  // validUntil is the next 48 bits
  const validUntil = (validationData >> 48n) & 0xffffffffffffn

  // aggregator is the upper 160 bits
  const aggregatorBigInt = validationData >> 96n
  const aggregator = `0x${aggregatorBigInt.toString(16).padStart(40, '0')}` as Address

  return {
    aggregator,
    validAfter,
    validUntil,
  }
}

/**
 * Check if validation data indicates signature failure
 */
export function isSignatureFailure(validationData: bigint): boolean {
  const { aggregator } = parseValidationData(validationData)
  return aggregator === VALIDATION_CONSTANTS.SIG_VALIDATION_FAILED
}

/**
 * Options for timestamp validation
 */
export interface ValidateTimestampsOptions {
  /** Current time in seconds (default: Date.now() / 1000) */
  now?: bigint
  /** Minimum seconds before validUntil (default: 30) */
  minValidUntilBuffer?: bigint
}

/**
 * Check if validation data timestamps are valid
 */
export function validateTimestamps(
  validAfter: bigint,
  validUntil: bigint,
  options?: ValidateTimestampsOptions | bigint // bigint for backward compatibility (now)
): { valid: boolean; reason?: string } {
  // Handle backward compatibility: if options is a bigint, treat it as `now`
  let currentTime: bigint
  let minBuffer: bigint

  if (typeof options === 'bigint') {
    currentTime = options
    minBuffer = VALIDATION_CONSTANTS.MIN_VALID_UNTIL_BUFFER
  } else {
    currentTime = options?.now ?? BigInt(Math.floor(Date.now() / 1000))
    minBuffer = options?.minValidUntilBuffer ?? VALIDATION_CONSTANTS.MIN_VALID_UNTIL_BUFFER
  }

  // validUntil of 0 means no expiry
  if (validUntil > 0n) {
    // Check if already expired or will expire too soon
    if (validUntil <= currentTime + minBuffer) {
      return {
        valid: false,
        reason: `validUntil too soon: ${validUntil} <= ${currentTime + minBuffer}`,
      }
    }
  }

  // validAfter of 0 means immediately valid
  if (validAfter > 0n) {
    // Check if not yet valid
    if (validAfter > currentTime) {
      return {
        valid: false,
        reason: `validAfter in future: ${validAfter} > ${currentTime}`,
      }
    }
  }

  return { valid: true }
}

/**
 * Format a revert reason for human-readable output
 */
export function formatRevertReason(reason: string): string {
  // Common patterns
  if (reason.startsWith('AA')) {
    return `Account Abstraction Error: ${reason}`
  }

  if (reason.startsWith('PM')) {
    return `Paymaster Error: ${reason}`
  }

  // Try to decode if it looks like hex
  if (reason.startsWith('0x')) {
    try {
      // Try decoding as string
      const decoded = decodeAbiParameters(
        [{ name: 'reason', type: 'string' }],
        reason as Hex
      )
      return decoded[0] as string
    } catch {
      // Return raw hex if decoding fails
      return reason
    }
  }

  return reason
}

/**
 * Parse error from simulation call and return appropriate error details
 */
export function parseSimulationError(error: unknown): {
  isValidationResult: boolean
  result?: ValidationResult | ValidationResultWithAggregation
  failedOp?: { opIndex: bigint; reason: string; inner?: Hex }
  rawError?: string
} {
  const data = extractErrorData(error)

  if (!data) {
    return {
      isValidationResult: false,
      rawError: error instanceof Error ? error.message : String(error),
    }
  }

  // Success case - ValidationResult
  if (matchesErrorSelector(data, 'ValidationResult')) {
    return {
      isValidationResult: true,
      result: decodeValidationResult(data),
    }
  }

  // Success case with aggregation
  if (matchesErrorSelector(data, 'ValidationResultWithAggregation')) {
    return {
      isValidationResult: true,
      result: decodeValidationResultWithAggregation(data),
    }
  }

  // Failure case - FailedOp
  if (matchesErrorSelector(data, 'FailedOp')) {
    const { opIndex, reason } = decodeFailedOp(data)
    return {
      isValidationResult: false,
      failedOp: { opIndex, reason },
    }
  }

  // Failure case - FailedOpWithRevert
  if (matchesErrorSelector(data, 'FailedOpWithRevert')) {
    const { opIndex, reason, inner } = decodeFailedOpWithRevert(data)
    return {
      isValidationResult: false,
      failedOp: { opIndex, reason, inner },
    }
  }

  return {
    isValidationResult: false,
    rawError: `Unknown error: ${data}`,
  }
}

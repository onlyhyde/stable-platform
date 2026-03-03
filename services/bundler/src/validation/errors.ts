import type { Address, Hex } from 'viem'
import { decodeAbiParameters, slice } from 'viem'
import { ERROR_SELECTORS } from '../abi'
import type {
  AggregatorInfo,
  ExecutionResult,
  ParsedValidationData,
  ReturnInfo,
  StakeInfo,
  ValidationResult,
  ValidationResultWithAggregation,
} from './types'
import { VALIDATION_CONSTANTS } from './types'

/**
 * Check if error data matches a specific error selector
 */
export function matchesErrorSelector(data: Hex, selector: keyof typeof ERROR_SELECTORS): boolean {
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

// ============================================================================
// Kernel v0.3.3 Module Operation Error Checkers & Decoders
// ============================================================================

/**
 * Check if error is a ModuleOnUninstallFailed error
 * Emitted when uninstallModule's onUninstall callback reverts (direct call mode).
 */
export function isModuleOnUninstallFailedError(error: unknown): boolean {
  const data = extractErrorData(error)
  if (!data) return false
  return matchesErrorSelector(data, 'ModuleOnUninstallFailed')
}

/**
 * Check if error is a Reentrancy error
 * Triggered by nonReentrantModuleOp modifier (EIP-1153 transient storage).
 */
export function isReentrancyError(error: unknown): boolean {
  const data = extractErrorData(error)
  if (!data) return false
  return matchesErrorSelector(data, 'Reentrancy')
}

/**
 * Check if error is a DelegatecallTargetNotWhitelisted error
 * Triggered when delegatecall whitelist enforcement is active and target is not whitelisted.
 */
export function isDelegatecallNotWhitelistedError(error: unknown): boolean {
  const data = extractErrorData(error)
  if (!data) return false
  return matchesErrorSelector(data, 'DelegatecallTargetNotWhitelisted')
}

/**
 * Decode ModuleOnUninstallFailed error data
 * Error signature: ModuleOnUninstallFailed(uint256 moduleType, address module)
 */
export function decodeModuleOnUninstallFailed(data: Hex): {
  moduleType: bigint
  module: Address
} {
  const params = slice(data, 4)
  const decoded = decodeAbiParameters(
    [
      { name: 'moduleType', type: 'uint256' },
      { name: 'module', type: 'address' },
    ],
    params
  )
  return {
    moduleType: decoded[0] as bigint,
    module: decoded[1] as Address,
  }
}

/**
 * Decode Reentrancy error
 * Error signature: Reentrancy() — no parameters
 */
export function decodeReentrancy(): { name: string; message: string } {
  return {
    name: 'Reentrancy',
    message: 'Reentrancy detected in module operation.',
  }
}

/**
 * Decode DelegatecallTargetNotWhitelisted error data
 * Error signature: DelegatecallTargetNotWhitelisted(address target)
 */
export function decodeDelegatecallTargetNotWhitelisted(data: Hex): {
  target: Address
} {
  const params = slice(data, 4)
  const decoded = decodeAbiParameters(
    [{ name: 'target', type: 'address' }],
    params
  )
  return {
    target: decoded[0] as Address,
  }
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
export function decodeValidationResultWithAggregation(data: Hex): ValidationResultWithAggregation {
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

  const [returnInfo, senderInfo, factoryInfo, paymasterInfo, aggregatorInfo] = decoded

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

// ============================================================================
// Normal Return Decoders (for EntryPointSimulations state override approach)
// These decode return data directly (no 4-byte selector skip).
// ============================================================================

/**
 * Decode ValidationResult from normal return data (EntryPointSimulations).
 * Unlike decodeValidationResult() which skips the 4-byte error selector,
 * this decodes the full ABI-encoded return data from a successful eth_call.
 */
export function decodeValidationResultReturn(data: Hex): ValidationResultWithAggregation {
  const decoded = decodeAbiParameters(
    [
      {
        name: 'result',
        type: 'tuple',
        components: [
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
      },
    ],
    data
  )

  const result = decoded[0] as unknown as {
    returnInfo: ReturnInfo
    senderInfo: StakeInfo
    factoryInfo: StakeInfo
    paymasterInfo: StakeInfo
    aggregatorInfo: AggregatorInfo
  }

  return {
    returnInfo: result.returnInfo,
    senderInfo: result.senderInfo,
    factoryInfo: result.factoryInfo,
    paymasterInfo: result.paymasterInfo,
    aggregatorInfo: result.aggregatorInfo,
  }
}

/**
 * Decode ExecutionResult from normal return data (EntryPointSimulations).
 * Unlike decodeExecutionResult() which skips the 4-byte error selector,
 * this decodes the full ABI-encoded return data from a successful eth_call.
 */
export function decodeExecutionResultReturn(data: Hex): ExecutionResult {
  const decoded = decodeAbiParameters(
    [
      {
        name: 'result',
        type: 'tuple',
        components: [
          { name: 'preOpGas', type: 'uint256' },
          { name: 'paid', type: 'uint256' },
          { name: 'accountValidationData', type: 'uint256' },
          { name: 'paymasterValidationData', type: 'uint256' },
          { name: 'targetSuccess', type: 'bool' },
          { name: 'targetResult', type: 'bytes' },
        ],
      },
    ],
    data
  )

  const result = decoded[0] as unknown as ExecutionResult

  return {
    preOpGas: result.preOpGas,
    paid: result.paid,
    accountValidationData: result.accountValidationData,
    paymasterValidationData: result.paymasterValidationData,
    targetSuccess: result.targetSuccess,
    targetResult: result.targetResult,
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
      const decoded = decodeAbiParameters([{ name: 'reason', type: 'string' }], reason as Hex)
      return decoded[0] as string
    } catch {
      // Return raw hex if decoding fails
      return reason
    }
  }

  return reason
}

/**
 * Parse error from simulation call and return appropriate error details.
 * With v0.9 EntryPointSimulations + state override, ValidationResult/ExecutionResult
 * are returned normally (not as errors). This function only handles error paths:
 * FailedOp, FailedOpWithRevert, and Kernel module errors.
 */
export function parseSimulationError(error: unknown): {
  failedOp?: { opIndex: bigint; reason: string; inner?: Hex }
  rawError?: string
} {
  const data = extractErrorData(error)

  if (!data) {
    return {
      rawError: error instanceof Error ? error.message : String(error),
    }
  }

  // FailedOp
  if (matchesErrorSelector(data, 'FailedOp')) {
    const { opIndex, reason } = decodeFailedOp(data)
    return {
      failedOp: { opIndex, reason },
    }
  }

  // FailedOpWithRevert
  if (matchesErrorSelector(data, 'FailedOpWithRevert')) {
    const { opIndex, reason, inner } = decodeFailedOpWithRevert(data)
    return {
      failedOp: { opIndex, reason, inner },
    }
  }

  // Kernel v0.3.3 module operation errors (may appear as direct revert data)
  if (matchesErrorSelector(data, 'ModuleOnUninstallFailed')) {
    const { moduleType, module } = decodeModuleOnUninstallFailed(data)
    return {
      rawError: `ModuleOnUninstallFailed: type=${moduleType}, module=${module}`,
    }
  }

  if (matchesErrorSelector(data, 'Reentrancy')) {
    return {
      rawError: 'Reentrancy detected in module operation',
    }
  }

  if (matchesErrorSelector(data, 'DelegatecallTargetNotWhitelisted')) {
    const { target } = decodeDelegatecallTargetNotWhitelisted(data)
    return {
      rawError: `DelegatecallTargetNotWhitelisted: target=${target}`,
    }
  }

  return {
    rawError: `Unknown error: ${data}`,
  }
}

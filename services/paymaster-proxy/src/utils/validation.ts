import type { Address, Hex } from 'viem'
import { keccak256, stringToHex } from 'viem'
import { getTimeRangeConfig } from '../config/constants'

export interface ValidationError {
  code: number
  message: string
  data?: unknown
}

/**
 * Validate that validUntil / validAfter form a sane time range.
 *
 * Rules (EIP-4337 Section 6):
 *  - validUntil must be in the future (> now)
 *  - validUntil must be after validAfter
 *  - validity window must not exceed MAX (default 24h)
 *  - validity window must be at least MIN (default 30s)
 *
 * All values are unix-epoch seconds.
 */
export function validateTimeRange(
  validUntil: number,
  validAfter: number,
  now?: number
): ValidationError | null {
  const currentTime = now ?? Math.floor(Date.now() / 1000)
  const { maxValiditySeconds, minValiditySeconds } = getTimeRangeConfig()

  if (validUntil <= currentTime) {
    return {
      code: -32602,
      message: `validUntil (${validUntil}) must be in the future (now: ${currentTime})`,
    }
  }

  if (validUntil <= validAfter) {
    return {
      code: -32602,
      message: `validUntil (${validUntil}) must be greater than validAfter (${validAfter})`,
    }
  }

  const window = validUntil - validAfter
  if (window > maxValiditySeconds) {
    return {
      code: -32602,
      message: `Validity window ${window}s exceeds maximum ${maxValiditySeconds}s`,
    }
  }

  if (window < minValiditySeconds) {
    return {
      code: -32602,
      message: `Validity window ${window}s is below minimum ${minValiditySeconds}s`,
    }
  }

  return null
}

/**
 * Validate chain ID is supported
 */
export function validateChainId(
  chainId: string,
  supportedChainIds: number[]
): ValidationError | null {
  // Number() handles both hex (0x...) and decimal string inputs correctly,
  // whereas parseInt(x, 16) would misparse decimal strings like "8283".
  const chainIdNum = Number(chainId)
  if (!supportedChainIds.includes(chainIdNum)) {
    return {
      code: -32002,
      message: `Chain ${chainIdNum} not supported`,
      data: { supportedChainIds },
    }
  }
  return null
}

/**
 * Validate entry point is supported
 */
export function validateEntryPoint(
  entryPoint: Address,
  supportedEntryPoints: Address[]
): ValidationError | null {
  if (supportedEntryPoints.length === 0) {
    return {
      code: -32003,
      message: 'No supported EntryPoints configured',
    }
  }

  const entryPointLower = entryPoint.toLowerCase()
  const isSupported = supportedEntryPoints.some((ep) => ep.toLowerCase() === entryPointLower)
  if (!isSupported) {
    return {
      code: -32003,
      message: 'EntryPoint not supported',
      data: { supportedEntryPoints },
    }
  }
  return null
}

const ZERO_BYTES32 = ('0x' + '00'.repeat(32)) as Hex

/**
 * Convert a policyId string to bytes32 Hex.
 * - undefined/null → zero bytes32
 * - Already valid bytes32 hex (0x + 64 hex chars) → pass through
 * - Human-readable string → keccak256(stringToHex(string))
 */
export function toPolicyIdBytes32(policyId?: string): Hex {
  if (!policyId) {
    return ZERO_BYTES32
  }

  if (/^0x[0-9a-fA-F]{64}$/.test(policyId)) {
    return policyId as Hex
  }

  return keccak256(stringToHex(policyId))
}

import type { Address, Hex } from 'viem'
import { keccak256, stringToHex } from 'viem'

export interface ValidationError {
  code: number
  message: string
  data?: unknown
}

/**
 * Validate chain ID is supported
 */
export function validateChainId(
  chainId: string,
  supportedChainIds: number[]
): ValidationError | null {
  const chainIdNum = Number.parseInt(chainId, 16)
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

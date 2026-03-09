import type { Address, Hash, Hex } from 'viem'

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/
const HASH_REGEX = /^0x[0-9a-fA-F]{64}$/
const HEX_REGEX = /^0x[0-9a-fA-F]*$/

/** Validate an Ethereum address (0x + 40 hex chars). */
export function isValidAddress(value: unknown): value is Address {
  return typeof value === 'string' && ADDRESS_REGEX.test(value)
}

/** Validate a 32-byte hash (0x + 64 hex chars). */
export function isValidHash(value: unknown): value is Hash {
  return typeof value === 'string' && HASH_REGEX.test(value)
}

/** Validate a hex-encoded chain ID and return the numeric value, or NaN if invalid. */
export function parseChainIdHex(hex: string): number {
  if (!HEX_REGEX.test(hex)) return Number.NaN
  const parsed = Number.parseInt(hex, 16)
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.NaN
  return parsed
}

/**
 * Filter an array to only valid Ethereum addresses.
 * Logs a warning for any invalid entries.
 */
export function filterValidAddresses(values: unknown[]): Address[] {
  const result: Address[] = []
  for (const v of values) {
    if (isValidAddress(v)) {
      result.push(v)
    }
  }
  return result
}

/**
 * Extract revert data from a contract call error.
 * Recursively searches error.data and error.cause for hex revert data.
 */
export function extractRevertData(error: unknown): Hex | undefined {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>
    if (typeof err.data === 'string' && err.data.startsWith('0x')) {
      return err.data as Hex
    }
    if (err.cause && typeof err.cause === 'object') {
      return extractRevertData(err.cause)
    }
  }
  return undefined
}

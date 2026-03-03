/**
 * EntryPoint Module
 *
 * EntryPoint v0.9 constants, ABI, and version detection utilities.
 */

import type { Address } from 'viem'

// Re-export EntryPoint constants and ABI
export { ENTRY_POINT_ADDRESS, ENTRY_POINT_V07_ADDRESS } from '@stablenet/sdk-types'
export { ENTRY_POINT_ABI } from '@stablenet/core'

/** Known EntryPoint v0.9 address (StableNet) */
const ENTRY_POINT_V09_ADDRESS = '0xEf6817fe73741A8F10088f9511c64b666a338A14' as const

/** Known EntryPoint v0.7 address */
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const

/** Known EntryPoint v0.6 address */
const ENTRY_POINT_V06_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as const

/**
 * Detect EntryPoint version from address.
 *
 * @param address - EntryPoint contract address
 * @returns 'v0.9' | 'v0.7' | 'v0.6' | 'unknown'
 */
export function getEntryPointVersion(address: Address): 'v0.9' | 'v0.7' | 'v0.6' | 'unknown' {
  const lower = address.toLowerCase()
  if (lower === ENTRY_POINT_V09_ADDRESS.toLowerCase()) return 'v0.9'
  if (lower === ENTRY_POINT_V07.toLowerCase()) return 'v0.7'
  if (lower === ENTRY_POINT_V06_ADDRESS.toLowerCase()) return 'v0.6'
  return 'unknown'
}

/**
 * Type guard: check if address is the v0.9 EntryPoint.
 */
export function isEntryPointV09(address: Address): boolean {
  return address.toLowerCase() === ENTRY_POINT_V09_ADDRESS.toLowerCase()
}

/**
 * @deprecated Use isEntryPointV09 instead.
 */
export function isEntryPointV07(address: Address): boolean {
  return address.toLowerCase() === ENTRY_POINT_V07.toLowerCase()
}

/**
 * Type guard: check if address is the v0.6 EntryPoint.
 */
export function isEntryPointV06(address: Address): boolean {
  return address.toLowerCase() === ENTRY_POINT_V06_ADDRESS.toLowerCase()
}

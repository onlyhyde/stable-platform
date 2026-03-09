import type { Address } from 'viem'
import {
  ENTRY_POINT_ADDRESS as _ENTRY_POINT_ADDRESS,
  ENTRY_POINT_V07_ADDRESS,
  ENTRY_POINT_V09_ADDRESS,
  ENTRY_POINT_V09_CANONICAL_ADDRESS,
} from '@stablenet/contracts'

/**
 * EntryPoint Addresses
 * Re-exported from @stablenet/contracts (single source of truth)
 */

/**
 * EntryPoint v0.9 address (StableNet deployment)
 */
export const ENTRY_POINT_V09: Address = ENTRY_POINT_V09_ADDRESS

/**
 * EntryPoint v0.9 canonical address (EIP-4337 spec standard)
 */
export const ENTRY_POINT_V09_CANONICAL: Address = ENTRY_POINT_V09_CANONICAL_ADDRESS

/**
 * EntryPoint v0.7 address (same on all EVM chains)
 * @deprecated Use ENTRY_POINT_V09 for new deployments
 */
export const ENTRY_POINT_V07: Address = ENTRY_POINT_V07_ADDRESS

/**
 * EntryPoint v0.6 address (legacy, same on all EVM chains)
 * @deprecated Use ENTRY_POINT_V09 for new deployments
 */
export const ENTRY_POINT_V06: Address = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'

/**
 * EntryPoint addresses by version
 */
export const ENTRY_POINT_ADDRESSES = {
  V09: ENTRY_POINT_V09,
  V07: ENTRY_POINT_V07,
  V06: ENTRY_POINT_V06,
} as const

/**
 * Current recommended EntryPoint version
 */
export const CURRENT_ENTRY_POINT_VERSION = 'V09' as const

/**
 * Current recommended EntryPoint address
 */
export const ENTRY_POINT_ADDRESS: Address = _ENTRY_POINT_ADDRESS

/**
 * Check if an address is a known EntryPoint
 */
export function isEntryPoint(address: Address): boolean {
  const normalized = address.toLowerCase()
  return (
    normalized === ENTRY_POINT_V09.toLowerCase() ||
    normalized === ENTRY_POINT_V07.toLowerCase() ||
    normalized === ENTRY_POINT_V06.toLowerCase()
  )
}

/**
 * Get EntryPoint version from address
 */
export function getEntryPointVersion(address: Address): 'V09' | 'V07' | 'V06' | null {
  const normalized = address.toLowerCase()
  if (normalized === ENTRY_POINT_V09.toLowerCase()) return 'V09'
  if (normalized === ENTRY_POINT_V07.toLowerCase()) return 'V07'
  if (normalized === ENTRY_POINT_V06.toLowerCase()) return 'V06'
  return null
}

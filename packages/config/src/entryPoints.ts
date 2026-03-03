import type { Address } from 'viem'

/**
 * EntryPoint Addresses
 * Official ERC-4337 EntryPoint contract addresses
 */

/**
 * EntryPoint v0.9 address (StableNet deployment)
 */
export const ENTRY_POINT_V09: Address = '0xEf6817fe73741A8F10088f9511c64b666a338A14'

/**
 * EntryPoint v0.7 address (same on all EVM chains)
 * @deprecated Use ENTRY_POINT_V09 for new deployments
 */
export const ENTRY_POINT_V07: Address = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

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
export const ENTRY_POINT_ADDRESS = ENTRY_POINT_V09

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

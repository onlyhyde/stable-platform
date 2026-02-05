import type { Address } from 'viem'

/**
 * EntryPoint v0.7 address (same on all EVM chains)
 */
export const ENTRY_POINT_V07_ADDRESS: Address =
  '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

/**
 * Kernel v3.1 factory address (Sepolia/Mainnet)
 */
export const KERNEL_V3_1_FACTORY_ADDRESS: Address =
  '0x6723b44Abeec4E71eBE3232BD5B455805baDD22f'

/**
 * ECDSA Validator address
 */
export const ECDSA_VALIDATOR_ADDRESS: Address =
  '0xd9AB5096a832b9ce79914329DAEE236f8Eea0390'

/**
 * Kernel implementation addresses
 */
export const KERNEL_ADDRESSES = {
  /** Kernel v3.1 implementation */
  KERNEL_V3_1: '0x94F097E1ebEB4ecA3AAE54cabb08905B239A7D27' as Address,
  /** Kernel v3.0 implementation */
  KERNEL_V3_0: '0xd3082872F8B06073A021b4602e022d5A070d7cfC' as Address,
} as const

// Note: MODULE_TYPE is now defined in module.ts with full ERC-7579 support

/**
 * Kernel execution modes
 */
export const EXEC_MODE = {
  DEFAULT: '0x00' as const,
  TRY: '0x01' as const,
  DELEGATE: '0xff' as const,
} as const

/**
 * Call types for execution
 */
export const CALL_TYPE = {
  SINGLE: '0x00' as const,
  BATCH: '0x01' as const,
  DELEGATE: '0xff' as const,
} as const

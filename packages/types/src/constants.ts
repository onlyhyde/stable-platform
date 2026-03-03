/**
 * Contract address constants - re-exported from @stablenet/contracts (Single Source of Truth)
 *
 * These canonical addresses are the same on all production EVM chains (deployed via CREATE2).
 * For chain-specific addresses (local dev, custom deployments), use:
 *   import { getEntryPoint, getKernelFactory } from '@stablenet/contracts'
 */
export {
  ECDSA_VALIDATOR_ADDRESS,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_V07_ADDRESS,
  KERNEL_ADDRESSES,
  KERNEL_V3_1_FACTORY_ADDRESS,
} from '@stablenet/contracts'

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

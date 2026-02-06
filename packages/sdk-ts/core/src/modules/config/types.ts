/**
 * Module Configuration Types
 *
 * Type definitions for module registry entries.
 */

import type { Address } from 'viem'
import type {
  ModuleType,
  ModuleMetadata,
  ModuleConfigSchema,
} from '@stablenet/sdk-types'

/**
 * Registry entry for a module
 */
export interface ModuleRegistryEntry {
  /** Module metadata */
  metadata: ModuleMetadata

  /** Configuration schema */
  configSchema: ModuleConfigSchema

  /** Chain-specific addresses */
  addresses: Record<number, Address>

  /** Supported chains */
  supportedChains: number[]
}

/**
 * Chain IDs for module deployment
 */
export const SUPPORTED_CHAIN_IDS = {
  MAINNET: 1,
  SEPOLIA: 11155111,
  LOCAL: 31337,
} as const

/**
 * Default supported chains for built-in modules
 */
export const DEFAULT_SUPPORTED_CHAINS = [
  SUPPORTED_CHAIN_IDS.MAINNET,
  SUPPORTED_CHAIN_IDS.SEPOLIA,
  SUPPORTED_CHAIN_IDS.LOCAL,
]

/**
 * Create a module entry helper
 */
export function createModuleEntry(
  metadata: ModuleMetadata,
  configSchema: ModuleConfigSchema,
  addresses: Record<number, Address>,
  supportedChains: number[] = DEFAULT_SUPPORTED_CHAINS
): ModuleRegistryEntry {
  return {
    metadata,
    configSchema,
    addresses,
    supportedChains,
  }
}

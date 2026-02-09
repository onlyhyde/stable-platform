import type { Address, Hex } from 'viem'

import { MODULE_TYPES, type ModuleType } from '@/hooks/useModule'

// ============================================================================
// Contract Addresses (PoC devnet - matching useSmartAccount.ts constants)
// ============================================================================

const ECDSA_VALIDATOR = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707' as const
const SESSION_KEY_VALIDATOR = '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6' as const
const SUBSCRIPTION_EXECUTOR = '0x610178dA211FEF7D417bC0e6FeD39F05609AD788' as const
const SPENDING_LIMIT_HOOK = '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e' as const
const SOCIAL_RECOVERY_VALIDATOR = '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0' as const
const DEX_SWAP_EXECUTOR = '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82' as const
const STEALTH_ADDRESS_FALLBACK = '0x9A676e781A523b5d0C0e43731313A708CB607508' as const
const MULTISIG_VALIDATOR = '0x0B306BF915C4d645ff596e518fAf3F9669b97016' as const

// ============================================================================
// Module Registry
// ============================================================================

export interface ModuleRegistryEntry {
  address: Address
  moduleType: ModuleType
  defaultInitData: Hex
}

/**
 * Maps marketplace module ID to on-chain contract address, type, and default init data.
 * PoC devnet addresses - in production these would come from a registry contract.
 */
export const MODULE_REGISTRY: Record<string, ModuleRegistryEntry> = {
  'ecdsa-validator': {
    address: ECDSA_VALIDATOR,
    moduleType: MODULE_TYPES.VALIDATOR,
    defaultInitData: '0x',
  },
  'session-key-validator': {
    address: SESSION_KEY_VALIDATOR,
    moduleType: MODULE_TYPES.VALIDATOR,
    defaultInitData: '0x',
  },
  'subscription-executor': {
    address: SUBSCRIPTION_EXECUTOR,
    moduleType: MODULE_TYPES.EXECUTOR,
    defaultInitData: '0x',
  },
  'spending-limit-hook': {
    address: SPENDING_LIMIT_HOOK,
    moduleType: MODULE_TYPES.HOOK,
    defaultInitData: '0x',
  },
  'social-recovery': {
    address: SOCIAL_RECOVERY_VALIDATOR,
    moduleType: MODULE_TYPES.VALIDATOR,
    defaultInitData: '0x',
  },
  'dex-swap-executor': {
    address: DEX_SWAP_EXECUTOR,
    moduleType: MODULE_TYPES.EXECUTOR,
    defaultInitData: '0x',
  },
  'stealth-address-fallback': {
    address: STEALTH_ADDRESS_FALLBACK,
    moduleType: MODULE_TYPES.FALLBACK,
    defaultInitData: '0x',
  },
  'multisig-validator': {
    address: MULTISIG_VALIDATOR,
    moduleType: MODULE_TYPES.VALIDATOR,
    defaultInitData: '0x',
  },
} as const

/**
 * Look up a module's registry entry by marketplace ID.
 * Returns undefined if the module ID is not recognized.
 */
export function getModuleEntry(moduleId: string): ModuleRegistryEntry | undefined {
  return MODULE_REGISTRY[moduleId]
}

/**
 * Get all registered module IDs.
 */
export function getRegisteredModuleIds(): string[] {
  return Object.keys(MODULE_REGISTRY)
}

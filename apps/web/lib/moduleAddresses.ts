import type { Address, Hex } from 'viem'

import { MODULE_TYPES, type ModuleType } from '@/hooks/useModule'

// ============================================================================
// Contract Addresses (PoC devnet - matching useSmartAccount.ts constants)
// ============================================================================

const ECDSA_VALIDATOR = '0xb33dc2d82eaee723ca7687d70209ed9a861b3b46' as const
const SESSION_KEY_VALIDATOR = '0x621b0872c00f6328bd9001a121af09dd18b193e0' as const
const SUBSCRIPTION_EXECUTOR = '0x3157c4a86d07a223e3b46f20633f5486e96b8f3c' as const
const SPENDING_LIMIT_HOOK = '0x304cb9f3725e8b807c2fe951c8db7fea4176f1c5' as const
const SOCIAL_RECOVERY_VALIDATOR = '0x38fb544beee122a2ea593e7d9c8f019751273287' as const
const DEX_SWAP_EXECUTOR = '0x2f86f04c1D29Ac39752384B34167a42E6d1730F9' as const
const STEALTH_ADDRESS_FALLBACK = '0x430669578b1e8f02ab648832ef4ec823d814726b' as const
const MULTISIG_VALIDATOR = '0x284d8e1d4864bfab4ea1dfe283f7f849c075bfa5' as const

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

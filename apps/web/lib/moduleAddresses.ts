import type { Address, Hex } from 'viem'

import {
  getContractAddress,
  getEcdsaValidator,
  getMultiSigValidator,
  getRecurringPaymentExecutor,
  getUniswapRouter,
} from '@stablenet/contracts'
import { MODULE_TYPES, type ModuleType } from '@/hooks/useModule'

// ============================================================================
// Contract Addresses (sourced from @stablenet/contracts, chain 8283)
// ============================================================================

const CHAIN_ID = 8283

const ECDSA_VALIDATOR = getEcdsaValidator(CHAIN_ID)
const SESSION_KEY_VALIDATOR = getContractAddress(CHAIN_ID, 'sessionKeyExecutor')
const SUBSCRIPTION_EXECUTOR = getRecurringPaymentExecutor(CHAIN_ID)
const SPENDING_LIMIT_HOOK = getContractAddress(CHAIN_ID, 'spendingLimitHook')
const SOCIAL_RECOVERY_VALIDATOR = getContractAddress(CHAIN_ID, 'weightedEcdsaValidator')
const DEX_SWAP_EXECUTOR = getUniswapRouter(CHAIN_ID)
const STEALTH_ADDRESS_FALLBACK = getContractAddress(CHAIN_ID, 'privateBank')
const MULTISIG_VALIDATOR = getMultiSigValidator(CHAIN_ID)

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
 * Addresses sourced from @stablenet/contracts (chain 8283).
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

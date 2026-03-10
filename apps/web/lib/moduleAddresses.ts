import {
  getContractAddress,
  getEcdsaValidator,
  getMultiSigValidator,
  getRecurringPaymentExecutor,
  getUniswapRouter,
} from '@stablenet/contracts'
import type { ModuleType } from '@stablenet/types'
import { MODULE_TYPE } from '@stablenet/types'
import type { Address, Hex } from 'viem'

// ============================================================================
// Module Registry
// ============================================================================

export interface ModuleRegistryEntry {
  address: Address
  moduleType: ModuleType
  defaultInitData: Hex
}

const DEFAULT_CHAIN_ID = 8283

/**
 * Build the module registry for a given chain.
 * Addresses sourced from @stablenet/contracts.
 */
function buildRegistry(chainId: number): Record<string, ModuleRegistryEntry> {
  return {
    'ecdsa-validator': {
      address: getEcdsaValidator(chainId),
      moduleType: MODULE_TYPE.VALIDATOR,
      defaultInitData: '0x',
    },
    'session-key-validator': {
      address: getContractAddress(chainId, 'sessionKeyExecutor'),
      moduleType: MODULE_TYPE.VALIDATOR,
      defaultInitData: '0x',
    },
    'subscription-executor': {
      address: getRecurringPaymentExecutor(chainId),
      moduleType: MODULE_TYPE.EXECUTOR,
      defaultInitData: '0x',
    },
    'spending-limit-hook': {
      address: getContractAddress(chainId, 'spendingLimitHook'),
      moduleType: MODULE_TYPE.HOOK,
      defaultInitData: '0x',
    },
    'social-recovery': {
      address: getContractAddress(chainId, 'weightedEcdsaValidator'),
      moduleType: MODULE_TYPE.VALIDATOR,
      defaultInitData: '0x',
    },
    'dex-swap-executor': {
      address: getUniswapRouter(chainId),
      moduleType: MODULE_TYPE.EXECUTOR,
      defaultInitData: '0x',
    },
    'stealth-address-fallback': {
      address: getContractAddress(chainId, 'privateBank'),
      moduleType: MODULE_TYPE.FALLBACK,
      defaultInitData: '0x',
    },
    'multisig-validator': {
      address: getMultiSigValidator(chainId),
      moduleType: MODULE_TYPE.VALIDATOR,
      defaultInitData: '0x',
    },
  }
}

// Cache to avoid rebuilding on every call
const registryCache = new Map<number, Record<string, ModuleRegistryEntry>>()

function getRegistry(chainId: number): Record<string, ModuleRegistryEntry> {
  let registry = registryCache.get(chainId)
  if (!registry) {
    registry = buildRegistry(chainId)
    registryCache.set(chainId, registry)
  }
  return registry
}

/**
 * @deprecated Use getModuleEntry(moduleId, chainId) instead.
 * Kept for backward compatibility — defaults to chain 8283.
 */
export const MODULE_REGISTRY: Record<string, ModuleRegistryEntry> = buildRegistry(DEFAULT_CHAIN_ID)

/**
 * Look up a module's registry entry by marketplace ID.
 * Returns undefined if the module ID is not recognized.
 */
export function getModuleEntry(
  moduleId: string,
  chainId: number = DEFAULT_CHAIN_ID
): ModuleRegistryEntry | undefined {
  return getRegistry(chainId)[moduleId]
}

/**
 * Get all registered module IDs.
 */
export function getRegisteredModuleIds(): string[] {
  return Object.keys(MODULE_REGISTRY)
}

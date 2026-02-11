/**
 * Module Query Client
 *
 * Read-only operations for querying Smart Account modules.
 * Follows SRP: only handles module queries, not operations.
 */

import type { InstalledModule, ModuleType } from '@stablenet/sdk-types'
import { MODULE_STATUS, MODULE_TYPE } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { KERNEL_ABI } from '../abis'
import type { RpcProvider } from '../providers'
import { createModuleRegistry, type ModuleRegistry } from './moduleRegistry'

// ============================================================================
// Types
// ============================================================================

/**
 * Module query client configuration
 */
export interface ModuleQueryClientConfig {
  /** Chain ID */
  chainId: number

  /** RPC Provider instance */
  provider: RpcProvider

  /** Optional custom module registry */
  registry?: ModuleRegistry
}

// ============================================================================
// Module Query Client
// ============================================================================

/**
 * Create a module query client for reading Smart Account module state
 *
 * @example
 * ```typescript
 * const queryClient = createModuleQueryClient({
 *   chainId: 1,
 *   provider: myProvider,
 * })
 *
 * // Check if module is installed
 * const isInstalled = await queryClient.isModuleInstalled(
 *   accountAddress,
 *   moduleAddress,
 *   MODULE_TYPE.VALIDATOR
 * )
 *
 * // Get all installed modules
 * const modules = await queryClient.getInstalledModules(accountAddress)
 * ```
 */
export function createModuleQueryClient(config: ModuleQueryClientConfig) {
  const { chainId, provider, registry: injectedRegistry } = config

  // Use injected registry or create one
  const registry = injectedRegistry ?? createModuleRegistry({ chainId })

  /**
   * Check if a module is installed on a Smart Account
   */
  async function isModuleInstalled(
    account: Address,
    moduleAddress: Address,
    moduleType: ModuleType
  ): Promise<boolean> {
    try {
      const result = await provider.readContract<boolean>({
        address: account,
        abi: KERNEL_ABI,
        functionName: 'isModuleInstalled',
        args: [moduleType, moduleAddress, '0x'],
      })

      return result
    } catch {
      // Account might not be a Smart Account
      return false
    }
  }

  /**
   * Get all installed modules for a Smart Account
   */
  async function getInstalledModules(account: Address): Promise<InstalledModule[]> {
    // Check each known module from registry
    const allModules = registry.getAll()

    // Check in parallel
    const checks = await Promise.all(
      allModules.map(async (entry) => {
        const moduleAddress = registry.getModuleAddress(entry)
        if (!moduleAddress) return null

        const installed = await isModuleInstalled(account, moduleAddress, entry.metadata.type)

        if (installed) {
          return {
            address: moduleAddress,
            type: entry.metadata.type,
            metadata: {
              ...entry.metadata,
              address: moduleAddress,
            },
            initData: '0x' as Hex, // Would need to decode from events
            status: MODULE_STATUS.INSTALLED,
          } as InstalledModule
        }

        return null
      })
    )

    return checks.filter((m): m is InstalledModule => m !== null)
  }

  /**
   * Get installed modules by type
   */
  async function getInstalledModulesByType(
    account: Address,
    type: ModuleType
  ): Promise<InstalledModule[]> {
    const allInstalled = await getInstalledModules(account)
    return allInstalled.filter((m) => m.type === type)
  }

  /**
   * Get the primary validator for a Smart Account
   */
  async function getPrimaryValidator(account: Address): Promise<InstalledModule | null> {
    const validators = await getInstalledModulesByType(account, MODULE_TYPE.VALIDATOR)
    return validators[0] ?? null
  }

  /**
   * Check if account has any validators installed
   */
  async function hasValidator(account: Address): Promise<boolean> {
    const validators = await getInstalledModulesByType(account, MODULE_TYPE.VALIDATOR)
    return validators.length > 0
  }

  /**
   * Check if account has any hooks installed
   */
  async function hasHooks(account: Address): Promise<boolean> {
    const hooks = await getInstalledModulesByType(account, MODULE_TYPE.HOOK)
    return hooks.length > 0
  }

  /**
   * Get installed executors for a Smart Account
   */
  async function getInstalledExecutors(account: Address): Promise<InstalledModule[]> {
    return getInstalledModulesByType(account, MODULE_TYPE.EXECUTOR)
  }

  /**
   * Get installed fallback handlers for a Smart Account
   */
  async function getInstalledFallbacks(account: Address): Promise<InstalledModule[]> {
    return getInstalledModulesByType(account, MODULE_TYPE.FALLBACK)
  }

  return {
    // Core queries
    isModuleInstalled,
    getInstalledModules,
    getInstalledModulesByType,

    // Convenience queries
    getPrimaryValidator,
    hasValidator,
    hasHooks,
    getInstalledExecutors,
    getInstalledFallbacks,

    // Registry access
    registry,
  }
}

// ============================================================================
// Exports
// ============================================================================

export type ModuleQueryClient = ReturnType<typeof createModuleQueryClient>

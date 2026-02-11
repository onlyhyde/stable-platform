/**
 * Module Registry
 *
 * Registry for discovering and querying ERC-7579 modules.
 * Follows SRP: handles only registry queries and validation.
 * Module definitions are in ./config/
 */

import type { ModuleConfigField, ModuleType, SolidityType } from '@stablenet/sdk-types'
import { MODULE_TYPE } from '@stablenet/sdk-types'
import type { Address } from 'viem'
import {
  BUILT_IN_MODULES,
  // Re-export individual modules for backwards compatibility
  ECDSA_VALIDATOR,
  type ModuleRegistryEntry,
  MULTISIG_VALIDATOR,
  RECURRING_PAYMENT_EXECUTOR,
  SESSION_KEY_EXECUTOR,
  SPENDING_LIMIT_HOOK,
  TOKEN_RECEIVER_FALLBACK,
  WEBAUTHN_VALIDATOR,
} from './config'

// ============================================================================
// Types
// ============================================================================

/**
 * Module search filters
 */
export interface ModuleSearchFilters {
  /** Filter by module type */
  type?: ModuleType

  /** Filter by tags */
  tags?: string[]

  /** Filter by verified status */
  verified?: boolean

  /** Filter by chain support */
  chainId?: number

  /** Search by name/description */
  query?: string
}

/**
 * Module registry configuration
 */
export interface ModuleRegistryConfig {
  /** Additional custom modules */
  customModules?: ModuleRegistryEntry[]

  /** Chain ID for address resolution */
  chainId: number
}

// ============================================================================
// Module Registry
// ============================================================================

/**
 * Create a module registry
 *
 * @example
 * ```typescript
 * const registry = createModuleRegistry({
 *   chainId: 1,
 *   customModules: [myCustomModule],
 * })
 *
 * // Get all validators
 * const validators = registry.getByType(MODULE_TYPE.VALIDATOR)
 *
 * // Search modules
 * const results = registry.search({ query: 'session', verified: true })
 * ```
 */
export function createModuleRegistry(config: ModuleRegistryConfig) {
  const { chainId, customModules = [] } = config

  // Combine built-in and custom modules
  const allModules: ModuleRegistryEntry[] = [...BUILT_IN_MODULES, ...customModules]

  /**
   * Get all registered modules for current chain
   */
  function getAll(): ModuleRegistryEntry[] {
    return allModules.filter((m) => m.supportedChains.includes(chainId))
  }

  /**
   * Get module by address
   */
  function getByAddress(address: Address): ModuleRegistryEntry | null {
    const normalizedAddress = address.toLowerCase()
    return allModules.find((m) => m.addresses[chainId]?.toLowerCase() === normalizedAddress) ?? null
  }

  /**
   * Get modules by type
   */
  function getByType(type: ModuleType): ModuleRegistryEntry[] {
    return getAll().filter((m) => m.metadata.type === type)
  }

  /**
   * Get modules by tags
   */
  function getByTags(tags: string[]): ModuleRegistryEntry[] {
    return getAll().filter((m) => tags.some((tag) => m.metadata.tags.includes(tag)))
  }

  /**
   * Search modules with filters
   */
  function search(filters: ModuleSearchFilters): ModuleRegistryEntry[] {
    let results = getAll()

    // Filter by type
    if (filters.type !== undefined) {
      results = results.filter((m) => m.metadata.type === filters.type)
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter((m) => filters.tags!.some((tag) => m.metadata.tags.includes(tag)))
    }

    // Filter by verified
    if (filters.verified !== undefined) {
      results = results.filter((m) => m.metadata.isVerified === filters.verified)
    }

    // Filter by chain support
    if (filters.chainId !== undefined) {
      results = results.filter((m) => m.supportedChains.includes(filters.chainId!))
    }

    // Filter by query (name/description)
    if (filters.query) {
      const query = filters.query.toLowerCase()
      results = results.filter(
        (m) =>
          m.metadata.name.toLowerCase().includes(query) ||
          m.metadata.description.toLowerCase().includes(query)
      )
    }

    return results
  }

  /**
   * Get module address for current chain
   */
  function getModuleAddress(entry: ModuleRegistryEntry): Address | null {
    return entry.addresses[chainId] ?? null
  }

  /**
   * Validate configuration against schema
   */
  function validateConfig(
    entry: ModuleRegistryEntry,
    config: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const schema = entry.configSchema

    for (const field of schema.fields) {
      const value = config[field.name]

      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field.label} is required`)
        continue
      }

      // Skip validation for optional empty fields
      if (!field.required && (value === undefined || value === null)) {
        continue
      }

      // Type-specific validation
      if (field.validation) {
        const validationError = validateFieldValue(field, value)
        if (validationError) {
          errors.push(validationError)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get grouped modules by type
   */
  function getGroupedByType(): {
    validators: ModuleRegistryEntry[]
    executors: ModuleRegistryEntry[]
    hooks: ModuleRegistryEntry[]
    fallbacks: ModuleRegistryEntry[]
    policies: ModuleRegistryEntry[]
    signers: ModuleRegistryEntry[]
  } {
    const grouped = {
      validators: [] as ModuleRegistryEntry[],
      executors: [] as ModuleRegistryEntry[],
      hooks: [] as ModuleRegistryEntry[],
      fallbacks: [] as ModuleRegistryEntry[],
      policies: [] as ModuleRegistryEntry[],
      signers: [] as ModuleRegistryEntry[],
    }

    for (const module of getAll()) {
      switch (module.metadata.type) {
        case MODULE_TYPE.VALIDATOR:
          grouped.validators.push(module)
          break
        case MODULE_TYPE.EXECUTOR:
          grouped.executors.push(module)
          break
        case MODULE_TYPE.HOOK:
          grouped.hooks.push(module)
          break
        case MODULE_TYPE.FALLBACK:
          grouped.fallbacks.push(module)
          break
        case MODULE_TYPE.POLICY:
          grouped.policies.push(module)
          break
        case MODULE_TYPE.SIGNER:
          grouped.signers.push(module)
          break
      }
    }

    return grouped
  }

  return {
    getAll,
    getByAddress,
    getByType,
    getByTags,
    search,
    getModuleAddress,
    validateConfig,
    getGroupedByType,
  }
}

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validate field value against rules
 */
function validateFieldValue(field: ModuleConfigField, value: unknown): string | null {
  const { validation } = field

  if (!validation) return null

  // Numeric validation
  if (isNumericType(field.type)) {
    const numValue = BigInt(String(value))

    if (validation.min !== undefined) {
      const min = BigInt(validation.min)
      if (numValue < min) {
        return validation.message ?? `${field.label} must be at least ${validation.min}`
      }
    }

    if (validation.max !== undefined) {
      const max = BigInt(validation.max)
      if (numValue > max) {
        return validation.message ?? `${field.label} must be at most ${validation.max}`
      }
    }
  }

  // Pattern validation for strings
  if (field.type === 'string' && validation.pattern) {
    const regex = new RegExp(validation.pattern)
    if (!regex.test(String(value))) {
      return validation.message ?? `${field.label} has invalid format`
    }
  }

  return null
}

/**
 * Check if type is numeric
 */
function isNumericType(type: SolidityType): boolean {
  return type.startsWith('uint') || type.startsWith('int')
}

// ============================================================================
// Exports
// ============================================================================

export type ModuleRegistry = ReturnType<typeof createModuleRegistry>

// Re-export module definitions for backwards compatibility
export {
  type ModuleRegistryEntry,
  ECDSA_VALIDATOR,
  WEBAUTHN_VALIDATOR,
  MULTISIG_VALIDATOR,
  SESSION_KEY_EXECUTOR,
  RECURRING_PAYMENT_EXECUTOR,
  SPENDING_LIMIT_HOOK,
  TOKEN_RECEIVER_FALLBACK,
  BUILT_IN_MODULES,
}

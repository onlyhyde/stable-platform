import type { Address } from 'viem'
import type {
  ModuleType,
  ModuleMetadata,
  ModuleConfigSchema,
  ModuleConfigField,
  SolidityType,
} from '@stablenet/types'
import { MODULE_TYPE } from '@stablenet/types'

// ============================================================================
// Types
// ============================================================================

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
// Built-in Module Definitions
// ============================================================================

/**
 * ECDSA Validator module definition
 */
const ECDSA_VALIDATOR: ModuleRegistryEntry = {
  metadata: {
    address: '0x0000000000000000000000000000000000000000' as Address, // Placeholder
    type: MODULE_TYPE.VALIDATOR,
    name: 'ECDSA Validator',
    description: 'Standard ECDSA signature validation for EOA-like security',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['validator', 'ecdsa', 'default'],
    docsUrl: 'https://docs.stablenet.io/modules/ecdsa-validator',
  },
  configSchema: {
    version: '1.0.0',
    fields: [
      {
        name: 'owner',
        label: 'Owner Address',
        description: 'The address that can sign transactions',
        type: 'address',
        required: true,
      },
    ],
  },
  addresses: {
    1: '0xd9AB5096a832b9ce79914329DAEE236f8Eea0390' as Address, // Mainnet
    11155111: '0xd9AB5096a832b9ce79914329DAEE236f8Eea0390' as Address, // Sepolia
    31337: '0xd9AB5096a832b9ce79914329DAEE236f8Eea0390' as Address, // Local
  },
  supportedChains: [1, 11155111, 31337],
}

/**
 * WebAuthn Validator module definition
 */
const WEBAUTHN_VALIDATOR: ModuleRegistryEntry = {
  metadata: {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.VALIDATOR,
    name: 'WebAuthn Validator',
    description: 'Passkey authentication using WebAuthn/FIDO2',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['validator', 'webauthn', 'passkey', 'biometric'],
    docsUrl: 'https://docs.stablenet.io/modules/webauthn-validator',
  },
  configSchema: {
    version: '1.0.0',
    fields: [
      {
        name: 'pubKeyX',
        label: 'Public Key X',
        description: 'X coordinate of the WebAuthn public key',
        type: 'uint256',
        required: true,
      },
      {
        name: 'pubKeyY',
        label: 'Public Key Y',
        description: 'Y coordinate of the WebAuthn public key',
        type: 'uint256',
        required: true,
      },
      {
        name: 'credentialId',
        label: 'Credential ID',
        description: 'WebAuthn credential identifier',
        type: 'bytes',
        required: true,
      },
    ],
  },
  addresses: {
    1: '0x0000000000000000000000000000000000000000' as Address,
    11155111: '0x0000000000000000000000000000000000000000' as Address,
    31337: '0x0000000000000000000000000000000000000000' as Address,
  },
  supportedChains: [1, 11155111, 31337],
}

/**
 * MultiSig Validator module definition
 */
const MULTISIG_VALIDATOR: ModuleRegistryEntry = {
  metadata: {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.VALIDATOR,
    name: 'MultiSig Validator',
    description: 'Multi-signature validation requiring M-of-N signatures',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['validator', 'multisig', 'security'],
    docsUrl: 'https://docs.stablenet.io/modules/multisig-validator',
  },
  configSchema: {
    version: '1.0.0',
    fields: [
      {
        name: 'signers',
        label: 'Signers',
        description: 'List of authorized signer addresses',
        type: 'address[]',
        required: true,
      },
      {
        name: 'threshold',
        label: 'Threshold',
        description: 'Number of required signatures',
        type: 'uint8',
        required: true,
        validation: {
          min: '1',
          message: 'Threshold must be at least 1',
        },
      },
    ],
  },
  addresses: {
    1: '0x0000000000000000000000000000000000000000' as Address,
    11155111: '0x0000000000000000000000000000000000000000' as Address,
    31337: '0x0000000000000000000000000000000000000000' as Address,
  },
  supportedChains: [1, 11155111, 31337],
}

/**
 * Session Key Executor module definition
 */
const SESSION_KEY_EXECUTOR: ModuleRegistryEntry = {
  metadata: {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.EXECUTOR,
    name: 'Session Key',
    description: 'Temporary keys with limited permissions for dApp sessions',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['executor', 'session', 'dapp', 'permissions'],
    docsUrl: 'https://docs.stablenet.io/modules/session-key',
  },
  configSchema: {
    version: '1.0.0',
    fields: [
      {
        name: 'sessionKey',
        label: 'Session Key Address',
        description: 'Temporary key that can execute transactions',
        type: 'address',
        required: true,
      },
      {
        name: 'allowedTargets',
        label: 'Allowed Targets',
        description: 'Contract addresses the session key can interact with',
        type: 'address[]',
        required: true,
      },
      {
        name: 'allowedSelectors',
        label: 'Allowed Functions',
        description: 'Function selectors that can be called',
        type: 'bytes4[]',
        required: false,
      },
      {
        name: 'maxValuePerTx',
        label: 'Max Value Per Transaction',
        description: 'Maximum ETH value per transaction (in wei)',
        type: 'uint256',
        required: true,
        defaultValue: '0',
      },
      {
        name: 'validUntil',
        label: 'Valid Until',
        description: 'Expiration timestamp',
        type: 'uint64',
        required: true,
      },
      {
        name: 'validAfter',
        label: 'Valid After',
        description: 'Start timestamp',
        type: 'uint64',
        required: true,
        defaultValue: '0',
      },
    ],
  },
  addresses: {
    1: '0x0000000000000000000000000000000000000000' as Address,
    11155111: '0x0000000000000000000000000000000000000000' as Address,
    31337: '0x0000000000000000000000000000000000000000' as Address,
  },
  supportedChains: [1, 11155111, 31337],
}

/**
 * Recurring Payment Executor module definition
 */
const RECURRING_PAYMENT_EXECUTOR: ModuleRegistryEntry = {
  metadata: {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.EXECUTOR,
    name: 'Recurring Payment',
    description: 'Automated recurring payments (subscriptions, salary, etc.)',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['executor', 'payment', 'subscription', 'automation'],
    docsUrl: 'https://docs.stablenet.io/modules/recurring-payment',
  },
  configSchema: {
    version: '1.0.0',
    fields: [
      {
        name: 'recipient',
        label: 'Recipient',
        description: 'Address to receive payments',
        type: 'address',
        required: true,
      },
      {
        name: 'token',
        label: 'Token',
        description: 'Token address (0x0 for native ETH)',
        type: 'address',
        required: true,
        defaultValue: '0x0000000000000000000000000000000000000000',
      },
      {
        name: 'amount',
        label: 'Amount',
        description: 'Payment amount per interval',
        type: 'uint256',
        required: true,
      },
      {
        name: 'interval',
        label: 'Interval',
        description: 'Payment interval in seconds',
        type: 'uint64',
        required: true,
        validation: {
          min: '86400', // 1 day minimum
          message: 'Interval must be at least 1 day (86400 seconds)',
        },
      },
      {
        name: 'maxPayments',
        label: 'Max Payments',
        description: 'Maximum number of payments (0 for unlimited)',
        type: 'uint32',
        required: true,
        defaultValue: '0',
      },
    ],
  },
  addresses: {
    1: '0x0000000000000000000000000000000000000000' as Address,
    11155111: '0x0000000000000000000000000000000000000000' as Address,
    31337: '0x0000000000000000000000000000000000000000' as Address,
  },
  supportedChains: [1, 11155111, 31337],
}

/**
 * Spending Limit Hook module definition
 */
const SPENDING_LIMIT_HOOK: ModuleRegistryEntry = {
  metadata: {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.HOOK,
    name: 'Spending Limit',
    description: 'Limit spending per time period for enhanced security',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['hook', 'security', 'limit', 'spending'],
    docsUrl: 'https://docs.stablenet.io/modules/spending-limit',
  },
  configSchema: {
    version: '1.0.0',
    fields: [
      {
        name: 'token',
        label: 'Token',
        description: 'Token to limit (0x0 for native ETH)',
        type: 'address',
        required: true,
        defaultValue: '0x0000000000000000000000000000000000000000',
      },
      {
        name: 'limit',
        label: 'Spending Limit',
        description: 'Maximum amount per period',
        type: 'uint256',
        required: true,
      },
      {
        name: 'period',
        label: 'Reset Period',
        description: 'Period in seconds before limit resets',
        type: 'uint64',
        required: true,
        validation: {
          min: '3600', // 1 hour minimum
          message: 'Period must be at least 1 hour (3600 seconds)',
        },
      },
    ],
  },
  addresses: {
    1: '0x0000000000000000000000000000000000000000' as Address,
    11155111: '0x0000000000000000000000000000000000000000' as Address,
    31337: '0x0000000000000000000000000000000000000000' as Address,
  },
  supportedChains: [1, 11155111, 31337],
}

/**
 * Token Receiver Fallback module definition
 */
const TOKEN_RECEIVER_FALLBACK: ModuleRegistryEntry = {
  metadata: {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.FALLBACK,
    name: 'Token Receiver',
    description: 'Enable receiving ERC721, ERC1155, and other token standards',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['fallback', 'token', 'nft', 'erc721', 'erc1155'],
    docsUrl: 'https://docs.stablenet.io/modules/token-receiver',
  },
  configSchema: {
    version: '1.0.0',
    fields: [], // No configuration needed
  },
  addresses: {
    1: '0x0000000000000000000000000000000000000000' as Address,
    11155111: '0x0000000000000000000000000000000000000000' as Address,
    31337: '0x0000000000000000000000000000000000000000' as Address,
  },
  supportedChains: [1, 11155111, 31337],
}

// ============================================================================
// Built-in Modules Collection
// ============================================================================

const BUILT_IN_MODULES: ModuleRegistryEntry[] = [
  ECDSA_VALIDATOR,
  WEBAUTHN_VALIDATOR,
  MULTISIG_VALIDATOR,
  SESSION_KEY_EXECUTOR,
  RECURRING_PAYMENT_EXECUTOR,
  SPENDING_LIMIT_HOOK,
  TOKEN_RECEIVER_FALLBACK,
]

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
   * Get all registered modules
   */
  function getAll(): ModuleRegistryEntry[] {
    return allModules.filter((m) => m.supportedChains.includes(chainId))
  }

  /**
   * Get module by address
   */
  function getByAddress(address: Address): ModuleRegistryEntry | null {
    const normalizedAddress = address.toLowerCase()
    return (
      allModules.find(
        (m) => m.addresses[chainId]?.toLowerCase() === normalizedAddress
      ) ?? null
    )
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
    return getAll().filter((m) =>
      tags.some((tag) => m.metadata.tags.includes(tag))
    )
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
      results = results.filter((m) =>
        filters.tags!.some((tag) => m.metadata.tags.includes(tag))
      )
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
// Helper Functions
// ============================================================================

/**
 * Validate field value against rules
 */
function validateFieldValue(
  field: ModuleConfigField,
  value: unknown
): string | null {
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
  return (
    type.startsWith('uint') ||
    type.startsWith('int') ||
    type === 'uint8' ||
    type === 'uint16' ||
    type === 'uint32' ||
    type === 'uint64' ||
    type === 'uint128' ||
    type === 'uint256'
  )
}

// ============================================================================
// Exports
// ============================================================================

export type ModuleRegistry = ReturnType<typeof createModuleRegistry>

export {
  ECDSA_VALIDATOR,
  WEBAUTHN_VALIDATOR,
  MULTISIG_VALIDATOR,
  SESSION_KEY_EXECUTOR,
  RECURRING_PAYMENT_EXECUTOR,
  SPENDING_LIMIT_HOOK,
  TOKEN_RECEIVER_FALLBACK,
  BUILT_IN_MODULES,
}

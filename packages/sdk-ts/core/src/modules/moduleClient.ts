/**
 * Module Client
 *
 * Unified client for managing Smart Account modules.
 * Composes ModuleQueryClient and ModuleOperationClient.
 * Provides backwards-compatible API while delegating to specialized clients.
 */

import type { ModuleType } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { ConfigurationError } from '../errors'
import { createViemProvider, type RpcProvider } from '../providers'
import { createModuleRegistry } from './moduleRegistry'
import {
  type ConflictCheckResult,
  createModuleOperationClient,
  type ModuleCalldata,
  type ValidationResult,
} from './operationClient'
import { createModuleQueryClient } from './queryClient'
import { encodeSessionKeyInit } from './utils/executorUtils'
import { encodeSpendingLimitInit } from './utils/hookUtils'
// Re-export encoding utils for convenience (use these instead of deprecated helpers)
import { encodeECDSAValidatorInit, encodeWebAuthnValidatorInit } from './utils/validatorUtils'

// ============================================================================
// Types
// ============================================================================

/**
 * Module client configuration
 */
export interface ModuleClientConfig {
  /** RPC URL for the network (used if provider not specified) */
  rpcUrl?: string

  /** Chain ID */
  chainId: number

  /** Bundler URL for UserOperation submission */
  bundlerUrl?: string

  /** Paymaster URL for gas sponsorship */
  paymasterUrl?: string

  /** RPC Provider instance (DIP: allows dependency injection) */
  provider?: RpcProvider
}

/**
 * Module installation result
 */
export interface ModuleInstallResult {
  /** Transaction/UserOp hash */
  hash: Hex

  /** Module address */
  moduleAddress: Address

  /** Module type */
  moduleType: ModuleType

  /** Success status */
  success: boolean

  /** Error message if failed */
  error?: string
}

// Re-export types from operation client
export type { ModuleCalldata, ValidationResult, ConflictCheckResult }

// ============================================================================
// Module Client
// ============================================================================

/**
 * Create a module client for managing Smart Account modules
 *
 * This client composes ModuleQueryClient (read operations) and
 * ModuleOperationClient (write operations) for a unified API.
 *
 * @example
 * ```typescript
 * const client = createModuleClient({
 *   rpcUrl: 'https://rpc.example.com',
 *   chainId: 1,
 *   bundlerUrl: 'https://bundler.example.com',
 * })
 *
 * // Get installed modules (query)
 * const modules = await client.getInstalledModules(smartAccountAddress)
 *
 * // Prepare module installation (operation)
 * const calldata = client.prepareInstall(accountAddress, {
 *   moduleAddress: validatorAddress,
 *   moduleType: MODULE_TYPE.VALIDATOR,
 *   initData: encodedInitData,
 * })
 * ```
 */
export function createModuleClient(config: ModuleClientConfig) {
  const { rpcUrl, chainId, provider: injectedProvider } = config

  // DIP: Use injected provider or create one from rpcUrl
  if (!injectedProvider && !rpcUrl) {
    throw new ConfigurationError('Either provider or rpcUrl must be provided', 'provider', {
      operation: 'createModuleClient',
    })
  }

  const provider: RpcProvider =
    injectedProvider ??
    createViemProvider({
      rpcUrl: rpcUrl!,
      chainId,
    })

  // Create shared registry
  const registry = createModuleRegistry({ chainId })

  // Create specialized clients
  const queryClient = createModuleQueryClient({
    chainId,
    provider,
    registry,
  })

  const operationClient = createModuleOperationClient({
    chainId,
    registry,
    queryClient,
  })

  // ============================================================================
  // Deprecated Encoding Helpers (for backwards compatibility)
  // Use utils/validatorUtils, utils/executorUtils, utils/hookUtils instead
  // ============================================================================

  /**
   * @deprecated Use encodeECDSAValidatorInit from './utils/validatorUtils' instead
   */
  function encodeECDSAValidatorInitData(owner: Address): Hex {
    return encodeECDSAValidatorInit({ owner })
  }

  /**
   * @deprecated Use encodeWebAuthnValidatorInit from './utils/validatorUtils' instead
   */
  function encodeWebAuthnValidatorInitData(
    pubKeyX: bigint,
    pubKeyY: bigint,
    credentialId: Hex
  ): Hex {
    return encodeWebAuthnValidatorInit({
      pubKeyX,
      pubKeyY,
      credentialId,
    })
  }

  /**
   * @deprecated Use encodeSessionKeyInit from './utils/executorUtils' instead
   */
  function encodeSessionKeyInitData(config: {
    sessionKey: Address
    allowedTargets: Address[]
    allowedSelectors: Hex[]
    maxValuePerTx: bigint
    validUntil: number
    validAfter: number
  }): Hex {
    // Direct pass to encodeSessionKeyInit which handles BigInt conversion internally
    return encodeSessionKeyInit({
      sessionKey: config.sessionKey,
      allowedTargets: config.allowedTargets,
      allowedSelectors: config.allowedSelectors,
      maxValuePerTx: config.maxValuePerTx,
      validUntil: config.validUntil,
      validAfter: config.validAfter,
    })
  }

  /**
   * @deprecated Use encodeSpendingLimitInit from './utils/hookUtils' instead
   */
  function encodeSpendingLimitInitData(config: {
    token: Address
    limit: bigint
    period: number
  }): Hex {
    return encodeSpendingLimitInit({
      token: config.token,
      limit: config.limit,
      period: config.period,
    })
  }

  return {
    // Query operations (delegated to queryClient)
    isModuleInstalled: queryClient.isModuleInstalled,
    getInstalledModules: queryClient.getInstalledModules,
    getInstalledModulesByType: queryClient.getInstalledModulesByType,
    getPrimaryValidator: queryClient.getPrimaryValidator,

    // Operation preparation (delegated to operationClient)
    prepareInstall: operationClient.prepareInstall,
    prepareUninstall: operationClient.prepareUninstall,
    prepareBatchInstall: operationClient.prepareBatchInstall,
    prepareBatchUninstall: operationClient.prepareBatchUninstall,

    // Validation (delegated to operationClient)
    validateInstallRequest: operationClient.validateInstallRequest,
    checkInstallConflicts: operationClient.checkInstallConflicts,

    // Deprecated encoding helpers (for backwards compatibility)
    encodeECDSAValidatorInitData,
    encodeWebAuthnValidatorInitData,
    encodeSessionKeyInitData,
    encodeSpendingLimitInitData,

    // Registry access
    registry,

    // Expose sub-clients for advanced usage
    queryClient,
    operationClient,
  }
}

// ============================================================================
// Exports
// ============================================================================

export type ModuleClient = ReturnType<typeof createModuleClient>

export { createModuleOperationClient, type ModuleOperationClient } from './operationClient'
// Re-export sub-clients for direct usage
export { createModuleQueryClient, type ModuleQueryClient } from './queryClient'

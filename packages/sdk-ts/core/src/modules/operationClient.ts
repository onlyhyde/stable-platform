/**
 * Module Operation Client
 *
 * Prepare and validate module installation/uninstallation operations.
 * Follows SRP: only handles module operations, not queries.
 */

import type {
  DelegatecallWhitelistEnforceRequest,
  DelegatecallWhitelistRequest,
  HookGasLimitRequest,
  ModuleForceUninstallRequest,
  ModuleInstallRequest,
  ModuleReplaceRequest,
  ModuleUninstallRequest,
} from '@stablenet/sdk-types'
import { getModuleTypeName, MODULE_TYPE } from '@stablenet/sdk-types'
import type { Address, Hex } from 'viem'
import { encodeFunctionData } from 'viem'
import { KERNEL_ABI } from '../abis'
import { createModuleRegistry, type ModuleRegistry } from './moduleRegistry'
import type { ModuleQueryClient } from './queryClient'

// ============================================================================
// Types
// ============================================================================

/**
 * Module operation client configuration
 */
export interface ModuleOperationClientConfig {
  /** Chain ID */
  chainId: number

  /** Optional custom module registry */
  registry?: ModuleRegistry

  /** Optional query client for conflict checking */
  queryClient?: ModuleQueryClient
}

/**
 * Module operation calldata
 */
export interface ModuleCalldata {
  /** Target address (Smart Account) */
  to: Address

  /** Calldata for the operation */
  data: Hex

  /** Value (usually 0) */
  value: bigint
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Conflict check result
 */
export interface ConflictCheckResult {
  hasConflict: boolean
  conflictReason?: string
}

// ============================================================================
// Module Operation Client
// ============================================================================

/**
 * Create a module operation client for preparing Smart Account module operations
 *
 * @example
 * ```typescript
 * const opClient = createModuleOperationClient({
 *   chainId: 1,
 * })
 *
 * // Validate request
 * const validation = opClient.validateInstallRequest(request)
 *
 * // Prepare installation calldata
 * const calldata = opClient.prepareInstall(accountAddress, request)
 * ```
 */
export function createModuleOperationClient(config: ModuleOperationClientConfig) {
  const { chainId, registry: injectedRegistry, queryClient } = config

  // Use injected registry or create one
  const registry = injectedRegistry ?? createModuleRegistry({ chainId })

  // ============================================================================
  // Calldata Preparation
  // ============================================================================

  /**
   * Prepare calldata for module installation
   */
  function prepareInstall(account: Address, request: ModuleInstallRequest): ModuleCalldata {
    const data = encodeFunctionData({
      abi: KERNEL_ABI,
      functionName: 'installModule',
      args: [request.moduleType, request.moduleAddress, request.initData],
    })

    return {
      to: account,
      data,
      value: 0n,
    }
  }

  /**
   * Prepare calldata for module uninstallation
   */
  function prepareUninstall(account: Address, request: ModuleUninstallRequest): ModuleCalldata {
    const data = encodeFunctionData({
      abi: KERNEL_ABI,
      functionName: 'uninstallModule',
      args: [request.moduleType, request.moduleAddress, request.deInitData],
    })

    return {
      to: account,
      data,
      value: 0n,
    }
  }

  /**
   * Prepare batch module installation
   */
  function prepareBatchInstall(
    account: Address,
    requests: ModuleInstallRequest[]
  ): ModuleCalldata[] {
    return requests.map((request) => prepareInstall(account, request))
  }

  /**
   * Prepare batch module uninstallation
   */
  function prepareBatchUninstall(
    account: Address,
    requests: ModuleUninstallRequest[]
  ): ModuleCalldata[] {
    return requests.map((request) => prepareUninstall(account, request))
  }

  /**
   * Prepare calldata for force module uninstallation (ExcessivelySafeCall)
   */
  function prepareForceUninstall(
    account: Address,
    request: ModuleForceUninstallRequest
  ): ModuleCalldata {
    const data = encodeFunctionData({
      abi: KERNEL_ABI,
      functionName: 'forceUninstallModule',
      args: [request.moduleType, request.moduleAddress, request.deInitData],
    })

    return {
      to: account,
      data,
      value: 0n,
    }
  }

  /**
   * Prepare calldata for atomic module replacement
   */
  function prepareReplaceModule(
    account: Address,
    request: ModuleReplaceRequest
  ): ModuleCalldata {
    const data = encodeFunctionData({
      abi: KERNEL_ABI,
      functionName: 'replaceModule',
      args: [
        request.moduleType,
        request.oldModuleAddress,
        request.deInitData,
        request.newModuleAddress,
        request.initData,
      ],
    })

    return {
      to: account,
      data,
      value: 0n,
    }
  }

  /**
   * Prepare calldata for setting hook gas limit
   */
  function prepareSetHookGasLimit(
    account: Address,
    request: HookGasLimitRequest
  ): ModuleCalldata {
    const data = encodeFunctionData({
      abi: KERNEL_ABI,
      functionName: 'setHookGasLimit',
      args: [request.hookAddress, request.gasLimit],
    })

    return {
      to: account,
      data,
      value: 0n,
    }
  }

  /**
   * Prepare calldata for setting delegatecall whitelist entry
   */
  function prepareSetDelegatecallWhitelist(
    account: Address,
    request: DelegatecallWhitelistRequest
  ): ModuleCalldata {
    const data = encodeFunctionData({
      abi: KERNEL_ABI,
      functionName: 'setDelegatecallWhitelist',
      args: [request.target, request.allowed],
    })

    return {
      to: account,
      data,
      value: 0n,
    }
  }

  /**
   * Prepare calldata for enforcing delegatecall whitelist
   */
  function prepareEnforceDelegatecallWhitelist(
    account: Address,
    request: DelegatecallWhitelistEnforceRequest
  ): ModuleCalldata {
    const data = encodeFunctionData({
      abi: KERNEL_ABI,
      functionName: 'setEnforceDelegatecallWhitelist',
      args: [request.enforce],
    })

    return {
      to: account,
      data,
      value: 0n,
    }
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate module installation request
   */
  function validateInstallRequest(request: ModuleInstallRequest): ValidationResult {
    const errors: string[] = []

    // Check module exists in registry
    const entry = registry.getByAddress(request.moduleAddress)
    if (!entry) {
      errors.push('Module not found in registry')
    }

    // Check module type matches
    if (entry && entry.metadata.type !== request.moduleType) {
      errors.push(
        `Module type mismatch: expected ${getModuleTypeName(entry.metadata.type)}, ` +
          `got ${getModuleTypeName(request.moduleType)}`
      )
    }

    // Check initData is valid hex
    if (!request.initData.startsWith('0x')) {
      errors.push('initData must be a hex string starting with 0x')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Validate module uninstallation request
   */
  function validateUninstallRequest(request: ModuleUninstallRequest): ValidationResult {
    const errors: string[] = []

    // Check deInitData is valid hex
    if (!request.deInitData.startsWith('0x')) {
      errors.push('deInitData must be a hex string starting with 0x')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Check if installation would conflict with existing modules
   * Note: Requires queryClient for async checks
   */
  async function checkInstallConflicts(
    account: Address,
    request: ModuleInstallRequest
  ): Promise<ConflictCheckResult> {
    if (!queryClient) {
      // Without queryClient, we can't check conflicts
      return { hasConflict: false }
    }

    // Check if already installed
    const alreadyInstalled = await queryClient.isModuleInstalled(
      account,
      request.moduleAddress,
      request.moduleType
    )

    if (alreadyInstalled) {
      return {
        hasConflict: true,
        conflictReason: 'Module is already installed',
      }
    }

    // For validators, check if switching would affect security
    if (request.moduleType === MODULE_TYPE.VALIDATOR) {
      const currentValidator = await queryClient.getPrimaryValidator(account)
      if (currentValidator) {
        // Not necessarily a conflict, but worth noting
        return {
          hasConflict: false,
          conflictReason: undefined,
        }
      }
    }

    return { hasConflict: false }
  }

  return {
    // Calldata preparation
    prepareInstall,
    prepareUninstall,
    prepareBatchInstall,
    prepareBatchUninstall,
    prepareForceUninstall,
    prepareReplaceModule,
    prepareSetHookGasLimit,
    prepareSetDelegatecallWhitelist,
    prepareEnforceDelegatecallWhitelist,

    // Validation
    validateInstallRequest,
    validateUninstallRequest,
    checkInstallConflicts,

    // Registry access
    registry,
  }
}

// ============================================================================
// Exports
// ============================================================================

export type ModuleOperationClient = ReturnType<typeof createModuleOperationClient>

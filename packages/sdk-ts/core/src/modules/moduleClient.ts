import type { Address, Hex, PublicClient } from 'viem'
import { createPublicClient, http, encodeFunctionData } from 'viem'
import type {
  ModuleType,
  ModuleInstallRequest,
  ModuleUninstallRequest,
  InstalledModule,
} from '@stablenet/sdk-types'
import { MODULE_TYPE, MODULE_STATUS, getModuleTypeName } from '@stablenet/sdk-types'
import { KERNEL_ABI } from '../abis'
import { createModuleRegistry, type ModuleRegistry } from './moduleRegistry'

// ============================================================================
// Types
// ============================================================================

/**
 * Module client configuration
 */
export interface ModuleClientConfig {
  /** RPC URL for the network */
  rpcUrl: string

  /** Chain ID */
  chainId: number

  /** Bundler URL for UserOperation submission */
  bundlerUrl?: string

  /** Paymaster URL for gas sponsorship */
  paymasterUrl?: string
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

// ============================================================================
// Module Client
// ============================================================================

/**
 * Create a module client for managing Smart Account modules
 *
 * @example
 * ```typescript
 * const client = createModuleClient({
 *   rpcUrl: 'https://rpc.example.com',
 *   chainId: 1,
 *   bundlerUrl: 'https://bundler.example.com',
 * })
 *
 * // Get installed modules
 * const modules = await client.getInstalledModules(smartAccountAddress)
 *
 * // Prepare module installation
 * const calldata = client.prepareInstall({
 *   moduleAddress: validatorAddress,
 *   moduleType: MODULE_TYPE.VALIDATOR,
 *   initData: encodedInitData,
 * })
 * ```
 */
export function createModuleClient(config: ModuleClientConfig) {
  const { rpcUrl, chainId } = config

  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  })

  const registry = createModuleRegistry({ chainId })

  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * Check if a module is installed on a Smart Account
   */
  async function isModuleInstalled(
    account: Address,
    moduleAddress: Address,
    moduleType: ModuleType
  ): Promise<boolean> {
    try {
      const result = await publicClient.readContract({
        address: account,
        abi: KERNEL_ABI,
        functionName: 'isModuleInstalled',
        args: [moduleType, moduleAddress, '0x'],
      })

      return result as boolean
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

  // ============================================================================
  // Write Operation Preparation
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

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate module installation request
   */
  function validateInstallRequest(
    request: ModuleInstallRequest
  ): { valid: boolean; errors: string[] } {
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
   * Check if installation would conflict with existing modules
   */
  async function checkInstallConflicts(
    account: Address,
    request: ModuleInstallRequest
  ): Promise<{ hasConflict: boolean; conflictReason?: string }> {
    // Check if already installed
    const alreadyInstalled = await isModuleInstalled(
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
      const currentValidator = await getPrimaryValidator(account)
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

  // ============================================================================
  // Encoding Helpers
  // ============================================================================

  /**
   * Encode ECDSA validator init data
   */
  function encodeECDSAValidatorInitData(owner: Address): Hex {
    return encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'init',
          inputs: [{ type: 'address', name: 'owner' }],
          outputs: [],
          stateMutability: 'nonpayable',
        },
      ],
      functionName: 'init',
      args: [owner],
    })
  }

  /**
   * Encode WebAuthn validator init data
   */
  function encodeWebAuthnValidatorInitData(
    pubKeyX: bigint,
    pubKeyY: bigint,
    credentialId: Hex
  ): Hex {
    return encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'init',
          inputs: [
            { type: 'uint256', name: 'pubKeyX' },
            { type: 'uint256', name: 'pubKeyY' },
            { type: 'bytes', name: 'credentialId' },
          ],
          outputs: [],
          stateMutability: 'nonpayable',
        },
      ],
      functionName: 'init',
      args: [pubKeyX, pubKeyY, credentialId],
    })
  }

  /**
   * Encode Session Key executor init data
   */
  function encodeSessionKeyInitData(config: {
    sessionKey: Address
    allowedTargets: Address[]
    allowedSelectors: Hex[]
    maxValuePerTx: bigint
    validUntil: number
    validAfter: number
  }): Hex {
    return encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'init',
          inputs: [
            { type: 'address', name: 'sessionKey' },
            { type: 'address[]', name: 'allowedTargets' },
            { type: 'bytes4[]', name: 'allowedSelectors' },
            { type: 'uint256', name: 'maxValuePerTx' },
            { type: 'uint64', name: 'validUntil' },
            { type: 'uint64', name: 'validAfter' },
          ],
          outputs: [],
          stateMutability: 'nonpayable',
        },
      ],
      functionName: 'init',
      args: [
        config.sessionKey,
        config.allowedTargets,
        config.allowedSelectors,
        config.maxValuePerTx,
        BigInt(config.validUntil),
        BigInt(config.validAfter),
      ],
    })
  }

  /**
   * Encode Spending Limit hook init data
   */
  function encodeSpendingLimitInitData(config: {
    token: Address
    limit: bigint
    period: number
  }): Hex {
    return encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'init',
          inputs: [
            { type: 'address', name: 'token' },
            { type: 'uint256', name: 'limit' },
            { type: 'uint64', name: 'period' },
          ],
          outputs: [],
          stateMutability: 'nonpayable',
        },
      ],
      functionName: 'init',
      args: [config.token, config.limit, BigInt(config.period)],
    })
  }

  return {
    // Read operations
    isModuleInstalled,
    getInstalledModules,
    getInstalledModulesByType,
    getPrimaryValidator,

    // Write preparation
    prepareInstall,
    prepareUninstall,
    prepareBatchInstall,
    prepareBatchUninstall,

    // Validation
    validateInstallRequest,
    checkInstallConflicts,

    // Encoding helpers
    encodeECDSAValidatorInitData,
    encodeWebAuthnValidatorInitData,
    encodeSessionKeyInitData,
    encodeSpendingLimitInitData,

    // Registry access
    registry,
  }
}

// ============================================================================
// Exports
// ============================================================================

export type ModuleClient = ReturnType<typeof createModuleClient>

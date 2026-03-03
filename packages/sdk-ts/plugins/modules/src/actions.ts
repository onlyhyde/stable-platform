/**
 * @stablenet/plugin-modules - Module Actions
 * Functions for installing, uninstalling, and querying ERC-7579 modules
 */

import type { Address, Hex, PublicClient } from 'viem'
import { encodeFunctionData } from 'viem'
import { IModuleAbi, KernelModuleAbi } from './abis'
import {
  type BatchModuleInstallation,
  type ForceUninstallModuleParams,
  type InstallModuleParams,
  InvalidModuleTypeError,
  type IsModuleInstalledParams,
  MODULE_TYPES,
  type ModuleOperationCallData,
  type ModuleType,
  type ReplaceModuleParams,
  type SetDelegatecallWhitelistParams,
  type SetEnforceDelegatecallWhitelistParams,
  type SetHookGasLimitParams,
  type UninstallModuleParams,
} from './types'

// ============================================================================
// Module Installation
// ============================================================================

/**
 * Encode call data for installing a module
 */
export function encodeInstallModule(params: InstallModuleParams): Hex {
  return encodeFunctionData({
    abi: KernelModuleAbi,
    functionName: 'installModule',
    args: [params.moduleType, params.module, params.initData],
  })
}

/**
 * Encode call data for uninstalling a module
 */
export function encodeUninstallModule(params: UninstallModuleParams): Hex {
  return encodeFunctionData({
    abi: KernelModuleAbi,
    functionName: 'uninstallModule',
    args: [params.moduleType, params.module, params.deInitData],
  })
}

/**
 * Build a call for installing a module on a smart account
 */
export function buildInstallModuleCall(
  smartAccount: Address,
  params: InstallModuleParams
): ModuleOperationCallData {
  return {
    to: smartAccount,
    data: encodeInstallModule(params),
    value: 0n,
  }
}

/**
 * Build a call for uninstalling a module from a smart account
 */
export function buildUninstallModuleCall(
  smartAccount: Address,
  params: UninstallModuleParams
): ModuleOperationCallData {
  return {
    to: smartAccount,
    data: encodeUninstallModule(params),
    value: 0n,
  }
}

/**
 * Encode call data for force-uninstalling a module (ExcessivelySafeCall)
 */
export function encodeForceUninstallModule(params: ForceUninstallModuleParams): Hex {
  return encodeFunctionData({
    abi: KernelModuleAbi,
    functionName: 'forceUninstallModule',
    args: [params.moduleType, params.module, params.deInitData],
  })
}

/**
 * Encode call data for atomically replacing a module
 */
export function encodeReplaceModule(params: ReplaceModuleParams): Hex {
  return encodeFunctionData({
    abi: KernelModuleAbi,
    functionName: 'replaceModule',
    args: [params.moduleType, params.oldModule, params.deInitData, params.newModule, params.initData],
  })
}

/**
 * Encode call data for setting hook gas limit
 */
export function encodeSetHookGasLimit(params: SetHookGasLimitParams): Hex {
  return encodeFunctionData({
    abi: KernelModuleAbi,
    functionName: 'setHookGasLimit',
    args: [params.hook, params.gasLimit],
  })
}

/**
 * Encode call data for setting delegatecall whitelist entry
 */
export function encodeSetDelegatecallWhitelist(params: SetDelegatecallWhitelistParams): Hex {
  return encodeFunctionData({
    abi: KernelModuleAbi,
    functionName: 'setDelegatecallWhitelist',
    args: [params.target, params.allowed],
  })
}

/**
 * Encode call data for enforcing delegatecall whitelist
 */
export function encodeSetEnforceDelegatecallWhitelist(params: SetEnforceDelegatecallWhitelistParams): Hex {
  return encodeFunctionData({
    abi: KernelModuleAbi,
    functionName: 'setEnforceDelegatecallWhitelist',
    args: [params.enforce],
  })
}

/**
 * Build a call for force-uninstalling a module from a smart account
 */
export function buildForceUninstallModuleCall(
  smartAccount: Address,
  params: ForceUninstallModuleParams
): ModuleOperationCallData {
  return {
    to: smartAccount,
    data: encodeForceUninstallModule(params),
    value: 0n,
  }
}

/**
 * Build a call for atomically replacing a module on a smart account
 */
export function buildReplaceModuleCall(
  smartAccount: Address,
  params: ReplaceModuleParams
): ModuleOperationCallData {
  return {
    to: smartAccount,
    data: encodeReplaceModule(params),
    value: 0n,
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Build calls for batch module installation
 */
export function buildBatchInstallModuleCalls(
  smartAccount: Address,
  batch: BatchModuleInstallation
): ModuleOperationCallData[] {
  const calls: ModuleOperationCallData[] = []

  // Install validators
  if (batch.validators) {
    for (const validator of batch.validators) {
      calls.push(
        buildInstallModuleCall(smartAccount, {
          moduleType: MODULE_TYPES.VALIDATOR,
          module: validator.address,
          initData: validator.initData,
        })
      )
    }
  }

  // Install executors
  if (batch.executors) {
    for (const executor of batch.executors) {
      calls.push(
        buildInstallModuleCall(smartAccount, {
          moduleType: MODULE_TYPES.EXECUTOR,
          module: executor.address,
          initData: executor.initData,
        })
      )
    }
  }

  // Install hooks
  if (batch.hooks) {
    for (const hook of batch.hooks) {
      calls.push(
        buildInstallModuleCall(smartAccount, {
          moduleType: MODULE_TYPES.HOOK,
          module: hook.address,
          initData: hook.initData,
        })
      )
    }
  }

  // Install fallbacks
  if (batch.fallbacks) {
    for (const fallback of batch.fallbacks) {
      calls.push(
        buildInstallModuleCall(smartAccount, {
          moduleType: MODULE_TYPES.FALLBACK,
          module: fallback.address,
          initData: fallback.initData,
        })
      )
    }
  }

  return calls
}

// ============================================================================
// Module Queries
// ============================================================================

/**
 * Check if a module is installed on a smart account
 */
export async function isModuleInstalled(
  client: PublicClient,
  smartAccount: Address,
  params: IsModuleInstalledParams
): Promise<boolean> {
  try {
    const result = await client.readContract({
      address: smartAccount,
      abi: KernelModuleAbi,
      functionName: 'isModuleInstalled',
      args: [params.moduleType, params.module, params.additionalContext ?? '0x'],
    })
    return result as boolean
  } catch {
    return false
  }
}

/**
 * Check if a module supports a specific module type
 */
export async function isModuleType(
  client: PublicClient,
  moduleAddress: Address,
  moduleType: ModuleType
): Promise<boolean> {
  try {
    const result = await client.readContract({
      address: moduleAddress,
      abi: IModuleAbi,
      functionName: 'isModuleType',
      args: [moduleType],
    })
    return result as boolean
  } catch {
    return false
  }
}

/**
 * Check if a module is initialized for a smart account
 */
export async function isModuleInitialized(
  client: PublicClient,
  moduleAddress: Address,
  smartAccount: Address
): Promise<boolean> {
  try {
    const result = await client.readContract({
      address: moduleAddress,
      abi: IModuleAbi,
      functionName: 'isInitialized',
      args: [smartAccount],
    })
    return result as boolean
  } catch {
    return false
  }
}

/**
 * Get the root validator address for a smart account
 */
export async function getRootValidator(
  client: PublicClient,
  smartAccount: Address
): Promise<Address> {
  const result = await client.readContract({
    address: smartAccount,
    abi: KernelModuleAbi,
    functionName: 'rootValidator',
  })
  return result as Address
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate module type
 */
export function validateModuleType(moduleType: bigint): ModuleType {
  if (
    moduleType !== MODULE_TYPES.VALIDATOR &&
    moduleType !== MODULE_TYPES.EXECUTOR &&
    moduleType !== MODULE_TYPES.FALLBACK &&
    moduleType !== MODULE_TYPES.HOOK
  ) {
    throw new InvalidModuleTypeError(`Invalid module type: ${moduleType}`, 'INVALID_MODULE_TYPE', {
      moduleType,
    })
  }
  return moduleType as ModuleType
}

/**
 * Get module type name
 */
export function getModuleTypeName(moduleType: ModuleType): string {
  switch (moduleType) {
    case MODULE_TYPES.VALIDATOR:
      return 'Validator'
    case MODULE_TYPES.EXECUTOR:
      return 'Executor'
    case MODULE_TYPES.FALLBACK:
      return 'Fallback'
    case MODULE_TYPES.HOOK:
      return 'Hook'
    default:
      return 'Unknown'
  }
}

// ============================================================================
// Validator Helpers
// ============================================================================

/**
 * Create ECDSA validator init data
 * @param owner Owner address for ECDSA validation
 */
export function encodeECDSAValidatorInitData(owner: Address): Hex {
  // ECDSA validator expects owner address as init data (20 bytes)
  return owner.toLowerCase() as Hex
}

/**
 * Create WebAuthn validator init data
 */
export function encodeWebAuthnValidatorInitData(config: {
  pubKeyX: bigint
  pubKeyY: bigint
  authenticatorId: Hex
}): Hex {
  // Encode: pubKeyX (32 bytes) + pubKeyY (32 bytes) + authenticatorIdLength (32 bytes) + authenticatorId
  const pubKeyXHex = config.pubKeyX.toString(16).padStart(64, '0')
  const pubKeyYHex = config.pubKeyY.toString(16).padStart(64, '0')
  const authIdLength = ((config.authenticatorId.length - 2) / 2).toString(16).padStart(64, '0')
  const authId = config.authenticatorId.slice(2)
  return `0x${pubKeyXHex}${pubKeyYHex}${authIdLength}${authId}` as Hex
}

/**
 * Create MultiSig validator init data
 */
export function encodeMultiSigValidatorInitData(config: {
  signers: Address[]
  threshold: number
}): Hex {
  // Encode: threshold (32 bytes) + signerCount (32 bytes) + signers (20 bytes each)
  const thresholdHex = config.threshold.toString(16).padStart(64, '0')
  const signerCountHex = config.signers.length.toString(16).padStart(64, '0')
  const signersHex = config.signers.map((s) => s.slice(2).toLowerCase().padStart(64, '0')).join('')
  return `0x${thresholdHex}${signerCountHex}${signersHex}` as Hex
}

// ============================================================================
// Executor Helpers
// ============================================================================

/**
 * Create session key executor init data
 * For initial installation (empty init data is valid)
 */
export function encodeSessionKeyExecutorInitData(): Hex {
  return '0x'
}

/**
 * Create swap executor init data
 */
export function encodeSwapExecutorInitData(config: {
  maxSlippageBps: number
  dailyLimit: bigint
}): Hex {
  const slippageHex = config.maxSlippageBps.toString(16).padStart(64, '0')
  const limitHex = config.dailyLimit.toString(16).padStart(64, '0')
  return `0x${slippageHex}${limitHex}` as Hex
}

/**
 * Create lending executor init data
 */
export function encodeLendingExecutorInitData(config: {
  maxLtv: number
  minHealthFactor: bigint
  dailyBorrowLimit: bigint
}): Hex {
  const ltvHex = config.maxLtv.toString(16).padStart(64, '0')
  const hfHex = config.minHealthFactor.toString(16).padStart(64, '0')
  const limitHex = config.dailyBorrowLimit.toString(16).padStart(64, '0')
  return `0x${ltvHex}${hfHex}${limitHex}` as Hex
}

/**
 * Create staking executor init data
 */
export function encodeStakingExecutorInitData(config: {
  maxStakePerPool: bigint
  dailyStakeLimit: bigint
}): Hex {
  const maxStakeHex = config.maxStakePerPool.toString(16).padStart(64, '0')
  const limitHex = config.dailyStakeLimit.toString(16).padStart(64, '0')
  return `0x${maxStakeHex}${limitHex}` as Hex
}

// ============================================================================
// Hook Helpers
// ============================================================================

/**
 * Create spending limit hook init data
 */
export function encodeSpendingLimitHookInitData(config: {
  token: Address
  limit: bigint
  period: bigint
}): Hex {
  const tokenHex = config.token.slice(2).toLowerCase().padStart(64, '0')
  const limitHex = config.limit.toString(16).padStart(64, '0')
  const periodHex = config.period.toString(16).padStart(64, '0')
  return `0x${tokenHex}${limitHex}${periodHex}` as Hex
}

/**
 * Create health factor hook init data
 */
export function encodeHealthFactorHookInitData(config: { minHealthFactor: bigint }): Hex {
  const hfHex = config.minHealthFactor.toString(16).padStart(64, '0')
  return `0x${hfHex}` as Hex
}

/**
 * Create policy hook init data
 */
export function encodePolicyHookInitData(config: { maxValue: bigint; dailyLimit: bigint }): Hex {
  const maxValueHex = config.maxValue.toString(16).padStart(64, '0')
  const limitHex = config.dailyLimit.toString(16).padStart(64, '0')
  return `0x${maxValueHex}${limitHex}` as Hex
}

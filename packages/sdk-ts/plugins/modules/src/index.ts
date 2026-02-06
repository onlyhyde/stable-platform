/**
 * @stablenet/plugin-modules
 * StableNet SDK - Module Management Plugin for ERC-7579 modules
 *
 * Provides utilities for installing, uninstalling, and managing ERC-7579 modules
 * on Kernel Smart Accounts.
 *
 * @example
 * ```ts
 * import {
 *   encodeInstallModule,
 *   buildInstallModuleCall,
 *   isModuleInstalled,
 *   MODULE_TYPES,
 *   encodeECDSAValidatorInitData,
 * } from '@stablenet/plugin-modules'
 *
 * // Install an ECDSA validator
 * const installCall = buildInstallModuleCall(smartAccountAddress, {
 *   moduleType: MODULE_TYPES.VALIDATOR,
 *   module: ecdsaValidatorAddress,
 *   initData: encodeECDSAValidatorInitData(ownerAddress),
 * })
 *
 * // Check if module is installed
 * const installed = await isModuleInstalled(publicClient, smartAccountAddress, {
 *   moduleType: MODULE_TYPES.VALIDATOR,
 *   module: ecdsaValidatorAddress,
 * })
 * ```
 */

// ============================================================================
// Types
// ============================================================================
export type {
  // Core types
  ModuleType,
  ModuleConfig,
  ModuleInfo,
  // Validator types
  ValidatorConfig,
  ECDSAValidatorConfig,
  WebAuthnValidatorConfig,
  MultiSigValidatorConfig,
  // Executor types
  ExecutorConfig,
  SessionKeyExecutorConfig,
  SessionKeyConfig,
  // Hook types
  HookConfig,
  HookTypeFlags,
  SpendingLimitHookConfig,
  HealthFactorHookConfig,
  // Fallback types
  FallbackConfig,
  // Installation types
  InstallModuleParams,
  UninstallModuleParams,
  BatchModuleInstallation,
  IsModuleInstalledParams,
  ModuleInstallationResult,
  ModuleOperationCallData,
} from './types'

// Export module types constant
export { MODULE_TYPES } from './types'

// Export error classes
export {
  ModuleError,
  ModuleInstallationError,
  ModuleNotInstalledError,
  InvalidModuleTypeError,
} from './types'

// ============================================================================
// ABIs
// ============================================================================
export {
  KernelModuleAbi,
  IModuleAbi,
  ECDSAValidatorAbi,
  SessionKeyExecutorAbi,
  SpendingLimitHookAbi,
} from './abis'

// ============================================================================
// Actions
// ============================================================================
export {
  // Module installation
  encodeInstallModule,
  encodeUninstallModule,
  buildInstallModuleCall,
  buildUninstallModuleCall,
  buildBatchInstallModuleCalls,
  // Module queries
  isModuleInstalled,
  isModuleType,
  isModuleInitialized,
  getRootValidator,
  // Helpers
  validateModuleType,
  getModuleTypeName,
  // Validator init data encoders
  encodeECDSAValidatorInitData,
  encodeWebAuthnValidatorInitData,
  encodeMultiSigValidatorInitData,
  // Executor init data encoders
  encodeSessionKeyExecutorInitData,
  encodeSwapExecutorInitData,
  encodeLendingExecutorInitData,
  encodeStakingExecutorInitData,
  // Hook init data encoders
  encodeSpendingLimitHookInitData,
  encodeHealthFactorHookInitData,
  encodePolicyHookInitData,
} from './actions'

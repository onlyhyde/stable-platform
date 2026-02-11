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
// ABIs
// ============================================================================
export {
  ECDSAValidatorAbi,
  IModuleAbi,
  KernelModuleAbi,
  SessionKeyExecutorAbi,
  SpendingLimitHookAbi,
} from './abis'
// ============================================================================
// Actions
// ============================================================================
export {
  buildBatchInstallModuleCalls,
  buildInstallModuleCall,
  buildUninstallModuleCall,
  // Validator init data encoders
  encodeECDSAValidatorInitData,
  encodeHealthFactorHookInitData,
  // Module installation
  encodeInstallModule,
  encodeLendingExecutorInitData,
  encodeMultiSigValidatorInitData,
  encodePolicyHookInitData,
  // Executor init data encoders
  encodeSessionKeyExecutorInitData,
  // Hook init data encoders
  encodeSpendingLimitHookInitData,
  encodeStakingExecutorInitData,
  encodeSwapExecutorInitData,
  encodeUninstallModule,
  encodeWebAuthnValidatorInitData,
  getModuleTypeName,
  getRootValidator,
  isModuleInitialized,
  // Module queries
  isModuleInstalled,
  isModuleType,
  // Helpers
  validateModuleType,
} from './actions'
// ============================================================================
// Types
// ============================================================================
export type {
  BatchModuleInstallation,
  ECDSAValidatorConfig,
  // Executor types
  ExecutorConfig,
  // Fallback types
  FallbackConfig,
  HealthFactorHookConfig,
  // Hook types
  HookConfig,
  HookTypeFlags,
  // Installation types
  InstallModuleParams,
  IsModuleInstalledParams,
  ModuleConfig,
  ModuleInfo,
  ModuleInstallationResult,
  ModuleOperationCallData,
  // Core types
  ModuleType,
  MultiSigValidatorConfig,
  SessionKeyConfig,
  SessionKeyExecutorConfig,
  SpendingLimitHookConfig,
  UninstallModuleParams,
  // Validator types
  ValidatorConfig,
  WebAuthnValidatorConfig,
} from './types'
// Export module types constant
// Export error classes
export {
  InvalidModuleTypeError,
  MODULE_TYPES,
  ModuleError,
  ModuleInstallationError,
  ModuleNotInstalledError,
} from './types'

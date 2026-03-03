/**
 * @stablenet/plugin-modules - TypeScript Types
 * Types for ERC-7579 module management
 */

import type { Address, Hex } from 'viem'

// ============================================================================
// Module Types
// ============================================================================

/** ERC-7579 Module Type IDs */
export type ModuleType = 1n | 2n | 3n | 4n

export const MODULE_TYPES = {
  VALIDATOR: 1n,
  EXECUTOR: 2n,
  FALLBACK: 3n,
  HOOK: 4n,
} as const

/** Module installation configuration */
export interface ModuleConfig {
  /** Module contract address */
  address: Address
  /** Module type (Validator, Executor, Fallback, Hook) */
  type: ModuleType
  /** Module initialization data */
  initData: Hex
}

/** Extended module info with metadata */
export interface ModuleInfo extends ModuleConfig {
  /** Whether the module is installed */
  isInstalled: boolean
  /** Module name (if known) */
  name?: string
  /** Module version (if known) */
  version?: string
}

// ============================================================================
// Validator Types
// ============================================================================

/** Validator module configuration */
export interface ValidatorConfig {
  /** Validator contract address */
  address: Address
  /** Initialization data for the validator */
  initData: Hex
}

/** ECDSA Validator specific config */
export interface ECDSAValidatorConfig extends ValidatorConfig {
  /** Owner address for ECDSA validation */
  owner: Address
}

/** WebAuthn Validator specific config */
export interface WebAuthnValidatorConfig extends ValidatorConfig {
  /** Public key X coordinate */
  pubKeyX: bigint
  /** Public key Y coordinate */
  pubKeyY: bigint
  /** Authenticator ID */
  authenticatorId: Hex
}

/** MultiSig Validator specific config */
export interface MultiSigValidatorConfig extends ValidatorConfig {
  /** Array of signer addresses */
  signers: Address[]
  /** Required number of signatures */
  threshold: number
}

// ============================================================================
// Executor Types
// ============================================================================

/** Executor module configuration */
export interface ExecutorConfig {
  /** Executor contract address */
  address: Address
  /** Initialization data for the executor */
  initData: Hex
}

/** Session Key Executor specific config */
export interface SessionKeyExecutorConfig extends ExecutorConfig {
  /** Initial session keys to configure */
  sessionKeys?: SessionKeyConfig[]
}

export interface SessionKeyConfig {
  /** Session key address */
  sessionKey: Address
  /** Allowed target contracts */
  allowedTargets: Address[]
  /** Spending limit per call */
  spendLimit: bigint
  /** Validity period start */
  validAfter: bigint
  /** Validity period end */
  validUntil: bigint
}

// ============================================================================
// Hook Types
// ============================================================================

/** Hook module configuration */
export interface HookConfig {
  /** Hook contract address */
  address: Address
  /** Initialization data for the hook */
  initData: Hex
  /** Hook type flags */
  hookType?: HookTypeFlags
}

export interface HookTypeFlags {
  /** Enable pre-call checks */
  preCheck: boolean
  /** Enable post-call checks */
  postCheck: boolean
}

/** Spending Limit Hook specific config */
export interface SpendingLimitHookConfig extends HookConfig {
  /** Token address (address(0) for ETH) */
  token: Address
  /** Maximum amount per transaction */
  limit: bigint
  /** Time period for limit (in seconds) */
  period: bigint
}

/** Health Factor Hook specific config */
export interface HealthFactorHookConfig extends HookConfig {
  /** Minimum health factor (scaled by 1e18) */
  minHealthFactor: bigint
  /** Monitored lending pool addresses */
  monitoredTargets: Address[]
}

// ============================================================================
// Fallback Types
// ============================================================================

/** Fallback module configuration */
export interface FallbackConfig {
  /** Fallback contract address */
  address: Address
  /** Function selector to handle */
  selector: Hex
  /** Initialization data for the fallback */
  initData: Hex
}

// ============================================================================
// Module Installation Types
// ============================================================================

/** Parameters for installing a module */
export interface InstallModuleParams {
  /** Module type */
  moduleType: ModuleType
  /** Module address */
  module: Address
  /** Module init data */
  initData: Hex
}

/** Parameters for uninstalling a module */
export interface UninstallModuleParams {
  /** Module type */
  moduleType: ModuleType
  /** Module address */
  module: Address
  /** Deinitialization data */
  deInitData: Hex
}

/** Parameters for force-uninstalling a module (ExcessivelySafeCall) */
export interface ForceUninstallModuleParams {
  /** Module type */
  moduleType: ModuleType
  /** Module address */
  module: Address
  /** Deinitialization data */
  deInitData: Hex
}

/** Parameters for atomically replacing a module */
export interface ReplaceModuleParams {
  /** Module type (VALIDATOR, EXECUTOR, FALLBACK only) */
  moduleType: ModuleType
  /** Old module address to uninstall */
  oldModule: Address
  /** Old module deinitialization data */
  deInitData: Hex
  /** New module address to install */
  newModule: Address
  /** New module initialization data */
  initData: Hex
}

/** Parameters for setting hook gas limit */
export interface SetHookGasLimitParams {
  /** Hook contract address */
  hook: Address
  /** Gas limit (0 = unlimited) */
  gasLimit: bigint
}

/** Parameters for setting delegatecall whitelist entry */
export interface SetDelegatecallWhitelistParams {
  /** Target contract address */
  target: Address
  /** Whether to allow delegatecall */
  allowed: boolean
}

/** Parameters for enforcing delegatecall whitelist */
export interface SetEnforceDelegatecallWhitelistParams {
  /** Whether to enforce the whitelist */
  enforce: boolean
}

/** Batch module installation */
export interface BatchModuleInstallation {
  validators?: ValidatorConfig[]
  executors?: ExecutorConfig[]
  hooks?: HookConfig[]
  fallbacks?: FallbackConfig[]
}

// ============================================================================
// Module Query Types
// ============================================================================

/** Parameters for checking if module is installed */
export interface IsModuleInstalledParams {
  /** Module type */
  moduleType: ModuleType
  /** Module address */
  module: Address
  /** Additional data for the check */
  additionalContext?: Hex
}

/** Result of module installation check */
export interface ModuleInstallationResult {
  /** Module address */
  module: Address
  /** Module type */
  moduleType: ModuleType
  /** Whether the module is installed */
  isInstalled: boolean
}

// ============================================================================
// Transaction Building Types
// ============================================================================

/** Encoded module operation call data */
export interface ModuleOperationCallData {
  /** Target address (smart account) */
  to: Address
  /** Call data for the operation */
  data: Hex
  /** Value to send (usually 0) */
  value: bigint
}

// ============================================================================
// Error Types
// ============================================================================

export class ModuleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ModuleError'
  }
}

export class ModuleInstallationError extends ModuleError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details)
    this.name = 'ModuleInstallationError'
  }
}

export class ModuleNotInstalledError extends ModuleError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details)
    this.name = 'ModuleNotInstalledError'
  }
}

export class InvalidModuleTypeError extends ModuleError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details)
    this.name = 'InvalidModuleTypeError'
  }
}

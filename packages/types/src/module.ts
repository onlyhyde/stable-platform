import type { Address, Hex } from 'viem'

// ============================================================================
// Constants
// ============================================================================

/**
 * ERC-7579 Module Types
 * @see https://eips.ethereum.org/EIPS/eip-7579
 */
export const MODULE_TYPE = {
  /** Validates transaction signatures */
  VALIDATOR: 1n,
  /** Executes specific transaction logic */
  EXECUTOR: 2n,
  /** Handles unsupported function calls */
  FALLBACK: 3n,
  /** Pre/post transaction execution hooks */
  HOOK: 4n,
  /** Policy validation for execution */
  POLICY: 5n,
  /** Multi-signature participant */
  SIGNER: 6n,
} as const

export type ModuleType = (typeof MODULE_TYPE)[keyof typeof MODULE_TYPE]

/**
 * Module type names for display
 */
export const MODULE_TYPE_NAMES: Map<bigint, string> = new Map([
  [MODULE_TYPE.VALIDATOR, 'Validator'],
  [MODULE_TYPE.EXECUTOR, 'Executor'],
  [MODULE_TYPE.FALLBACK, 'Fallback'],
  [MODULE_TYPE.HOOK, 'Hook'],
  [MODULE_TYPE.POLICY, 'Policy'],
  [MODULE_TYPE.SIGNER, 'Signer'],
])

/**
 * Module installation status
 */
export const MODULE_STATUS = {
  /** Not installed */
  NOT_INSTALLED: 'not_installed',
  /** Installation in progress (tx submitted) */
  INSTALLING: 'installing',
  /** Installed and active */
  INSTALLED: 'installed',
  /** Uninstallation in progress (tx submitted) */
  UNINSTALLING: 'uninstalling',
  /** Installation or operation failed */
  FAILED: 'failed',
} as const

export type ModuleStatus = (typeof MODULE_STATUS)[keyof typeof MODULE_STATUS]

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Module metadata from registry
 */
export interface ModuleMetadata {
  /** Module contract address */
  address: Address

  /** Module type */
  type: ModuleType

  /** Human-readable name */
  name: string

  /** Description */
  description: string

  /** Version string */
  version: string

  /** Author/maintainer */
  author?: string

  /** Documentation URL */
  docsUrl?: string

  /** Source code URL */
  sourceUrl?: string

  /** Security audit URL */
  auditUrl?: string

  /** Is this an official/verified module */
  isVerified: boolean

  /** Tags for filtering */
  tags: string[]

  /** Logo URL */
  logoUrl?: string
}

/**
 * Module configuration schema
 * Defines what parameters the module accepts during installation
 */
export interface ModuleConfigSchema {
  /** Schema version */
  version: string

  /** Configuration fields */
  fields: ModuleConfigField[]
}

/**
 * Single configuration field
 */
export interface ModuleConfigField {
  /** Field name (used in encoding) */
  name: string

  /** Display label */
  label: string

  /** Field description */
  description: string

  /** Solidity type (address, uint256, bytes, etc.) */
  type: SolidityType

  /** Is this field required */
  required: boolean

  /** Default value (if any) */
  defaultValue?: string

  /** Validation rules */
  validation?: FieldValidation
}

/**
 * Solidity types for encoding
 */
export type SolidityType =
  | 'address'
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'uint64'
  | 'uint128'
  | 'uint256'
  | 'int8'
  | 'int16'
  | 'int32'
  | 'int64'
  | 'int128'
  | 'int256'
  | 'bool'
  | 'bytes'
  | 'bytes4'
  | 'bytes32'
  | 'string'
  | 'address[]'
  | 'uint256[]'
  | 'bytes4[]'
  | 'bytes32[]'

/**
 * Field validation rules
 */
export interface FieldValidation {
  /** Minimum value (for numbers) */
  min?: string

  /** Maximum value (for numbers) */
  max?: string

  /** Regex pattern (for strings) */
  pattern?: string

  /** Custom validation message */
  message?: string
}

/**
 * Installed module on a Smart Account
 */
export interface InstalledModule {
  /** Module contract address */
  address: Address

  /** Module type */
  type: ModuleType

  /** Module metadata */
  metadata: ModuleMetadata

  /** Installation configuration (encoded) */
  initData: Hex

  /** Decoded configuration for display */
  config?: Record<string, unknown>

  /** Installation status */
  status: ModuleStatus

  /** Installation timestamp */
  installedAt?: number

  /** Installation transaction hash */
  installTxHash?: Hex
}

/**
 * Module installation request
 */
export interface ModuleInstallRequest {
  /** Module address to install */
  moduleAddress: Address

  /** Module type */
  moduleType: ModuleType

  /** Encoded initialization data */
  initData: Hex
}

/**
 * Module uninstallation request
 */
export interface ModuleUninstallRequest {
  /** Module address to uninstall */
  moduleAddress: Address

  /** Module type */
  moduleType: ModuleType

  /** Encoded de-initialization data */
  deInitData: Hex
}

// ============================================================================
// Validator-Specific Types
// ============================================================================

/**
 * ECDSA Validator configuration
 */
export interface ECDSAValidatorConfig {
  /** Owner address that can sign */
  owner: Address
}

/**
 * WebAuthn Validator configuration
 */
export interface WebAuthnValidatorConfig {
  /** WebAuthn credential public key X coordinate */
  pubKeyX: bigint

  /** WebAuthn credential public key Y coordinate */
  pubKeyY: bigint

  /** Credential ID */
  credentialId: Hex
}

/**
 * MultiSig Validator configuration
 */
export interface MultiSigValidatorConfig {
  /** List of signer addresses */
  signers: Address[]

  /** Required signatures threshold */
  threshold: number
}

// ============================================================================
// Executor-Specific Types
// ============================================================================

/**
 * Session Key configuration
 */
export interface SessionKeyConfig {
  /** Session key address */
  sessionKey: Address

  /** Allowed target contracts */
  allowedTargets: Address[]

  /** Allowed function selectors */
  allowedSelectors: Hex[]

  /** Maximum value per transaction */
  maxValuePerTx: bigint

  /** Expiration timestamp */
  validUntil: number

  /** Start timestamp */
  validAfter: number
}

/**
 * Recurring Payment configuration
 */
export interface RecurringPaymentConfig {
  /** Recipient address */
  recipient: Address

  /** Token address (0x0 for native) */
  token: Address

  /** Payment amount */
  amount: bigint

  /** Interval in seconds */
  interval: number

  /** Maximum number of payments (0 for unlimited) */
  maxPayments: number
}

// ============================================================================
// Hook-Specific Types
// ============================================================================

/**
 * Spending Limit Hook configuration
 */
export interface SpendingLimitHookConfig {
  /** Token address (0x0 for native) */
  token: Address

  /** Spending limit amount */
  limit: bigint

  /** Reset period in seconds */
  period: number
}

/**
 * Audit Hook configuration
 */
export interface AuditHookConfig {
  /** Events to log */
  logEvents: ('transfer' | 'approval' | 'call')[]

  /** Whether to log calldata */
  logCalldata: boolean
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if module type is Validator
 */
export function isValidator(type: ModuleType): boolean {
  return type === MODULE_TYPE.VALIDATOR
}

/**
 * Check if module type is Executor
 */
export function isExecutor(type: ModuleType): boolean {
  return type === MODULE_TYPE.EXECUTOR
}

/**
 * Check if module type is Hook
 */
export function isHook(type: ModuleType): boolean {
  return type === MODULE_TYPE.HOOK
}

/**
 * Check if module type is Fallback
 */
export function isFallback(type: ModuleType): boolean {
  return type === MODULE_TYPE.FALLBACK
}

/**
 * Check if module type is Policy
 */
export function isPolicy(type: ModuleType): boolean {
  return type === MODULE_TYPE.POLICY
}

/**
 * Check if module type is Signer
 */
export function isSigner(type: ModuleType): boolean {
  return type === MODULE_TYPE.SIGNER
}

/**
 * Get module type name
 */
export function getModuleTypeName(type: ModuleType): string {
  return MODULE_TYPE_NAMES.get(type) ?? 'Unknown'
}

// ============================================================================
// Encoding/Decoding Types
// ============================================================================

/**
 * Module ABI for encoding/decoding
 */
export interface ModuleABI {
  /** Install function signature */
  installSelector: Hex

  /** Uninstall function signature */
  uninstallSelector: Hex

  /** Init data encoding types */
  initDataTypes: SolidityType[]

  /** De-init data encoding types */
  deInitDataTypes: SolidityType[]
}

/**
 * StableNet Custom RPC Methods
 *
 * This module defines StableNet-specific RPC methods that extend
 * the standard Ethereum JSON-RPC interface.
 *
 * Methods are organized by feature:
 * - EIP-4337: Account Abstraction (UserOperations)
 * - EIP-7702: Authorization/Delegation
 * - ERC-7579: Modular Smart Accounts
 * - EIP-5564: Stealth Addresses
 */

import type { Address, Hash, Hex } from 'viem'

// ============================================================================
// RPC Method Names
// ============================================================================

/**
 * StableNet custom RPC method names
 */
export const STABLENET_RPC_METHODS = {
  // EIP-4337 Account Abstraction
  SEND_USER_OPERATION: 'wallet_sendUserOperation',
  GET_USER_OPERATION_RECEIPT: 'wallet_getUserOperationReceipt',
  ESTIMATE_USER_OPERATION_GAS: 'wallet_estimateUserOperationGas',

  // EIP-7702 Authorization
  SIGN_AUTHORIZATION: 'wallet_signAuthorization',
  GET_DELEGATION_STATUS: 'wallet_getDelegationStatus',
  REVOKE_DELEGATION: 'wallet_revokeDelegation',

  // ERC-7579 Modules
  GET_INSTALLED_MODULES: 'wallet_getInstalledModules',
  INSTALL_MODULE: 'wallet_installModule',
  UNINSTALL_MODULE: 'wallet_uninstallModule',
  FORCE_UNINSTALL_MODULE: 'wallet_forceUninstallModule',
  REPLACE_MODULE: 'wallet_replaceModule',
  IS_MODULE_INSTALLED: 'wallet_isModuleInstalled',

  // Session Keys
  CREATE_SESSION_KEY: 'wallet_createSessionKey',
  GET_SESSION_KEYS: 'wallet_getSessionKeys',
  REVOKE_SESSION_KEY: 'wallet_revokeSessionKey',

  // EIP-5564 Stealth Addresses
  GENERATE_STEALTH_ADDRESS: 'wallet_generateStealthAddress',
  SCAN_STEALTH_PAYMENTS: 'wallet_scanStealthPayments',
  GET_STEALTH_META_ADDRESS: 'wallet_getStealthMetaAddress',

  // Paymaster
  GET_PAYMASTER_DATA: 'wallet_getPaymasterData',
  SPONSOR_USER_OPERATION: 'wallet_sponsorUserOperation',
} as const

export type StableNetRpcMethod = (typeof STABLENET_RPC_METHODS)[keyof typeof STABLENET_RPC_METHODS]

// ============================================================================
// EIP-4337 Account Abstraction Types
// ============================================================================

/**
 * Partial UserOperation for submission
 */
export interface UserOperationRequest {
  sender: Address
  nonce: bigint | Hex
  initCode?: Hex
  callData: Hex
  callGasLimit?: bigint | Hex
  verificationGasLimit?: bigint | Hex
  preVerificationGas?: bigint | Hex
  maxFeePerGas?: bigint | Hex
  maxPriorityFeePerGas?: bigint | Hex
  paymasterAndData?: Hex
  signature?: Hex
}

/**
 * UserOperation receipt
 */
export interface UserOperationReceipt {
  userOpHash: Hash
  entryPoint: Address
  sender: Address
  nonce: bigint
  paymaster?: Address
  actualGasCost: bigint
  actualGasUsed: bigint
  success: boolean
  reason?: string
  logs: {
    address: Address
    topics: Hex[]
    data: Hex
  }[]
  receipt: {
    transactionHash: Hash
    blockHash: Hash
    blockNumber: bigint
  }
}

/**
 * Gas estimation for UserOperation
 */
export interface UserOperationGasEstimate {
  preVerificationGas: bigint
  verificationGasLimit: bigint
  callGasLimit: bigint
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
}

// ============================================================================
// EIP-4337 AA Error Codes
// ============================================================================

/**
 * Account Abstraction error codes from ERC-4337.
 * These are returned by the bundler in JSON-RPC error responses.
 *
 * AA1x: Account validation errors
 * AA2x: Account execution errors
 * AA3x: Paymaster validation errors
 * AA4x: Paymaster execution errors
 * AA5x: Stake/deposit errors
 */
export const AA_ERROR_CODES = {
  // AA1x: Account validation
  AA10_SENDER_ALREADY_CONSTRUCTED: 'AA10',
  AA13_INIT_CODE_FAILED: 'AA13',
  AA14_INIT_CODE_LENGTH: 'AA14',
  AA15_INIT_CODE_CREATE_ADDR: 'AA15',

  // AA2x: Account execution
  AA20_ACCOUNT_NOT_DEPLOYED: 'AA20',
  AA21_DIDNT_PAY_PREFUND: 'AA21',
  AA22_EXPIRED_OR_NOT_DUE: 'AA22',
  AA23_REVERTED: 'AA23',
  AA24_SIGNATURE_ERROR: 'AA24',
  AA25_INVALID_NONCE: 'AA25',
  AA26_OVER_VERIFICATION_GAS: 'AA26',

  // AA3x: Paymaster validation
  AA30_PAYMASTER_NOT_DEPLOYED: 'AA30',
  AA31_PAYMASTER_DEPOSIT_LOW: 'AA31',
  AA32_PAYMASTER_EXPIRED: 'AA32',
  AA33_REVERTED: 'AA33',
  AA34_SIGNATURE_ERROR: 'AA34',
  AA36_OVER_PAYMASTER_VERIFICATION_GAS: 'AA36',

  // AA4x: Paymaster execution
  AA40_OVER_VERIFICATION_GAS: 'AA40',
  AA41_TOO_LITTLE_GAS: 'AA41',

  // AA5x: Stake/deposit
  AA50_FACTORY_NOT_STAKED: 'AA50',
  AA51_FACTORY_NOT_DEPLOYED: 'AA51',
} as const

export type AAErrorCode = (typeof AA_ERROR_CODES)[keyof typeof AA_ERROR_CODES]

// ============================================================================
// EIP-7702 Authorization Types
// ============================================================================

/**
 * EIP-7702 Authorization tuple
 */
export interface Authorization {
  chainId: bigint | number
  address: Address
  nonce: bigint | number
}

/**
 * Signed authorization with signature components
 */
export interface SignedAuthorization extends Authorization {
  r: Hex
  s: Hex
  v: number
  yParity?: number
}

/**
 * Delegation status for an account
 */
export interface DelegationStatus {
  isDelegated: boolean
  delegate: Address | null
  chainId: number
  nonce: bigint
}

// ============================================================================
// ERC-7579 Module Types
// ============================================================================

/**
 * Module type constants
 */
export const MODULE_TYPE = {
  VALIDATOR: 1,
  EXECUTOR: 2,
  FALLBACK: 3,
  HOOK: 4,
  POLICY: 5,
  SIGNER: 6,
} as const

export type ModuleType = (typeof MODULE_TYPE)[keyof typeof MODULE_TYPE]

/**
 * Installed module information
 */
export interface InstalledModule {
  address: Address
  type: ModuleType
  initData: Hex
  installedAt: number
  isActive: boolean
}

/**
 * Module installation request
 */
export interface ModuleInstallRequest {
  address: Address
  type: ModuleType
  initData: Hex
}

/**
 * Module uninstallation request
 */
export interface ModuleUninstallRequest {
  address: Address
  type: ModuleType
  deInitData: Hex
}

/**
 * Module force-uninstallation request (Kernel v0.3.3)
 * Uses excessivelySafeCall — module revert is ignored
 */
export interface ModuleForceUninstallRequest {
  address: Address
  type: ModuleType
  deInitData: Hex
}

/**
 * Module replacement request (Kernel v0.3.3)
 * Atomically uninstalls old module and installs new module
 */
export interface ModuleReplaceRequest {
  oldAddress: Address
  newAddress: Address
  type: ModuleType
  deInitData: Hex
  initData: Hex
}

// ============================================================================
// Session Key Types
// ============================================================================

/**
 * Permission scope for session keys
 */
export interface SessionKeyPermission {
  /** Allowed target contract */
  target: Address
  /** Allowed function selectors (empty = all) */
  selectors?: Hex[]
  /** Maximum value per call */
  maxValue?: bigint
  /** Maximum total value */
  maxTotalValue?: bigint
  /** Allowed chain IDs */
  allowedChainIds?: number[]
}

/**
 * Session key configuration
 */
export interface SessionKeyConfig {
  /** Session key public address */
  sessionKey: Address
  /** Valid from timestamp */
  validFrom: number
  /** Valid until timestamp */
  validUntil: number
  /** Permissions granted to this key */
  permissions: SessionKeyPermission[]
  /** Optional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Created session key result
 */
export interface SessionKeyResult {
  /** Session key address */
  sessionKey: Address
  /** Signature authorizing the session key */
  signature: Hex
  /** When the session key expires */
  validUntil: number
  /** Installation transaction hash (if installed on-chain) */
  installTxHash?: Hash
}

// ============================================================================
// EIP-5564 Stealth Address Types
// ============================================================================

/**
 * Stealth meta-address components
 */
export interface StealthMetaAddress {
  /** Spending public key */
  spendingPubKey: Hex
  /** Viewing public key */
  viewingPubKey: Hex
  /** Encoded meta-address */
  metaAddress: Address
}

/**
 * Generated stealth address result
 */
export interface StealthAddressResult {
  /** The stealth address */
  stealthAddress: Address
  /** Ephemeral public key for the recipient */
  ephemeralPubKey: Hex
  /** View tag for efficient scanning */
  viewTag: Hex
}

/**
 * Detected stealth payment
 */
export interface StealthPayment {
  /** The stealth address that received funds */
  stealthAddress: Address
  /** Ephemeral public key used */
  ephemeralPubKey: Hex
  /** Transaction hash */
  txHash: Hash
  /** Block number */
  blockNumber: number
  /** Amount received (in wei) */
  amount: bigint
  /** Token address (zero for native) */
  token: Address
  /** When the payment was detected */
  timestamp: number
}

// ============================================================================
// Paymaster Types
// ============================================================================

/**
 * Paymaster data for sponsored transactions
 */
export interface PaymasterData {
  paymaster: Address
  paymasterData: Hex
  paymasterVerificationGasLimit: bigint
  paymasterPostOpGasLimit: bigint
}

/**
 * Paymaster sponsorship request
 */
export interface SponsorshipRequest {
  userOp: UserOperationRequest
  entryPoint: Address
  /** Token to pay with (for ERC-20 gas payment) */
  paymentToken?: Address
}

// ============================================================================
// RPC Request/Response Types
// ============================================================================

/**
 * StableNet RPC method signatures
 */
export interface StableNetRpcSchema {
  // EIP-4337
  wallet_sendUserOperation: {
    params: { userOp: UserOperationRequest; entryPoint: Address }
    result: Hash
  }
  wallet_getUserOperationReceipt: {
    params: { hash: Hash }
    result: UserOperationReceipt | null
  }
  wallet_estimateUserOperationGas: {
    params: { userOp: UserOperationRequest; entryPoint: Address }
    result: UserOperationGasEstimate
  }

  // EIP-7702
  wallet_signAuthorization: {
    params: { authorization: Authorization }
    result: SignedAuthorization
  }
  wallet_getDelegationStatus: {
    params: { address: Address }
    result: DelegationStatus
  }
  wallet_revokeDelegation: {
    params: { address: Address }
    result: Hash
  }

  // ERC-7579
  wallet_getInstalledModules: {
    params: { account?: Address }
    result: InstalledModule[]
  }
  wallet_installModule: {
    params: ModuleInstallRequest
    result: Hash
  }
  wallet_uninstallModule: {
    params: ModuleUninstallRequest
    result: Hash
  }
  wallet_forceUninstallModule: {
    params: ModuleForceUninstallRequest
    result: Hash
  }
  wallet_replaceModule: {
    params: ModuleReplaceRequest
    result: Hash
  }
  wallet_isModuleInstalled: {
    params: { address: Address; type: ModuleType; account?: Address }
    result: boolean
  }

  // Session Keys
  wallet_createSessionKey: {
    params: SessionKeyConfig
    result: SessionKeyResult
  }
  wallet_getSessionKeys: {
    params: { account?: Address }
    result: SessionKeyResult[]
  }
  wallet_revokeSessionKey: {
    params: { sessionKey: Address }
    result: Hash
  }

  // EIP-5564
  wallet_generateStealthAddress: {
    params: { recipientMeta: Address }
    result: StealthAddressResult
  }
  wallet_scanStealthPayments: {
    params: { fromBlock?: number; toBlock?: number }
    result: StealthPayment[]
  }
  wallet_getStealthMetaAddress: {
    params: { account?: Address }
    result: StealthMetaAddress
  }

  // Paymaster
  wallet_getPaymasterData: {
    params: SponsorshipRequest
    result: PaymasterData
  }
  wallet_sponsorUserOperation: {
    params: SponsorshipRequest
    result: PaymasterData
  }
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Extract params type for a method
 */
export type RpcParams<M extends keyof StableNetRpcSchema> = StableNetRpcSchema[M]['params']

/**
 * Extract result type for a method
 */
export type RpcResult<M extends keyof StableNetRpcSchema> = StableNetRpcSchema[M]['result']

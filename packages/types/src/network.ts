import type { Address } from 'viem'

/**
 * Network and Chain Configuration Types
 */

/**
 * Native currency definition
 */
export interface NativeCurrency {
  /** Currency name (e.g., "Ether") */
  name: string
  /** Currency symbol (e.g., "ETH") */
  symbol: string
  /** Decimal places (usually 18) */
  decimals: number
}

/**
 * Network configuration
 */
export interface Network {
  /** Chain ID */
  chainId: number
  /** Network display name */
  name: string
  /** JSON-RPC URL */
  rpcUrl: string
  /** ERC-4337 bundler URL */
  bundlerUrl: string
  /** Paymaster service URL (optional) */
  paymasterUrl?: string
  /** Block explorer URL (optional) */
  explorerUrl?: string
  /** Native currency */
  currency: NativeCurrency
  /** Whether this is a testnet */
  isTestnet?: boolean
  /** Whether this is a user-added custom network */
  isCustom?: boolean
}

/**
 * Core contract addresses
 */
export interface CoreAddresses {
  /** ERC-4337 EntryPoint */
  entryPoint: Address
  /** Kernel smart account implementation */
  kernel: Address
  /** Kernel factory */
  kernelFactory: Address
}

/**
 * Validator module addresses
 */
export interface ValidatorAddresses {
  /** ECDSA validator for EOA signatures */
  ecdsaValidator: Address
  /** WebAuthn validator for passkeys */
  webAuthnValidator: Address
  /** Multi-signature ECDSA validator */
  multiEcdsaValidator: Address
}

/**
 * Executor module addresses
 */
export interface ExecutorAddresses {
  /** Ownable executor for delegated execution */
  ownableExecutor: Address
}

/**
 * Hook module addresses
 */
export interface HookAddresses {
  /** Spending limit enforcement hook */
  spendingLimitHook: Address
}

/**
 * Paymaster addresses
 */
export interface PaymasterAddresses {
  /** Verifying paymaster (signature-based) */
  verifyingPaymaster: Address
  /** Token paymaster (ERC-20 payment) */
  tokenPaymaster: Address
}

/**
 * Privacy module addresses (EIP-5564 stealth)
 */
export interface PrivacyAddresses {
  /** Stealth announcement contract */
  stealthAnnouncer: Address
  /** Stealth meta-address registry */
  stealthRegistry: Address
}

/**
 * Compliance module addresses
 */
export interface ComplianceAddresses {
  /** KYC registry */
  kycRegistry: Address
  /** Compliance validator */
  complianceValidator: Address
}

/**
 * EIP-7702 delegate preset
 */
export interface DelegatePreset {
  /** Preset name */
  name: string
  /** Description */
  description: string
  /** Delegate contract address */
  address: Address
  /** List of features enabled */
  features: string[]
}

/**
 * Complete chain addresses
 */
export interface ChainAddresses {
  /** Chain ID */
  chainId: number
  /** Core contracts */
  core: CoreAddresses
  /** Validator modules */
  validators: ValidatorAddresses
  /** Executor modules */
  executors: ExecutorAddresses
  /** Hook modules */
  hooks: HookAddresses
  /** Paymaster contracts */
  paymasters: PaymasterAddresses
  /** Privacy modules */
  privacy: PrivacyAddresses
  /** Compliance modules */
  compliance: ComplianceAddresses
  /** EIP-7702 delegate presets */
  delegatePresets: DelegatePreset[]
}

/**
 * Service endpoints for a chain
 */
export interface ServiceUrls {
  /** Bundler RPC URL */
  bundler: string
  /** Paymaster service URL */
  paymaster: string
  /** Stealth server URL */
  stealthServer: string
}

/**
 * Complete chain configuration
 */
export interface ChainConfig {
  /** Contract addresses */
  addresses: ChainAddresses
  /** Service endpoints */
  services: ServiceUrls
  /** Supported tokens */
  tokens: import('./token').TokenDefinition[]
}

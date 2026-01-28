import type { Address } from 'viem'

/**
 * Core contract addresses for the platform
 */
export interface CoreAddresses {
  entryPoint: Address
  kernel: Address
  kernelFactory: Address
}

/**
 * Validator module addresses
 */
export interface ValidatorAddresses {
  ecdsaValidator: Address
  webAuthnValidator: Address
  multiEcdsaValidator: Address
}

/**
 * Executor module addresses
 */
export interface ExecutorAddresses {
  ownableExecutor: Address
}

/**
 * Hook module addresses
 */
export interface HookAddresses {
  spendingLimitHook: Address
}

/**
 * Paymaster addresses
 */
export interface PaymasterAddresses {
  verifyingPaymaster: Address
  tokenPaymaster: Address
}

/**
 * Privacy module addresses (stealth)
 */
export interface PrivacyAddresses {
  stealthAnnouncer: Address
  stealthRegistry: Address
}

/**
 * Compliance module addresses
 */
export interface ComplianceAddresses {
  kycRegistry: Address
  complianceValidator: Address
}

/**
 * Subscription contract addresses
 */
export interface SubscriptionAddresses {
  subscriptionManager: Address
  recurringPaymentExecutor: Address
  permissionManager: Address
}

/**
 * EIP-7702 delegate presets
 */
export interface DelegatePreset {
  name: string
  description: string
  address: Address
  features: string[]
}

/**
 * Complete contract addresses for a chain
 */
export interface ChainAddresses {
  chainId: number
  core: CoreAddresses
  validators: ValidatorAddresses
  executors: ExecutorAddresses
  hooks: HookAddresses
  paymasters: PaymasterAddresses
  privacy: PrivacyAddresses
  compliance: ComplianceAddresses
  subscriptions: SubscriptionAddresses
  delegatePresets: DelegatePreset[]
}

/**
 * Service URLs for a chain
 */
export interface ServiceUrls {
  bundler: string
  paymaster: string
  stealthServer: string
}

/**
 * Token definition
 */
export interface TokenDefinition {
  address: Address
  name: string
  symbol: string
  decimals: number
  logoUrl?: string
}

/**
 * Complete chain configuration
 */
export interface ChainConfig {
  addresses: ChainAddresses
  services: ServiceUrls
  tokens: TokenDefinition[]
}

/**
 * Address update event
 */
export interface AddressUpdateEvent {
  chainId: number
  timestamp: number
  addresses: ChainAddresses
}

/**
 * Watcher options
 */
export interface WatcherOptions {
  /** Path to watch for address file changes */
  watchPath: string
  /** Debounce delay in milliseconds */
  debounceMs?: number
  /** Callback on address update */
  onUpdate?: (event: AddressUpdateEvent) => void
  /** Callback on error */
  onError?: (error: Error) => void
}

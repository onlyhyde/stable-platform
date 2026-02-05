/**
 * @stablenet/sdk-addresses
 *
 * Contract address management for StableNet SDK.
 * Provides type-safe access to contract addresses across supported chains.
 */

// Type exports
export type {
  ChainAddresses,
  ChainConfig,
  ComplianceAddresses,
  CoreAddresses,
  DelegatePreset,
  ExecutorAddresses,
  HookAddresses,
  PaymasterAddresses,
  PrivacyAddresses,
  ServiceUrls,
  SubscriptionAddresses,
  TokenDefinition,
  ValidatorAddresses,
} from './types'

// Address utilities
export {
  CHAIN_ADDRESSES,
  DEFAULT_TOKENS,
  SERVICE_URLS,
  SUPPORTED_CHAIN_IDS,
  ZERO_ADDRESS,
  isChainSupported,
  isZeroAddress,
  assertNotZeroAddress,
  getChainAddresses,
  getChainConfig,
  getDefaultTokens,
  getServiceUrls,
  getEntryPoint,
  getKernel,
  getKernelFactory,
  getVerifyingPaymaster,
  getEcdsaValidator,
  getStealthAnnouncer,
  getStealthRegistry,
  getSubscriptionManager,
  getRecurringPaymentExecutor,
  getPermissionManager,
  getDelegatePresets,
  getDefaultDelegatePreset,
  getLegacyContractAddresses,
} from './addresses'

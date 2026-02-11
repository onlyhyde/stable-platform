/**
 * @stablenet/sdk-addresses
 *
 * Contract address management for StableNet SDK.
 * Provides type-safe access to contract addresses across supported chains.
 */

// Address utilities
export {
  assertNotZeroAddress,
  CHAIN_ADDRESSES,
  DEFAULT_TOKENS,
  getChainAddresses,
  getChainConfig,
  getDefaultDelegatePreset,
  getDefaultTokens,
  getDelegatePresets,
  getEcdsaValidator,
  getEntryPoint,
  getKernel,
  getKernelFactory,
  getLegacyContractAddresses,
  getPermissionManager,
  getRecurringPaymentExecutor,
  getServiceUrls,
  getStealthAnnouncer,
  getStealthRegistry,
  getSubscriptionManager,
  getVerifyingPaymaster,
  isChainSupported,
  isZeroAddress,
  SERVICE_URLS,
  SUPPORTED_CHAIN_IDS,
  ZERO_ADDRESS,
} from './addresses'
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

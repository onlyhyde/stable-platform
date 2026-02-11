/**
 * @stablenet/contracts
 *
 * Unified contract addresses and configuration for StableNet platform.
 * This package provides:
 * - Type-safe contract address access
 * - Service URL configuration
 * - Hot-reload capability for development
 * - Auto-generation from deployment outputs
 */

// Address utilities
export {
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
  SERVICE_URLS,
  SUPPORTED_CHAIN_IDS,
} from './addresses'
// Type exports
export type {
  AddressUpdateEvent,
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
  WatcherOptions,
} from './types'

// Watcher for hot-reload
export { ContractAddressWatcher, createAddressWatcher } from './watcher'

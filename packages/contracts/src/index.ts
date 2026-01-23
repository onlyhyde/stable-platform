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
  TokenDefinition,
  ValidatorAddresses,
  AddressUpdateEvent,
  WatcherOptions,
} from './types'

// Address utilities
export {
  CHAIN_ADDRESSES,
  DEFAULT_TOKENS,
  SERVICE_URLS,
  SUPPORTED_CHAIN_IDS,
  isChainSupported,
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
  getDelegatePresets,
  getDefaultDelegatePreset,
  getLegacyContractAddresses,
} from './addresses'

// Watcher for hot-reload
export { ContractAddressWatcher, createAddressWatcher } from './watcher'

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

// Address utilities and canonical constants
export {
  CHAIN_ADDRESSES,
  DEFAULT_TOKENS,
  // Canonical addresses (same on all production EVM chains)
  ECDSA_VALIDATOR_ADDRESS,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_V07_ADDRESS,
  // Chain-aware getters
  getChainAddresses,
  getChainConfig,
  getContractAddress,
  getDefaultDelegatePreset,
  getDefaultTokens,
  getDelegatePresets,
  getEcdsaValidator,
  getEntryPoint,
  getErc20Paymaster,
  getFactoryStaker,
  getKernel,
  getKernelFactory,
  getLegacyContractAddresses,
  getLendingPool,
  getMultiChainValidator,
  getMultiSigValidator,
  getPermissionManager,
  getPriceOracle,
  getRecurringPaymentExecutor,
  getServiceUrls,
  getSponsorPaymaster,
  getStakingVault,
  getStealthAnnouncer,
  getStealthRegistry,
  getSubscriptionManager,
  getUniswapFactory,
  getUniswapQuoter,
  getUniswapRouter,
  getUsdc,
  getVerifyingPaymaster,
  getWebAuthnValidator,
  getWkrc,
  assertNotZeroAddress,
  isChainSupported,
  isZeroAddress,
  KERNEL_ADDRESSES,
  KERNEL_V3_1_FACTORY_ADDRESS,
  SERVICE_URLS,
  SUPPORTED_CHAIN_IDS,
  ZERO_ADDRESS,
  // Precompile constants (chain 8283)
  CHAIN_PRECOMPILES,
  PRECOMPILED_ADDRESSES,
  SYSTEM_CONTRACTS,
  SYSTEM_PRECOMPILES,
  NATIVE_COIN_ADAPTER_ADDRESS,
  GOV_VALIDATOR_ADDRESS,
  GOV_MASTER_MINTER_ADDRESS,
  GOV_MINTER_ADDRESS,
  GOV_COUNCIL_ADDRESS,
  BLS_POP_PRECOMPILE_ADDRESS,
  NATIVE_COIN_MANAGER_ADDRESS,
  ACCOUNT_MANAGER_ADDRESS,
  // Precompile getters
  getPrecompiles,
  getNativeCoinAdapter,
  getGovValidator,
  getGovMasterMinter,
  getGovMinter,
  getGovCouncil,
  getBlsPopPrecompile,
  getNativeCoinManager,
  getAccountManager,
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
  PrecompiledAddresses,
  PrivacyAddresses,
  ServiceUrls,
  SubscriptionAddresses,
  SystemContractAddresses,
  SystemPrecompileAddresses,
  TokenDefinition,
  ValidatorAddresses,
  WatcherOptions,
} from './types'

// Watcher for hot-reload (Node.js only - uses chokidar)
// Import from '@stablenet/contracts/watcher' directly to avoid bundling chokidar
// export { ContractAddressWatcher, createAddressWatcher } from './watcher'

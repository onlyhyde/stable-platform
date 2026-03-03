// Mock module for @stablenet/contracts - resolved by jest moduleNameMapper
// Provides minimal mocks for contract addresses and chain utilities

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ENTRY_POINT_ADDRESS = '0xEf6817fe73741A8F10088f9511c64b666a338A14'
const ENTRY_POINT_V07_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
const ECDSA_VALIDATOR_ADDRESS = '0x845ADb2C711129d4f3966735eD98a9F09fC4cE57'
const KERNEL_V3_1_FACTORY_ADDRESS = '0x6723b44Abeec4E71eBE3232BD5B455805baDD22f'

const SUPPORTED_CHAIN_IDS = [1, 8283, 11155111]

const KERNEL_ADDRESSES = {
  factory: KERNEL_V3_1_FACTORY_ADDRESS,
  implementation: ZERO_ADDRESS,
}

const CHAIN_ADDRESSES = {}
const DEFAULT_TOKENS = []
const SERVICE_URLS = {}
const CHAIN_PRECOMPILES = {}
const PRECOMPILED_ADDRESSES = {}
const SYSTEM_CONTRACTS = {}
const SYSTEM_PRECOMPILES = {}
const NATIVE_COIN_ADAPTER_ADDRESS = ZERO_ADDRESS
const GOV_VALIDATOR_ADDRESS = ZERO_ADDRESS
const GOV_MASTER_MINTER_ADDRESS = ZERO_ADDRESS
const GOV_MINTER_ADDRESS = ZERO_ADDRESS
const GOV_COUNCIL_ADDRESS = ZERO_ADDRESS
const BLS_POP_PRECOMPILE_ADDRESS = ZERO_ADDRESS
const NATIVE_COIN_MANAGER_ADDRESS = ZERO_ADDRESS
const ACCOUNT_MANAGER_ADDRESS = ZERO_ADDRESS

function isChainSupported(chainId) {
  return SUPPORTED_CHAIN_IDS.includes(chainId)
}

function isZeroAddress(address) {
  return address === ZERO_ADDRESS
}

function assertNotZeroAddress(address) {
  if (isZeroAddress(address)) {
    throw new Error('Zero address not allowed')
  }
}

// Chain-aware getter stubs — return canonical addresses regardless of chainId
function getEntryPoint() {
  return ENTRY_POINT_ADDRESS
}
function getEcdsaValidator() {
  return ECDSA_VALIDATOR_ADDRESS
}
function getKernel() {
  return ZERO_ADDRESS
}
function getKernelFactory() {
  return KERNEL_V3_1_FACTORY_ADDRESS
}
function getChainAddresses() {
  return {}
}
function getChainConfig() {
  return null
}
function getContractAddress() {
  return ZERO_ADDRESS
}
function getDefaultDelegatePreset() {
  return null
}
function getDefaultTokens() {
  return []
}
function getDelegatePresets() {
  return []
}
function getErc20Paymaster() {
  return ZERO_ADDRESS
}
function getFactoryStaker() {
  return ZERO_ADDRESS
}
function getLegacyContractAddresses() {
  return {}
}
function getLendingPool() {
  return ZERO_ADDRESS
}
function getMultiChainValidator() {
  return ZERO_ADDRESS
}
function getMultiSigValidator() {
  return ZERO_ADDRESS
}
function getPermissionManager() {
  return ZERO_ADDRESS
}
function getPriceOracle() {
  return ZERO_ADDRESS
}
function getRecurringPaymentExecutor() {
  return ZERO_ADDRESS
}
function getServiceUrls() {
  return {}
}
function getSponsorPaymaster() {
  return ZERO_ADDRESS
}
function getStakingVault() {
  return ZERO_ADDRESS
}
function getStealthAnnouncer() {
  return ZERO_ADDRESS
}
function getStealthRegistry() {
  return ZERO_ADDRESS
}
function getSubscriptionManager() {
  return ZERO_ADDRESS
}
function getUniswapFactory() {
  return ZERO_ADDRESS
}
function getUniswapQuoter() {
  return ZERO_ADDRESS
}
function getUniswapRouter() {
  return ZERO_ADDRESS
}
function getUsdc() {
  return ZERO_ADDRESS
}
function getVerifyingPaymaster() {
  return ZERO_ADDRESS
}
function getWebAuthnValidator() {
  return ZERO_ADDRESS
}
function getWkrc() {
  return ZERO_ADDRESS
}
function getPrecompiles() {
  return {}
}
function getNativeCoinAdapter() {
  return ZERO_ADDRESS
}
function getGovValidator() {
  return ZERO_ADDRESS
}
function getGovMasterMinter() {
  return ZERO_ADDRESS
}
function getGovMinter() {
  return ZERO_ADDRESS
}
function getGovCouncil() {
  return ZERO_ADDRESS
}
function getBlsPopPrecompile() {
  return ZERO_ADDRESS
}
function getNativeCoinManager() {
  return ZERO_ADDRESS
}
function getAccountManager() {
  return ZERO_ADDRESS
}

module.exports = {
  // Constants
  ZERO_ADDRESS,
  ENTRY_POINT_ADDRESS,
  ENTRY_POINT_V07_ADDRESS,
  ECDSA_VALIDATOR_ADDRESS,
  KERNEL_V3_1_FACTORY_ADDRESS,
  KERNEL_ADDRESSES,
  SUPPORTED_CHAIN_IDS,
  CHAIN_ADDRESSES,
  DEFAULT_TOKENS,
  SERVICE_URLS,
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

  // Utility functions
  isChainSupported,
  isZeroAddress,
  assertNotZeroAddress,

  // Chain-aware getters
  getEntryPoint,
  getEcdsaValidator,
  getKernel,
  getKernelFactory,
  getChainAddresses,
  getChainConfig,
  getContractAddress,
  getDefaultDelegatePreset,
  getDefaultTokens,
  getDelegatePresets,
  getErc20Paymaster,
  getFactoryStaker,
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
  getPrecompiles,
  getNativeCoinAdapter,
  getGovValidator,
  getGovMasterMinter,
  getGovMinter,
  getGovCouncil,
  getBlsPopPrecompile,
  getNativeCoinManager,
  getAccountManager,
}

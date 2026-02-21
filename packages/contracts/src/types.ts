import type { Address } from 'viem'

/**
 * Core contract addresses for the platform
 */
export interface CoreAddresses {
  entryPoint: Address
  kernel: Address
  kernelFactory: Address
  factoryStaker: Address
}

/**
 * Validator module addresses
 */
export interface ValidatorAddresses {
  ecdsaValidator: Address
  webAuthnValidator: Address
  multiChainValidator: Address
  multiSigValidator: Address
  weightedEcdsaValidator: Address
}

/**
 * Executor module addresses
 */
export interface ExecutorAddresses {
  sessionKeyExecutor: Address
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
  erc20Paymaster: Address
  permit2Paymaster: Address
  sponsorPaymaster: Address
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
  regulatoryRegistry: Address
  auditHook: Address
  auditLogger: Address
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
 * Token contract addresses
 */
export interface TokenAddresses {
  wkrc: Address
  usdc: Address
}

/**
 * DeFi protocol addresses
 */
export interface DefiAddresses {
  lendingPool: Address
  stakingVault: Address
  priceOracle: Address
  proofOfReserve: Address
  privateBank: Address
  permit2: Address
}

/**
 * Uniswap V3 addresses
 */
export interface UniswapAddresses {
  factory: Address
  swapRouter: Address
  quoter: Address
  nftPositionManager: Address
  wkrcUsdcPool: Address
}

/**
 * Fallback handler addresses
 */
export interface FallbackAddresses {
  flashLoanFallback: Address
  tokenReceiverFallback: Address
}

/**
 * System contract addresses (chain 8283 precompiled contracts)
 */
export interface SystemContractAddresses {
  nativeCoinAdapter: Address
  govValidator: Address
  govMasterMinter: Address
  govMinter: Address
  govCouncil: Address
}

/**
 * System precompile addresses (chain 8283 low-level precompiles)
 */
export interface SystemPrecompileAddresses {
  blsPopPrecompile: Address
  nativeCoinManager: Address
  accountManager: Address
}

/**
 * All precompiled/system addresses for chain 8283
 */
export interface PrecompiledAddresses {
  systemContracts: SystemContractAddresses
  systemPrecompiles: SystemPrecompileAddresses
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
  tokens: TokenAddresses
  defi: DefiAddresses
  uniswap: UniswapAddresses
  fallbacks: FallbackAddresses
  precompiles?: PrecompiledAddresses
  delegatePresets: DelegatePreset[]
  /** All contract addresses as flat key-value pairs (for dynamic access) */
  raw: Record<string, Address>
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

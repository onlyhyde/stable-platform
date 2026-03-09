/**
 * Shared key-to-structure mapping for contract addresses.
 *
 * Maps flat JSON keys (from addresses.json) to their structured location
 * in ChainAddresses. Used by both the code generator and the watcher
 * to ensure a single source of truth for field mapping.
 */

export interface FieldMapping {
  group: string
  field: string
}

/**
 * Maps addresses.json keys to their location in ChainAddresses.
 * Keys not listed here go into `raw` only.
 */
export const KEY_MAP: Readonly<Record<string, FieldMapping>> = {
  // core
  entryPoint: { group: 'core', field: 'entryPoint' },
  kernel: { group: 'core', field: 'kernel' },
  kernelFactory: { group: 'core', field: 'kernelFactory' },
  factoryStaker: { group: 'core', field: 'factoryStaker' },

  // validators
  ecdsaValidator: { group: 'validators', field: 'ecdsaValidator' },
  webAuthnValidator: { group: 'validators', field: 'webAuthnValidator' },
  multiChainValidator: { group: 'validators', field: 'multiChainValidator' },
  multiSigValidator: { group: 'validators', field: 'multiSigValidator' },
  weightedEcdsaValidator: { group: 'validators', field: 'weightedEcdsaValidator' },

  // executors
  sessionKeyExecutor: { group: 'executors', field: 'sessionKeyExecutor' },

  // hooks
  spendingLimitHook: { group: 'hooks', field: 'spendingLimitHook' },

  // paymasters
  verifyingPaymaster: { group: 'paymasters', field: 'verifyingPaymaster' },
  erc20Paymaster: { group: 'paymasters', field: 'erc20Paymaster' },
  permit2Paymaster: { group: 'paymasters', field: 'permit2Paymaster' },
  sponsorPaymaster: { group: 'paymasters', field: 'sponsorPaymaster' },

  // privacy (stealth)
  erc5564Announcer: { group: 'privacy', field: 'stealthAnnouncer' },
  erc6538Registry: { group: 'privacy', field: 'stealthRegistry' },

  // compliance
  kycRegistry: { group: 'compliance', field: 'kycRegistry' },
  regulatoryRegistry: { group: 'compliance', field: 'regulatoryRegistry' },
  auditHook: { group: 'compliance', field: 'auditHook' },
  auditLogger: { group: 'compliance', field: 'auditLogger' },

  // subscriptions
  subscriptionManager: { group: 'subscriptions', field: 'subscriptionManager' },
  recurringPaymentExecutor: { group: 'subscriptions', field: 'recurringPaymentExecutor' },
  erc7715PermissionManager: { group: 'subscriptions', field: 'permissionManager' },

  // tokens
  wkrc: { group: 'tokens', field: 'wkrc' },
  usdc: { group: 'tokens', field: 'usdc' },

  // defi
  lendingPool: { group: 'defi', field: 'lendingPool' },
  stakingVault: { group: 'defi', field: 'stakingVault' },
  priceOracle: { group: 'defi', field: 'priceOracle' },
  proofOfReserve: { group: 'defi', field: 'proofOfReserve' },
  privateBank: { group: 'defi', field: 'privateBank' },
  permit2: { group: 'defi', field: 'permit2' },

  // uniswap
  uniswapV3Factory: { group: 'uniswap', field: 'factory' },
  uniswapV3SwapRouter: { group: 'uniswap', field: 'swapRouter' },
  uniswapV3Quoter: { group: 'uniswap', field: 'quoter' },
  uniswapV3NftPositionManager: { group: 'uniswap', field: 'nftPositionManager' },
  uniswapV3WkrcUsdcPool: { group: 'uniswap', field: 'wkrcUsdcPool' },

  // fallbacks
  flashLoanFallback: { group: 'fallbacks', field: 'flashLoanFallback' },
  tokenReceiverFallback: { group: 'fallbacks', field: 'tokenReceiverFallback' },
} as const

/**
 * Alias mappings for backward compatibility.
 * Maps old JSON key names to their canonical key name in KEY_MAP.
 */
export const KEY_ALIASES: Readonly<Record<string, string>> = {
  accountFactory: 'kernelFactory',
  paymaster: 'verifyingPaymaster',
  stealthAnnouncer: 'erc5564Announcer',
  stealthRegistry: 'erc6538Registry',
  permissionManager: 'erc7715PermissionManager',
} as const

/**
 * Group definitions with their field names (all default to zero address).
 */
export const GROUP_DEFAULTS: Readonly<Record<string, readonly string[]>> = {
  core: ['entryPoint', 'kernel', 'kernelFactory', 'factoryStaker'],
  validators: [
    'ecdsaValidator',
    'webAuthnValidator',
    'multiChainValidator',
    'multiSigValidator',
    'weightedEcdsaValidator',
  ],
  executors: ['sessionKeyExecutor'],
  hooks: ['spendingLimitHook'],
  paymasters: ['verifyingPaymaster', 'erc20Paymaster', 'permit2Paymaster', 'sponsorPaymaster'],
  privacy: ['stealthAnnouncer', 'stealthRegistry'],
  compliance: ['kycRegistry', 'regulatoryRegistry', 'auditHook', 'auditLogger'],
  subscriptions: ['subscriptionManager', 'recurringPaymentExecutor', 'permissionManager'],
  tokens: ['wkrc', 'usdc'],
  defi: ['lendingPool', 'stakingVault', 'priceOracle', 'proofOfReserve', 'privateBank', 'permit2'],
  uniswap: ['factory', 'swapRouter', 'quoter', 'nftPositionManager', 'wkrcUsdcPool'],
  fallbacks: ['flashLoanFallback', 'tokenReceiverFallback'],
} as const

/**
 * Ordered list of group names for consistent output generation.
 */
export const GROUP_ORDER = [
  'core',
  'validators',
  'executors',
  'hooks',
  'paymasters',
  'privacy',
  'compliance',
  'subscriptions',
  'tokens',
  'defi',
  'uniswap',
  'fallbacks',
] as const

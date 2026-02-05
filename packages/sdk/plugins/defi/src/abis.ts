import type { Abi } from 'viem'

/**
 * SwapExecutor ABI - ERC-7579 Executor for Uniswap V3 swaps
 */
export const SwapExecutorAbi = [
  // Module Interface
  {
    inputs: [{ name: 'data', type: 'bytes' }],
    name: 'onInstall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'data', type: 'bytes' }],
    name: 'onUninstall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'moduleTypeId', type: 'uint256' }],
    name: 'isModuleType',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ name: 'smartAccount', type: 'address' }],
    name: 'isInitialized',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Swap Functions
  {
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactInputSingle',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'path', type: 'bytes' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactInput',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Configuration
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'addWhitelistedToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'removeWhitelistedToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'dailyLimit', type: 'uint256' }],
    name: 'setDailyLimit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'perSwapLimit', type: 'uint256' }],
    name: 'setPerSwapLimit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'paused', type: 'bool' }],
    name: 'setPaused',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // View Functions
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getAccountConfig',
    outputs: [
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'perSwapLimit', type: 'uint256' },
      { name: 'dailyUsed', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'isPaused', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    name: 'isTokenWhitelisted',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: true, name: 'tokenIn', type: 'address' },
      { indexed: true, name: 'tokenOut', type: 'address' },
      { indexed: false, name: 'amountIn', type: 'uint256' },
      { indexed: false, name: 'amountOut', type: 'uint256' },
    ],
    name: 'SwapExecuted',
    type: 'event',
  },
] as const satisfies Abi

/**
 * LendingExecutor ABI - ERC-7579 Executor for lending operations
 */
export const LendingExecutorAbi = [
  // Module Interface
  {
    inputs: [{ name: 'data', type: 'bytes' }],
    name: 'onInstall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'data', type: 'bytes' }],
    name: 'onUninstall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'moduleTypeId', type: 'uint256' }],
    name: 'isModuleType',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ name: 'smartAccount', type: 'address' }],
    name: 'isInitialized',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Lending Operations
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'supply',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'borrow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'repay',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Configuration
  {
    inputs: [{ name: 'asset', type: 'address' }],
    name: 'addAllowedAsset',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'asset', type: 'address' }],
    name: 'removeAllowedAsset',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'minHealthFactor', type: 'uint256' }],
    name: 'setMinHealthFactor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'maxBorrowLimit', type: 'uint256' }],
    name: 'setMaxBorrowLimit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'paused', type: 'bool' }],
    name: 'setPaused',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // View Functions
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getAccountConfig',
    outputs: [
      { name: 'minHealthFactor', type: 'uint256' },
      { name: 'maxBorrowLimit', type: 'uint256' },
      { name: 'totalBorrowed', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'asset', type: 'address' },
    ],
    name: 'isAssetAllowed',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: true, name: 'asset', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Supplied',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: true, name: 'asset', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Withdrawn',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: true, name: 'asset', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Borrowed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: true, name: 'asset', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Repaid',
    type: 'event',
  },
] as const satisfies Abi

/**
 * StakingExecutor ABI - ERC-7579 Executor for staking operations
 */
export const StakingExecutorAbi = [
  // Module Interface
  {
    inputs: [{ name: 'data', type: 'bytes' }],
    name: 'onInstall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'data', type: 'bytes' }],
    name: 'onUninstall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'moduleTypeId', type: 'uint256' }],
    name: 'isModuleType',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ name: 'smartAccount', type: 'address' }],
    name: 'isInitialized',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Staking Operations
  {
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'stake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'lockDuration', type: 'uint256' },
    ],
    name: 'stakeWithLock',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'unstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'pool', type: 'address' }],
    name: 'claimRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'pool', type: 'address' }],
    name: 'compoundRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Configuration
  {
    inputs: [{ name: 'pool', type: 'address' }],
    name: 'addAllowedPool',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'pool', type: 'address' }],
    name: 'removeAllowedPool',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'maxStake', type: 'uint256' }],
    name: 'setMaxStakePerPool',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'dailyLimit', type: 'uint256' }],
    name: 'setDailyStakeLimit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'paused', type: 'bool' }],
    name: 'setPaused',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // View Functions
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getAccountConfig',
    outputs: [
      { name: 'maxStakePerPool', type: 'uint256' },
      { name: 'dailyStakeLimit', type: 'uint256' },
      { name: 'dailyUsed', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'isPaused', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'pool', type: 'address' },
    ],
    name: 'isPoolAllowed',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getAllowedPools',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'pool', type: 'address' },
    ],
    name: 'getStakedAmount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'pool', type: 'address' },
    ],
    name: 'getPendingRewards',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: true, name: 'pool', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Staked',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: true, name: 'pool', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'Unstaked',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: true, name: 'pool', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'RewardsClaimed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: true, name: 'pool', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'RewardsCompounded',
    type: 'event',
  },
] as const satisfies Abi

/**
 * HealthFactorHook ABI - ERC-7579 Hook for health factor validation
 */
export const HealthFactorHookAbi = [
  // Module Interface
  {
    inputs: [{ name: 'data', type: 'bytes' }],
    name: 'onInstall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'data', type: 'bytes' }],
    name: 'onUninstall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'moduleTypeId', type: 'uint256' }],
    name: 'isModuleType',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ name: 'smartAccount', type: 'address' }],
    name: 'isInitialized',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Hook Interface
  {
    inputs: [
      { name: 'msgSender', type: 'address' },
      { name: 'msgValue', type: 'uint256' },
      { name: 'msgData', type: 'bytes' },
    ],
    name: 'preCheck',
    outputs: [{ name: 'hookData', type: 'bytes' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'hookData', type: 'bytes' }],
    name: 'postCheck',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  // Configuration
  {
    inputs: [{ name: 'threshold', type: 'uint256' }],
    name: 'setMinHealthFactor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'enabled', type: 'bool' }],
    name: 'setEnabled',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'target', type: 'address' }],
    name: 'addMonitoredTarget',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'target', type: 'address' }],
    name: 'removeMonitoredTarget',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // View Functions
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getMinHealthFactor',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'isEnabled',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'target', type: 'address' },
    ],
    name: 'isMonitoredTarget',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getMonitoredTargets',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getAccountConfig',
    outputs: [
      { name: 'minHF', type: 'uint256' },
      { name: 'enabled', type: 'bool' },
      { name: 'initialized', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getLendingPool',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getCurrentHealthFactor',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: false, name: 'preHealthFactor', type: 'uint256' },
      { indexed: false, name: 'postHealthFactor', type: 'uint256' },
    ],
    name: 'HealthFactorChanged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: false, name: 'threshold', type: 'uint256' },
    ],
    name: 'MinHealthFactorSet',
    type: 'event',
  },
] as const satisfies Abi

/**
 * MerchantRegistry ABI - Merchant registration and verification
 */
export const MerchantRegistryAbi = [
  // Registration
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'website', type: 'string' },
      { name: 'email', type: 'string' },
    ],
    name: 'registerMerchant',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'website', type: 'string' },
      { name: 'email', type: 'string' },
    ],
    name: 'updateMerchantInfo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Verification
  {
    inputs: [{ name: 'merchant', type: 'address' }],
    name: 'verifyMerchant',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'merchant', type: 'address' }],
    name: 'revokeVerification',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Suspension
  {
    inputs: [{ name: 'merchant', type: 'address' }],
    name: 'suspendMerchant',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'merchant', type: 'address' }],
    name: 'unsuspendMerchant',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Fee Management
  {
    inputs: [
      { name: 'merchant', type: 'address' },
      { name: 'feeBps', type: 'uint256' },
    ],
    name: 'setMerchantFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'merchant', type: 'address' }],
    name: 'getMerchantFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Verifier Management
  {
    inputs: [{ name: 'verifier', type: 'address' }],
    name: 'addVerifier',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'verifier', type: 'address' }],
    name: 'removeVerifier',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // View Functions
  {
    inputs: [{ name: 'merchant', type: 'address' }],
    name: 'isMerchantRegistered',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'merchant', type: 'address' }],
    name: 'isMerchantVerified',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'merchant', type: 'address' }],
    name: 'isMerchantSuspended',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'merchant', type: 'address' }],
    name: 'isMerchantActive',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'verifier', type: 'address' }],
    name: 'isVerifier',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'merchant', type: 'address' }],
    name: 'getMerchantInfo',
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'website', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'isVerified', type: 'bool' },
      { name: 'isSuspended', type: 'bool' },
      { name: 'registeredAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getVerifiedMerchants',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalMerchants',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'merchant', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
    ],
    name: 'MerchantRegistered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'merchant', type: 'address' },
      { indexed: true, name: 'verifier', type: 'address' },
    ],
    name: 'MerchantVerified',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'merchant', type: 'address' },
      { indexed: true, name: 'revoker', type: 'address' },
    ],
    name: 'VerificationRevoked',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'merchant', type: 'address' }],
    name: 'MerchantSuspended',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'merchant', type: 'address' }],
    name: 'MerchantUnsuspended',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'merchant', type: 'address' },
      { indexed: false, name: 'feeBps', type: 'uint256' },
    ],
    name: 'MerchantFeeUpdated',
    type: 'event',
  },
] as const satisfies Abi

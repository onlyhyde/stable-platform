import { MODULE_INTERFACE_ABI } from './module'

/**
 * Session Key Executor ABI
 * ERC-7579 Executor for session key management
 */
export const SESSION_KEY_EXECUTOR_ABI = [
  ...MODULE_INTERFACE_ABI,
  {
    type: 'function',
    name: 'addSessionKey',
    inputs: [
      { name: 'sessionKey', type: 'address' },
      { name: 'allowedTargets', type: 'address[]' },
      { name: 'spendLimit', type: 'uint256' },
      { name: 'validAfter', type: 'uint48' },
      { name: 'validUntil', type: 'uint48' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeSessionKey',
    inputs: [{ name: 'sessionKey', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isSessionKeyValid',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'sessionKey', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSessionKey',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'sessionKey', type: 'address' },
    ],
    outputs: [
      { name: 'allowedTargets', type: 'address[]' },
      { name: 'spendLimit', type: 'uint256' },
      { name: 'validAfter', type: 'uint48' },
      { name: 'validUntil', type: 'uint48' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
  },
] as const

/**
 * Swap Executor ABI
 * ERC-7579 Executor for Uniswap V3 swaps
 */
export const SWAP_EXECUTOR_ABI = [
  ...MODULE_INTERFACE_ABI,
  {
    type: 'function',
    name: 'swapExactInputSingle',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'swapExactInput',
    inputs: [
      { name: 'path', type: 'bytes' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'addWhitelistedToken',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeWhitelistedToken',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setDailyLimit',
    inputs: [{ name: 'dailyLimit', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPerSwapLimit',
    inputs: [{ name: 'perSwapLimit', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPaused',
    inputs: [{ name: 'paused', type: 'bool' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAccountConfig',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'perSwapLimit', type: 'uint256' },
      { name: 'dailyUsed', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'isPaused', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isTokenWhitelisted',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'SwapExecuted',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'tokenIn', type: 'address', indexed: true },
      { name: 'tokenOut', type: 'address', indexed: true },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'amountOut', type: 'uint256', indexed: false },
    ],
  },
] as const

/**
 * Lending Executor ABI
 * ERC-7579 Executor for lending operations (Aave-style)
 */
export const LENDING_EXECUTOR_ABI = [
  ...MODULE_INTERFACE_ABI,
  {
    type: 'function',
    name: 'supply',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'borrow',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'repay',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'addAllowedAsset',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeAllowedAsset',
    inputs: [{ name: 'asset', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMinHealthFactor',
    inputs: [{ name: 'minHealthFactor', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMaxBorrowLimit',
    inputs: [{ name: 'maxBorrowLimit', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPaused',
    inputs: [{ name: 'paused', type: 'bool' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAccountConfig',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'minHealthFactor', type: 'uint256' },
      { name: 'maxBorrowLimit', type: 'uint256' },
      { name: 'totalBorrowed', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAssetAllowed',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'asset', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Supplied',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Borrowed',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Repaid',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'asset', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

/**
 * Staking Executor ABI
 * ERC-7579 Executor for staking operations
 */
export const STAKING_EXECUTOR_ABI = [
  ...MODULE_INTERFACE_ABI,
  {
    type: 'function',
    name: 'stake',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'stakeWithLock',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'lockDuration', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unstake',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimRewards',
    inputs: [{ name: 'pool', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'compoundRewards',
    inputs: [{ name: 'pool', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'addAllowedPool',
    inputs: [{ name: 'pool', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeAllowedPool',
    inputs: [{ name: 'pool', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMaxStakePerPool',
    inputs: [{ name: 'maxStake', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setDailyStakeLimit',
    inputs: [{ name: 'dailyLimit', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPaused',
    inputs: [{ name: 'paused', type: 'bool' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAccountConfig',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'maxStakePerPool', type: 'uint256' },
      { name: 'dailyStakeLimit', type: 'uint256' },
      { name: 'dailyUsed', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'isPaused', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isPoolAllowed',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'pool', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllowedPools',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getStakedAmount',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'pool', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPendingRewards',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'pool', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Staked',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'pool', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Unstaked',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'pool', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RewardsClaimed',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'pool', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RewardsCompounded',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'pool', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

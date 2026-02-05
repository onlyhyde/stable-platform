import { MODULE_INTERFACE_ABI } from './module'

/**
 * Spending Limit Hook ABI
 * ERC-7579 Hook for enforcing spending limits
 */
export const SPENDING_LIMIT_HOOK_ABI = [
  ...MODULE_INTERFACE_ABI,
  {
    type: 'function',
    name: 'preCheck',
    inputs: [
      { name: 'msgSender', type: 'address' },
      { name: 'msgValue', type: 'uint256' },
      { name: 'msgData', type: 'bytes' },
    ],
    outputs: [{ name: 'hookData', type: 'bytes' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'postCheck',
    inputs: [{ name: 'hookData', type: 'bytes' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'setLimit',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'limit', type: 'uint256' },
      { name: 'period', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getLimit',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [
      { name: 'limit', type: 'uint256' },
      { name: 'used', type: 'uint256' },
      { name: 'period', type: 'uint256' },
      { name: 'lastReset', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'LimitSet',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'limit', type: 'uint256', indexed: false },
      { name: 'period', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SpendRecorded',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'remaining', type: 'uint256', indexed: false },
    ],
  },
] as const

/**
 * Health Factor Hook ABI
 * ERC-7579 Hook for DeFi health factor validation
 */
export const HEALTH_FACTOR_HOOK_ABI = [
  ...MODULE_INTERFACE_ABI,
  {
    type: 'function',
    name: 'preCheck',
    inputs: [
      { name: 'msgSender', type: 'address' },
      { name: 'msgValue', type: 'uint256' },
      { name: 'msgData', type: 'bytes' },
    ],
    outputs: [{ name: 'hookData', type: 'bytes' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'postCheck',
    inputs: [{ name: 'hookData', type: 'bytes' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'setMinHealthFactor',
    inputs: [{ name: 'threshold', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setEnabled',
    inputs: [{ name: 'enabled', type: 'bool' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'addMonitoredTarget',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeMonitoredTarget',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getMinHealthFactor',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isEnabled',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isMonitoredTarget',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'target', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMonitoredTargets',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAccountConfig',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'minHF', type: 'uint256' },
      { name: 'enabled', type: 'bool' },
      { name: 'initialized', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLendingPool',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCurrentHealthFactor',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'HealthFactorChanged',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'preHealthFactor', type: 'uint256', indexed: false },
      { name: 'postHealthFactor', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MinHealthFactorSet',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'threshold', type: 'uint256', indexed: false },
    ],
  },
] as const

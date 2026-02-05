/**
 * Spending Limit Hook ABI
 */
export const SPENDING_LIMIT_HOOK_ABI = [
  {
    type: 'function',
    name: 'onInstall',
    inputs: [{ name: 'data', type: 'bytes' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'onUninstall',
    inputs: [{ name: 'data', type: 'bytes' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'preCheck',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'callData', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'postCheck',
    inputs: [{ name: 'hookData', type: 'bytes' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getSpendingLimit',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [
      { name: 'limit', type: 'uint256' },
      { name: 'spent', type: 'uint256' },
      { name: 'resetTime', type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setLimit',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'limit', type: 'uint256' },
      { name: 'period', type: 'uint64' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'LimitSet',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'limit', type: 'uint256', indexed: false },
      { name: 'period', type: 'uint64', indexed: false },
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

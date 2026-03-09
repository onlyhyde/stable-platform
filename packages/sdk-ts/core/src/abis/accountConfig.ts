/**
 * ERC-7579 Account Config ABI (IERC7579AccountConfig)
 *
 * @see EIP-7579 §3.5 — Account identification and capability queries
 */
export const ACCOUNT_CONFIG_ABI = [
  {
    type: 'function',
    name: 'accountId',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'supportsExecutionMode',
    inputs: [{ name: 'encodedMode', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'supportsModule',
    inputs: [{ name: 'moduleTypeId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const

/**
 * ERC-7579 Base Module Interface ABI
 * Standard interface that all modules must implement
 * @see https://eips.ethereum.org/EIPS/eip-7579
 */
export const MODULE_INTERFACE_ABI = [
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
    name: 'isModuleType',
    inputs: [{ name: 'moduleTypeId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isInitialized',
    inputs: [{ name: 'smartAccount', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const

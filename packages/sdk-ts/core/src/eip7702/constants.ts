/**
 * EIP-7702 Constants
 *
 * Based on EIP-7702 specification: EOA Code Delegation
 */

import type { Address } from 'viem'
import type { DelegatePreset } from './types'

// EIP-7702 Magic byte prefix for authorization hash
export const EIP7702_MAGIC = 0x05

// EIP-7702 SetCode transaction type
export const SETCODE_TX_TYPE = 0x04

// EIP-7702 delegation prefix in bytecode (0xef0100 + 20 bytes address)
export const DELEGATION_PREFIX = '0xef0100'

// EIP-4337 v0.9: initCode "factory" address for EIP-7702 path
// When initCode starts with this address (right-padded 0x7702), EntryPoint
// skips factory deployment and uses EIP-7702 authorization instead.
export const EIP7702_INIT_CODE_ADDRESS: Address = '0x0000000000000000000000000000000000007702'

// Zero address for revocation
export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000'

/**
 * Default delegate presets by chain ID
 */
export const DELEGATE_PRESETS: Record<number, DelegatePreset[]> = {
  // Devnet (Anvil)
  31337: [
    {
      name: 'Kernel v3.0',
      description: 'ZeroDev Kernel - ERC-7579 compatible Smart Account',
      address: '0xA7c59f010700930003b33aB25a7a0679C860f29c',
      features: ['ERC-7579', 'Modular', 'Gas Sponsorship', 'Session Keys'],
    },
  ],
  // Testnet (Sepolia)
  11155111: [
    {
      name: 'Kernel v3.0',
      description: 'ZeroDev Kernel - ERC-7579 compatible Smart Account',
      address: '0x0000000000000000000000000000000000000000', // To be configured
      features: ['ERC-7579', 'Modular', 'Gas Sponsorship', 'Session Keys'],
    },
  ],
  // Mainnet
  1: [],
}

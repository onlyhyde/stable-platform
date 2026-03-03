/**
 * Hook Module Definitions
 *
 * ERC-7579 Module Type 4: Hooks
 * Pre/post execution hooks for validation and state management.
 */

import { MODULE_TYPE } from '@stablenet/sdk-types'
import type { Address } from 'viem'
import {
  createModuleEntry,
  DEFAULT_SUPPORTED_CHAINS,
  type ModuleRegistryEntry,
  SUPPORTED_CHAIN_IDS,
} from './types'

// ============================================================================
// Spending Limit Hook
// ============================================================================

/**
 * Spending Limit Hook module definition
 * Limit spending per time period for enhanced security
 */
export const SPENDING_LIMIT_HOOK: ModuleRegistryEntry = createModuleEntry(
  {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.HOOK,
    name: 'Spending Limit',
    description: 'Limit spending per time period for enhanced security',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['hook', 'security', 'limit', 'spending'],
    docsUrl: 'https://docs.stablenet.io/modules/spending-limit',
  },
  {
    version: '1.0.0',
    fields: [
      {
        name: 'token',
        label: 'Token',
        description: 'Token to limit (0x0 for native ETH)',
        type: 'address',
        required: true,
        defaultValue: '0x0000000000000000000000000000000000000000',
      },
      {
        name: 'limit',
        label: 'Spending Limit',
        description: 'Maximum amount per period',
        type: 'uint256',
        required: true,
      },
      {
        name: 'period',
        label: 'Reset Period',
        description: 'Period in seconds before limit resets',
        type: 'uint64',
        required: true,
        validation: {
          min: '3600', // 1 hour minimum
          message: 'Period must be at least 1 hour (3600 seconds)',
        },
      },
    ],
  },
  {
    [SUPPORTED_CHAIN_IDS.MAINNET]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.SEPOLIA]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.LOCAL]: '0xf5059a5D33d5853360D16C683c16e67980206f36' as Address,
    [SUPPORTED_CHAIN_IDS.STABLENET]: '0x304cb9f3725e8b807c2fe951c8db7fea4176f1c5' as Address,
  },
  DEFAULT_SUPPORTED_CHAINS
)

// ============================================================================
// All Hooks
// ============================================================================

/**
 * All built-in hook modules
 */
export const HOOK_MODULES: ModuleRegistryEntry[] = [SPENDING_LIMIT_HOOK]

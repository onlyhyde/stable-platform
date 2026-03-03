/**
 * Fallback Module Definitions
 *
 * ERC-7579 Module Type 3: Fallbacks
 * Handle calls to unsupported functions.
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
// Token Receiver Fallback
// ============================================================================

/**
 * Token Receiver Fallback module definition
 *
 * Handles ERC-777 tokensReceived callbacks via fallback routing.
 * ERC-721/ERC-1155 are handled natively by Kernel's built-in pure functions
 * and do not require a fallback module.
 */
export const TOKEN_RECEIVER_FALLBACK: ModuleRegistryEntry = createModuleEntry(
  {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.FALLBACK,
    name: 'Token Receiver (ERC-777)',
    description:
      'Handle ERC-777 tokensReceived callbacks. ERC-721/ERC-1155 are handled natively by Kernel.',
    version: '1.1.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['fallback', 'token', 'erc777'],
    docsUrl: 'https://docs.stablenet.io/modules/token-receiver',
  },
  {
    version: '1.0.0',
    fields: [], // No configuration needed
  },
  {
    [SUPPORTED_CHAIN_IDS.MAINNET]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.SEPOLIA]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.LOCAL]: '0x95401dc811bb5740090279Ba06cfA8fcF6113778' as Address,
    [SUPPORTED_CHAIN_IDS.STABLENET]: '0x39ff4ad6e3b8357fba61a9b10b74b344902e01a4' as Address,
  },
  DEFAULT_SUPPORTED_CHAINS
)

// ============================================================================
// All Fallbacks
// ============================================================================

/**
 * All built-in fallback modules
 */
export const FALLBACK_MODULES: ModuleRegistryEntry[] = [TOKEN_RECEIVER_FALLBACK]

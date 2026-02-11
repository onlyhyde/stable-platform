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
 * Enable receiving ERC721, ERC1155, and other token standards
 */
export const TOKEN_RECEIVER_FALLBACK: ModuleRegistryEntry = createModuleEntry(
  {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.FALLBACK,
    name: 'Token Receiver',
    description: 'Enable receiving ERC721, ERC1155, and other token standards',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['fallback', 'token', 'nft', 'erc721', 'erc1155'],
    docsUrl: 'https://docs.stablenet.io/modules/token-receiver',
  },
  {
    version: '1.0.0',
    fields: [], // No configuration needed
  },
  {
    [SUPPORTED_CHAIN_IDS.MAINNET]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.SEPOLIA]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.LOCAL]: '0x0000000000000000000000000000000000000000' as Address,
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

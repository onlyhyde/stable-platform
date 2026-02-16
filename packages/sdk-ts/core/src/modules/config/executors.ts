/**
 * Executor Module Definitions
 *
 * ERC-7579 Module Type 2: Executors
 * Responsible for executing specific types of operations.
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
// Session Key Executor
// ============================================================================

/**
 * Session Key Executor module definition
 * Temporary keys with limited permissions for dApp sessions
 */
export const SESSION_KEY_EXECUTOR: ModuleRegistryEntry = createModuleEntry(
  {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.EXECUTOR,
    name: 'Session Key',
    description: 'Temporary keys with limited permissions for dApp sessions',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['executor', 'session', 'dapp', 'permissions'],
    docsUrl: 'https://docs.stablenet.io/modules/session-key',
  },
  {
    version: '1.0.0',
    fields: [
      {
        name: 'sessionKey',
        label: 'Session Key Address',
        description: 'Temporary key that can execute transactions',
        type: 'address',
        required: true,
      },
      {
        name: 'allowedTargets',
        label: 'Allowed Targets',
        description: 'Contract addresses the session key can interact with',
        type: 'address[]',
        required: true,
      },
      {
        name: 'allowedSelectors',
        label: 'Allowed Functions',
        description: 'Function selectors that can be called',
        type: 'bytes4[]',
        required: false,
      },
      {
        name: 'maxValuePerTx',
        label: 'Max Value Per Transaction',
        description: 'Maximum ETH value per transaction (in wei)',
        type: 'uint256',
        required: true,
        defaultValue: '0',
      },
      {
        name: 'validUntil',
        label: 'Valid Until',
        description: 'Expiration timestamp',
        type: 'uint64',
        required: true,
      },
      {
        name: 'validAfter',
        label: 'Valid After',
        description: 'Start timestamp',
        type: 'uint64',
        required: true,
        defaultValue: '0',
      },
    ],
  },
  {
    [SUPPORTED_CHAIN_IDS.MAINNET]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.SEPOLIA]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.LOCAL]: '0xa82ff9aFd8f496c3d6ac40e2a0f282E47488CFc9' as Address,
    [SUPPORTED_CHAIN_IDS.STABLENET]: '0x621b0872c00f6328bd9001a121af09dd18b193e0' as Address,
  },
  DEFAULT_SUPPORTED_CHAINS
)

// ============================================================================
// Recurring Payment Executor
// ============================================================================

/**
 * Recurring Payment Executor module definition
 * Automated recurring payments (subscriptions, salary, etc.)
 */
export const RECURRING_PAYMENT_EXECUTOR: ModuleRegistryEntry = createModuleEntry(
  {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.EXECUTOR,
    name: 'Recurring Payment',
    description: 'Automated recurring payments (subscriptions, salary, etc.)',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['executor', 'payment', 'subscription', 'automation'],
    docsUrl: 'https://docs.stablenet.io/modules/recurring-payment',
  },
  {
    version: '1.0.0',
    fields: [
      {
        name: 'recipient',
        label: 'Recipient',
        description: 'Address to receive payments',
        type: 'address',
        required: true,
      },
      {
        name: 'token',
        label: 'Token',
        description: 'Token address (0x0 for native ETH)',
        type: 'address',
        required: true,
        defaultValue: '0x0000000000000000000000000000000000000000',
      },
      {
        name: 'amount',
        label: 'Amount',
        description: 'Payment amount per interval',
        type: 'uint256',
        required: true,
      },
      {
        name: 'interval',
        label: 'Interval',
        description: 'Payment interval in seconds',
        type: 'uint64',
        required: true,
        validation: {
          min: '86400', // 1 day minimum
          message: 'Interval must be at least 1 day (86400 seconds)',
        },
      },
      {
        name: 'maxPayments',
        label: 'Max Payments',
        description: 'Maximum number of payments (0 for unlimited)',
        type: 'uint32',
        required: true,
        defaultValue: '0',
      },
    ],
  },
  {
    [SUPPORTED_CHAIN_IDS.MAINNET]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.SEPOLIA]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.LOCAL]: '0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8' as Address,
    [SUPPORTED_CHAIN_IDS.STABLENET]: '0x3157c4a86d07a223e3b46f20633f5486e96b8f3c' as Address,
  },
  DEFAULT_SUPPORTED_CHAINS
)

// ============================================================================
// All Executors
// ============================================================================

/**
 * All built-in executor modules
 */
export const EXECUTOR_MODULES: ModuleRegistryEntry[] = [
  SESSION_KEY_EXECUTOR,
  RECURRING_PAYMENT_EXECUTOR,
]

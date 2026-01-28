import type { Address, Hex } from 'viem'
import type { PaymentProcessorConfig } from '../types/index.js'
import 'dotenv/config'

/**
 * Load and validate environment configuration
 */
export function loadConfig(): PaymentProcessorConfig {
  const rpcUrl = process.env.RPC_URL || 'http://localhost:8545'
  const chainId = parseInt(process.env.CHAIN_ID || '31337', 10)

  const subscriptionManagerAddress = (process.env.SUBSCRIPTION_MANAGER_ADDRESS ||
    '0x9d4454B023096f34B160D6B654540c56A1F81688') as Address

  const permissionManagerAddress = (process.env.PERMISSION_MANAGER_ADDRESS ||
    '0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf') as Address

  const recurringPaymentExecutorAddress = (process.env.RECURRING_PAYMENT_EXECUTOR_ADDRESS ||
    '0x998abeb3E57409262aE5b751f60747921B33613E') as Address

  const executorPrivateKey = process.env.EXECUTOR_PRIVATE_KEY as Hex

  if (!executorPrivateKey) {
    throw new Error('EXECUTOR_PRIVATE_KEY environment variable is required')
  }

  return {
    rpcUrl,
    chainId,
    subscriptionManagerAddress,
    permissionManagerAddress,
    recurringPaymentExecutorAddress,
    executorPrivateKey,
    pollInterval: parseInt(process.env.POLL_INTERVAL || '60000', 10), // 1 minute default
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || '30000', 10), // 30 seconds default
    batchSize: parseInt(process.env.BATCH_SIZE || '10', 10),
  }
}

/**
 * Contract ABIs for subscription system
 */
export const SUBSCRIPTION_MANAGER_ABI = [
  {
    name: 'planCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'plans',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'planId', type: 'uint256' }],
    outputs: [
      { name: 'merchant', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'price', type: 'uint256' },
      { name: 'interval', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'subscriberCount', type: 'uint256' },
      { name: 'trialPeriod', type: 'uint256' },
      { name: 'gracePeriod', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' },
    ],
  },
  {
    name: 'getSubscription',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'subscriber', type: 'address' },
      { name: 'planId', type: 'uint256' },
    ],
    outputs: [
      { name: 'startTime', type: 'uint256' },
      { name: 'lastPaymentTime', type: 'uint256' },
      { name: 'nextPaymentTime', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'permissionId', type: 'bytes32' },
    ],
  },
  {
    name: 'getAllActiveSubscriptions',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'subscribers', type: 'address[]' },
      { name: 'planIds', type: 'uint256[]' },
    ],
  },
] as const

export const RECURRING_PAYMENT_EXECUTOR_ABI = [
  {
    name: 'executePayment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'subscriber', type: 'address' },
      { name: 'planId', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'batchExecutePayments',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'subscribers', type: 'address[]' },
      { name: 'planIds', type: 'uint256[]' },
    ],
    outputs: [{ name: 'results', type: 'bool[]' }],
  },
  {
    name: 'canExecutePayment',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'subscriber', type: 'address' },
      { name: 'planId', type: 'uint256' },
    ],
    outputs: [
      { name: 'canExecute', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
  },
] as const

export const PERMISSION_MANAGER_ABI = [
  {
    name: 'hasValidPermission',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'permissionId', type: 'bytes32' },
    ],
    outputs: [{ name: 'valid', type: 'bool' }],
  },
  {
    name: 'getPermission',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'permissionId', type: 'bytes32' }],
    outputs: [
      { name: 'account', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'allowance', type: 'uint256' },
      { name: 'period', type: 'uint256' },
      { name: 'start', type: 'uint256' },
      { name: 'end', type: 'uint256' },
      { name: 'isRevoked', type: 'bool' },
    ],
  },
] as const

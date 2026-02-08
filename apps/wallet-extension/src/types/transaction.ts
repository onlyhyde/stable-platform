import type { Address, Hex } from 'viem'

/**
 * Transaction types
 */

export type TransactionStatus = 'pending' | 'submitted' | 'confirmed' | 'failed' | 'cancelled'

export type TransactionType = 'send' | 'receive' | 'swap' | 'approve' | 'contract' | 'userOp'

export interface PendingTransaction {
  id: string
  from: Address
  to: Address
  value: bigint
  data?: Hex
  chainId: number
  status: TransactionStatus
  type: TransactionType
  userOpHash?: Hex
  txHash?: Hex
  timestamp: number
  // Gas info
  gasUsed?: bigint
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  // Decoded info
  methodName?: string
  tokenTransfer?: TokenTransferInfo
  // Receipt info
  blockNumber?: bigint
  // Error info
  error?: string
}

export interface TokenTransferInfo {
  tokenAddress: Address
  symbol: string
  decimals: number
  amount: bigint
  direction: 'in' | 'out'
}

export interface TransactionState {
  pendingTransactions: PendingTransaction[]
  history: PendingTransaction[]
}

/**
 * Transaction request (from dApp)
 */
export interface TransactionRequest {
  from: Address
  to?: Address
  value?: bigint
  data?: Hex
  gas?: bigint
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  nonce?: number
}

/**
 * Estimated gas costs
 */
export interface GasEstimate {
  gasLimit: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  estimatedCost: bigint
  estimatedCostUsd?: number
}

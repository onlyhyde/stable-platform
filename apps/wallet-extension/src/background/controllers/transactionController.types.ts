/**
 * TransactionController Types
 * Manages transaction lifecycle and state
 */

import type { Address, Hex } from 'viem'

/**
 * Transaction status enum
 */
export type TransactionStatus =
  | 'unapproved'
  | 'approved'
  | 'signed'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'rejected'

/**
 * Transaction type
 */
export type TransactionType =
  | 'standard'
  | 'contractInteraction'
  | 'contractDeployment'
  | 'tokenTransfer'
  | 'tokenApproval'

/**
 * Gas fee estimates
 */
export interface GasFeeEstimates {
  gasLimit: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  gasPrice?: bigint
  estimatedBaseFee?: bigint
}

/**
 * Transaction parameters from dApp
 */
export interface TransactionParams {
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
 * Transaction metadata
 */
export interface TransactionMeta {
  id: string
  chainId: number
  status: TransactionStatus
  type: TransactionType
  time: number
  origin: string
  txParams: TransactionParams
  hash?: Hex
  rawTx?: Hex
  blockNumber?: number
  blockHash?: Hex
  gasUsed?: bigint
  effectiveGasPrice?: bigint
  error?: {
    message: string
    code?: number
  }
  gasFeeEstimates?: GasFeeEstimates
  simulationFails?: boolean
  submittedTime?: number
  confirmedTime?: number
}

/**
 * Transaction controller state
 */
export interface TransactionControllerState {
  transactions: Record<string, TransactionMeta>
  pendingTransactions: string[]
  confirmedTransactions: string[]
}

/**
 * Transaction controller events
 */
export type TransactionControllerEvent =
  | { type: 'transaction:added'; transaction: TransactionMeta }
  | { type: 'transaction:updated'; transaction: TransactionMeta }
  | { type: 'transaction:approved'; transaction: TransactionMeta }
  | { type: 'transaction:rejected'; transaction: TransactionMeta }
  | { type: 'transaction:signed'; transaction: TransactionMeta }
  | { type: 'transaction:submitted'; transaction: TransactionMeta }
  | { type: 'transaction:confirmed'; transaction: TransactionMeta }
  | { type: 'transaction:failed'; transaction: TransactionMeta }

/**
 * Transaction controller options
 */
export interface TransactionControllerOptions {
  chainId: number
  getSelectedAddress: () => Address | null
  signTransaction: (address: Address, tx: TransactionParams) => Promise<Hex>
  publishTransaction: (rawTx: Hex) => Promise<Hex>
  getTransactionCount: (address: Address) => Promise<number>
  estimateGas: (tx: TransactionParams) => Promise<bigint>
  getGasPrice: () => Promise<bigint>
}

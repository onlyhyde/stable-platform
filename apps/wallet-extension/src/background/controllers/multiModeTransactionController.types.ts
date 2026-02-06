/**
 * MultiModeTransactionController Types
 * Extends base transaction types with multi-mode support (EOA, EIP-7702, SmartAccount)
 */

import type { Account, GasEstimate, GasPaymentConfig, TransactionMode } from '@stablenet/core'
import type { Address, Hex } from 'viem'
import type {
  TransactionParams as BaseTransactionParams,
  TransactionStatus,
  TransactionType,
} from './transactionController.types'

/**
 * Extended transaction parameters with multi-mode support
 */
export interface MultiModeTransactionParams extends BaseTransactionParams {
  /** Transaction mode (eoa, eip7702, smartAccount) */
  mode?: TransactionMode

  /** Gas payment configuration */
  gasPayment?: GasPaymentConfig

  /** Smart Account specific: calls for batched transactions */
  calls?: Array<{
    to: Address
    value?: bigint
    data?: Hex
  }>

  /** EIP-7702 specific: delegation target */
  delegateTo?: Address
}

/**
 * Extended transaction metadata with multi-mode info
 */
export interface MultiModeTransactionMeta {
  id: string
  chainId: number
  status: TransactionStatus
  type: TransactionType
  mode: TransactionMode
  time: number
  origin: string
  txParams: MultiModeTransactionParams

  // Transaction identifiers
  hash?: Hex
  userOpHash?: Hex // For Smart Account mode
  rawTx?: Hex

  // Confirmation details
  blockNumber?: number
  blockHash?: Hex
  gasUsed?: bigint
  effectiveGasPrice?: bigint

  // Gas estimation
  gasEstimate?: GasEstimate

  // Error handling
  error?: {
    message: string
    code?: number
  }

  // Timestamps
  submittedTime?: number
  confirmedTime?: number

  // Smart Account specific
  userOperationReceipt?: {
    success: boolean
    actualGasUsed: bigint
    actualGasCost: bigint
  }

  // EIP-7702 specific
  authorizationHash?: Hex
  delegationStatus?: 'pending' | 'active' | 'revoked'
}

/**
 * Multi-mode transaction controller state
 */
export interface MultiModeTransactionControllerState {
  transactions: Record<string, MultiModeTransactionMeta>
  pendingTransactions: string[]
  confirmedTransactions: string[]
}

/**
 * Multi-mode transaction controller events
 */
export type MultiModeTransactionEvent =
  | { type: 'transaction:added'; transaction: MultiModeTransactionMeta }
  | { type: 'transaction:updated'; transaction: MultiModeTransactionMeta }
  | { type: 'transaction:approved'; transaction: MultiModeTransactionMeta }
  | { type: 'transaction:rejected'; transaction: MultiModeTransactionMeta }
  | { type: 'transaction:signed'; transaction: MultiModeTransactionMeta }
  | { type: 'transaction:submitted'; transaction: MultiModeTransactionMeta }
  | { type: 'transaction:confirmed'; transaction: MultiModeTransactionMeta }
  | { type: 'transaction:failed'; transaction: MultiModeTransactionMeta }
  | {
      type: 'transaction:modeChanged'
      transaction: MultiModeTransactionMeta
      previousMode: TransactionMode
    }

/**
 * Account info for transaction processing
 */
export interface TransactionAccountInfo {
  address: Address
  type: Account['type']
  smartAccountAddress?: Address
  isDelegated?: boolean
  delegateTo?: Address
}

/**
 * Multi-mode transaction controller options
 */
export interface MultiModeTransactionControllerOptions {
  chainId: number
  rpcUrl: string
  bundlerUrl?: string
  paymasterUrl?: string
  entryPointAddress?: Address

  // Account functions
  getSelectedAccount: () => TransactionAccountInfo | null

  // Signing functions
  signTransaction: (address: Address, tx: MultiModeTransactionParams) => Promise<Hex>
  signUserOperation: (address: Address, userOpHash: Hex) => Promise<Hex>
  signAuthorization: (address: Address, authHash: Hex) => Promise<{ r: Hex; s: Hex; v: number }>

  // Publishing functions
  publishTransaction: (rawTx: Hex) => Promise<Hex>
}

/**
 * Prepared transaction ready for signing
 */
export interface PreparedMultiModeTransaction {
  id: string
  mode: TransactionMode
  gasEstimate: GasEstimate

  // Mode-specific data
  rawTransaction?: {
    to: Address
    value: bigint
    data: Hex
    nonce: number
    gasLimit: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
  }

  userOperation?: {
    sender: Address
    nonce: bigint
    callData: Hex
    callGasLimit: bigint
    verificationGasLimit: bigint
    preVerificationGas: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
    paymaster?: Address
    paymasterData?: Hex
  }

  authorization?: {
    chainId: bigint
    address: Address
    nonce: bigint
    authorizationHash: Hex
  }
}

/**
 * Mode comparison result for UI
 */
export interface ModeComparisonResult {
  mode: TransactionMode
  available: boolean
  estimate: GasEstimate | null
  savings?: {
    vsEOA: bigint
    percentage: number
  }
  features: string[]
}

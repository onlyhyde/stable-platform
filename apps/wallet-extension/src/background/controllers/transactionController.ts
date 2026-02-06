/**
 * TransactionController
 * Manages transaction lifecycle: unapproved → approved → signed → submitted → confirmed
 */

import type { Hex } from 'viem'
import type {
  GasFeeEstimates,
  TransactionControllerOptions,
  TransactionControllerState,
  TransactionMeta,
  TransactionParams,
  TransactionStatus,
  TransactionType,
} from './transactionController.types'

type TransactionEventType =
  | 'transaction:added'
  | 'transaction:updated'
  | 'transaction:approved'
  | 'transaction:rejected'
  | 'transaction:signed'
  | 'transaction:submitted'
  | 'transaction:confirmed'
  | 'transaction:failed'

type EventHandler = (transaction: TransactionMeta) => void

interface ConfirmationReceipt {
  blockNumber: number
  blockHash: Hex
  gasUsed: bigint
  effectiveGasPrice?: bigint
}

export class TransactionController {
  private state: TransactionControllerState
  private options: TransactionControllerOptions
  private eventHandlers: Map<TransactionEventType, Set<EventHandler>>

  constructor(options: TransactionControllerOptions) {
    this.options = options
    this.state = {
      transactions: {},
      pendingTransactions: [],
      confirmedTransactions: [],
    }
    this.eventHandlers = new Map()
  }

  /**
   * Add a new transaction to the controller
   */
  async addTransaction(txParams: TransactionParams, origin: string): Promise<TransactionMeta> {
    const id = this.generateId()
    const type = this.detectTransactionType(txParams)
    const gasFeeEstimates = await this.estimateGasFees(txParams)

    const txMeta: TransactionMeta = {
      id,
      chainId: this.options.chainId,
      status: 'unapproved',
      type,
      time: Date.now(),
      origin,
      txParams,
      gasFeeEstimates,
    }

    this.state.transactions[id] = txMeta
    this.state.pendingTransactions.push(id)

    this.emit('transaction:added', txMeta)

    return txMeta
  }

  /**
   * Approve a transaction for signing
   */
  async approveTransaction(id: string): Promise<void> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    if (txMeta.status !== 'unapproved') {
      throw new Error(`Cannot approve transaction with status: ${txMeta.status}`)
    }

    const updated: TransactionMeta = {
      ...txMeta,
      status: 'approved',
    }

    this.updateTransaction(updated)
    this.emit('transaction:approved', updated)
  }

  /**
   * Reject a transaction
   */
  async rejectTransaction(id: string): Promise<void> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    const updated: TransactionMeta = {
      ...txMeta,
      status: 'rejected',
    }

    this.updateTransaction(updated)
    this.removeFromPending(id)
    this.emit('transaction:rejected', updated)
  }

  /**
   * Sign an approved transaction
   */
  async signTransaction(id: string): Promise<void> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    if (txMeta.status !== 'approved') {
      throw new Error('Transaction must be approved before signing')
    }

    try {
      const rawTx = await this.options.signTransaction(txMeta.txParams.from, txMeta.txParams)

      const updated: TransactionMeta = {
        ...txMeta,
        status: 'signed',
        rawTx,
      }

      this.updateTransaction(updated)
      this.emit('transaction:signed', updated)
    } catch (error) {
      const failed: TransactionMeta = {
        ...txMeta,
        status: 'failed',
        error: {
          message: error instanceof Error ? error.message : 'Signing failed',
        },
      }
      this.updateTransaction(failed)
      this.emit('transaction:failed', failed)
      throw error
    }
  }

  /**
   * Submit a signed transaction to the network
   */
  async submitTransaction(id: string): Promise<void> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    if (txMeta.status !== 'signed' || !txMeta.rawTx) {
      throw new Error('Transaction must be signed before submitting')
    }

    try {
      const hash = await this.options.publishTransaction(txMeta.rawTx)

      const updated: TransactionMeta = {
        ...txMeta,
        status: 'submitted',
        hash,
        submittedTime: Date.now(),
      }

      this.updateTransaction(updated)
      this.emit('transaction:submitted', updated)
    } catch (error) {
      const failed: TransactionMeta = {
        ...txMeta,
        status: 'failed',
        error: {
          message: error instanceof Error ? error.message : 'Broadcast failed',
        },
      }
      this.updateTransaction(failed)
      this.emit('transaction:failed', failed)
      throw error
    }
  }

  /**
   * Confirm a submitted transaction
   */
  async confirmTransaction(id: string, receipt: ConfirmationReceipt): Promise<void> {
    const txMeta = this.getTransaction(id)
    if (!txMeta) {
      throw new Error('Transaction not found')
    }

    const updated: TransactionMeta = {
      ...txMeta,
      status: 'confirmed',
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      confirmedTime: Date.now(),
    }

    this.updateTransaction(updated)
    this.removeFromPending(id)
    this.state.confirmedTransactions.push(id)
    this.emit('transaction:confirmed', updated)
  }

  /**
   * Process a transaction through the full lifecycle (approve → sign → submit)
   */
  async processTransaction(id: string): Promise<Hex> {
    await this.approveTransaction(id)
    await this.signTransaction(id)
    await this.submitTransaction(id)

    const txMeta = this.getTransaction(id)
    if (!txMeta?.hash) {
      throw new Error('Transaction hash not found after submission')
    }

    return txMeta.hash
  }

  /**
   * Get a transaction by ID
   */
  getTransaction(id: string): TransactionMeta | undefined {
    return this.state.transactions[id]
  }

  /**
   * Get transactions filtered by status
   */
  getTransactionsByStatus(status: TransactionStatus): TransactionMeta[] {
    return Object.values(this.state.transactions).filter((tx) => tx.status === status)
  }

  /**
   * Get transactions filtered by origin
   */
  getTransactionsForOrigin(origin: string): TransactionMeta[] {
    return Object.values(this.state.transactions).filter((tx) => tx.origin === origin)
  }

  /**
   * Clear all unapproved transactions by rejecting them
   */
  async clearUnapprovedTransactions(): Promise<void> {
    const unapproved = this.getTransactionsByStatus('unapproved')
    for (const tx of unapproved) {
      await this.rejectTransaction(tx.id)
    }
  }

  /**
   * Get the current state
   */
  getState(): TransactionControllerState {
    return { ...this.state }
  }

  /**
   * Subscribe to transaction events
   */
  on(event: TransactionEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  /**
   * Unsubscribe from transaction events
   */
  off(event: TransactionEventType, handler: EventHandler): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  // Private methods

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  private detectTransactionType(txParams: TransactionParams): TransactionType {
    // Contract deployment: no 'to' address with data
    if (!txParams.to && txParams.data) {
      return 'contractDeployment'
    }

    // Contract interaction: has data
    if (txParams.data && txParams.data !== '0x') {
      return 'contractInteraction'
    }

    return 'standard'
  }

  private async estimateGasFees(txParams: TransactionParams): Promise<GasFeeEstimates> {
    const gasLimit = txParams.gas ?? (await this.options.estimateGas(txParams))
    const gasPrice = await this.options.getGasPrice()

    return {
      gasLimit,
      gasPrice,
    }
  }

  private updateTransaction(txMeta: TransactionMeta): void {
    this.state.transactions[txMeta.id] = txMeta
    this.emit('transaction:updated', txMeta)
  }

  private removeFromPending(id: string): void {
    const index = this.state.pendingTransactions.indexOf(id)
    if (index > -1) {
      this.state.pendingTransactions.splice(index, 1)
    }
  }

  private emit(event: TransactionEventType, transaction: TransactionMeta): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(transaction)
      }
    }
  }
}

import type { Address, Hex } from 'viem'
import type { MempoolEntry, UserOperation } from '../types'
import type { Logger } from '../utils/logger'

/**
 * In-memory UserOperation mempool
 */
export class Mempool {
  private pool: Map<Hex, MempoolEntry> = new Map()
  private bySender: Map<Address, Set<Hex>> = new Map()
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger.child({ module: 'mempool' })
  }

  /**
   * Add a UserOperation to the mempool
   */
  add(
    userOp: UserOperation,
    userOpHash: Hex,
    entryPoint: Address
  ): MempoolEntry {
    // Check if already exists
    if (this.pool.has(userOpHash)) {
      throw new Error(`UserOperation ${userOpHash} already in mempool`)
    }

    const entry: MempoolEntry = {
      userOp,
      userOpHash,
      entryPoint,
      status: 'pending',
      addedAt: Date.now(),
    }

    this.pool.set(userOpHash, entry)

    // Track by sender
    if (!this.bySender.has(userOp.sender)) {
      this.bySender.set(userOp.sender, new Set())
    }
    this.bySender.get(userOp.sender)!.add(userOpHash)

    this.logger.debug(
      { userOpHash, sender: userOp.sender },
      'Added UserOperation to mempool'
    )

    return entry
  }

  /**
   * Get a UserOperation by hash
   */
  get(userOpHash: Hex): MempoolEntry | undefined {
    return this.pool.get(userOpHash)
  }

  /**
   * Get all pending UserOperations for an entry point
   */
  getPending(entryPoint: Address, maxCount?: number): MempoolEntry[] {
    const pending: MempoolEntry[] = []

    for (const entry of this.pool.values()) {
      if (entry.entryPoint === entryPoint && entry.status === 'pending') {
        pending.push(entry)
        if (maxCount && pending.length >= maxCount) {
          break
        }
      }
    }

    // Sort by gas price (higher first)
    pending.sort((a, b) => {
      const aPrice = a.userOp.maxFeePerGas
      const bPrice = b.userOp.maxFeePerGas
      return bPrice > aPrice ? 1 : bPrice < aPrice ? -1 : 0
    })

    return pending
  }

  /**
   * Get UserOperations by sender
   */
  getBySender(sender: Address): MempoolEntry[] {
    const hashes = this.bySender.get(sender)
    if (!hashes) return []

    return Array.from(hashes)
      .map((hash) => this.pool.get(hash))
      .filter((entry): entry is MempoolEntry => entry !== undefined)
  }

  /**
   * Update UserOperation status
   */
  updateStatus(
    userOpHash: Hex,
    status: MempoolEntry['status'],
    transactionHash?: Hex,
    blockNumber?: bigint,
    error?: string
  ): boolean {
    const entry = this.pool.get(userOpHash)
    if (!entry) return false

    entry.status = status
    if (transactionHash) {
      entry.transactionHash = transactionHash
      entry.submittedAt = Date.now()
    }
    if (blockNumber) {
      entry.blockNumber = blockNumber
    }
    if (error) {
      entry.error = error
    }

    this.logger.debug(
      { userOpHash, status, transactionHash },
      'Updated UserOperation status'
    )

    return true
  }

  /**
   * Remove a UserOperation from the mempool
   */
  remove(userOpHash: Hex): boolean {
    const entry = this.pool.get(userOpHash)
    if (!entry) return false

    this.pool.delete(userOpHash)

    // Remove from sender index
    const senderHashes = this.bySender.get(entry.userOp.sender)
    if (senderHashes) {
      senderHashes.delete(userOpHash)
      if (senderHashes.size === 0) {
        this.bySender.delete(entry.userOp.sender)
      }
    }

    this.logger.debug({ userOpHash }, 'Removed UserOperation from mempool')

    return true
  }

  /**
   * Clear all UserOperations
   */
  clear(): void {
    this.pool.clear()
    this.bySender.clear()
    this.logger.info('Cleared mempool')
  }

  /**
   * Get mempool size
   */
  get size(): number {
    return this.pool.size
  }

  /**
   * Get pending count
   */
  get pendingCount(): number {
    let count = 0
    for (const entry of this.pool.values()) {
      if (entry.status === 'pending') count++
    }
    return count
  }

  /**
   * Dump all entries (for debugging)
   */
  dump(): MempoolEntry[] {
    return Array.from(this.pool.values())
  }
}

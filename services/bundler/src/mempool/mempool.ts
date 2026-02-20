import type { Address, Hex } from 'viem'
import type { MempoolEntry, UserOperation } from '../types'
import type { Logger } from '../utils/logger'

/**
 * Priority strategy for bundle ordering
 */
export type PriorityStrategy =
  | 'gas_price' // Sort by maxFeePerGas (default)
  | 'priority_fee' // Sort by maxPriorityFeePerGas
  | 'profit' // Sort by estimated profit (gas * priorityFee)
  | 'fifo' // First-in-first-out
  | 'age_weighted' // Gas price boosted by age

/**
 * Mempool configuration
 */
export interface MempoolConfig {
  /** Maximum number of UserOperations in mempool (default: 10000) */
  maxSize?: number
  /** Maximum UserOperations per sender (default: 4) */
  maxOpsPerSender?: number
  /** Time-to-live for pending operations in ms (default: 30 minutes) */
  ttlMs?: number
  /** Minimum gas price increase for replacement in percent (default: 10) */
  minGasPriceIncrease?: number
  /** Interval for automatic eviction in ms (default: 60000) */
  evictionIntervalMs?: number
  /** Enable nonce continuity validation (default: false for backward compatibility) */
  validateNonceContinuity?: boolean
  /** Maximum allowed gap between nonces (default: 0 = no gaps) */
  maxNonceGap?: number
  /** Priority strategy for bundle ordering (default: 'gas_price') */
  priorityStrategy?: PriorityStrategy
  /** Age weight factor for age_weighted strategy (wei boost per second) */
  ageWeightFactor?: number
  /** Maximum age boost in ms for age_weighted strategy (default: unlimited) */
  maxAgeBoostMs?: number
}

/**
 * Get default mempool configuration from environment or defaults
 * Import from config module for environment-aware configuration
 */
import { getMempoolConfig } from '../config/constants'

/**
 * Default mempool configuration (configurable via environment variables)
 *
 * Environment variables:
 * - BUNDLER_MEMPOOL_MAX_SIZE: Max UserOps in mempool (default: 10000)
 * - BUNDLER_MEMPOOL_MAX_OPS_PER_SENDER: Max pending ops per sender (default: 4)
 * - BUNDLER_MEMPOOL_TTL_MS: TTL for pending ops in ms (default: 1800000 = 30 min)
 * - BUNDLER_MEMPOOL_MIN_GAS_PRICE_INCREASE: Min gas price increase % for replacement (default: 10)
 * - BUNDLER_MEMPOOL_EVICTION_INTERVAL_MS: Eviction interval in ms (default: 60000)
 * - BUNDLER_MEMPOOL_VALIDATE_NONCE_CONTINUITY: Enable nonce continuity validation (default: false)
 * - BUNDLER_MEMPOOL_MAX_NONCE_GAP: Max allowed nonce gap (default: 0)
 * - BUNDLER_MEMPOOL_PRIORITY_STRATEGY: Priority strategy (default: gas_price)
 * - BUNDLER_MEMPOOL_AGE_WEIGHT_FACTOR: Age weight factor (default: 0)
 * - BUNDLER_MEMPOOL_MAX_AGE_BOOST_MS: Max age boost in ms (default: 0)
 */
const DEFAULT_CONFIG: Required<MempoolConfig> = getMempoolConfig()

/**
 * In-memory UserOperation mempool with eviction policies
 */
export class Mempool {
  private pool: Map<Hex, MempoolEntry> = new Map()
  private bySender: Map<Address, Set<Hex>> = new Map()
  private noncesBySender: Map<Address, Set<bigint>> = new Map()
  private logger: Logger
  private config: Required<MempoolConfig>
  private evictionTimer: ReturnType<typeof setInterval> | null = null

  constructor(logger: Logger, config: MempoolConfig = {}) {
    this.logger = logger.child({ module: 'mempool' })
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Add a UserOperation to the mempool
   */
  add(userOp: UserOperation, userOpHash: Hex, entryPoint: Address): MempoolEntry {
    // Return existing entry if already in mempool (idempotent)
    const existing = this.pool.get(userOpHash)
    if (existing) {
      this.logger.debug({ userOpHash }, 'UserOperation already in mempool, returning existing entry')
      return existing
    }

    // Check sender limits
    const senderOps = this.bySender.get(userOp.sender)
    const senderPendingCount = senderOps ? this.countPendingForSender(userOp.sender) : 0

    if (senderPendingCount >= this.config.maxOpsPerSender) {
      throw new Error('sender has too many pending operations')
    }

    // Validate nonce continuity if enabled
    if (this.config.validateNonceContinuity) {
      this.validateNonce(userOp.sender, userOp.nonce)
    }

    // Check max size and evict if necessary
    if (this.pool.size >= this.config.maxSize) {
      const evicted = this.evictLowestGasPrice(userOp.maxFeePerGas)
      if (!evicted) {
        throw new Error('mempool full: new operation has too low gas price')
      }
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

    // Track nonce
    if (!this.noncesBySender.has(userOp.sender)) {
      this.noncesBySender.set(userOp.sender, new Set())
    }
    this.noncesBySender.get(userOp.sender)!.add(userOp.nonce)

    this.logger.debug({ userOpHash, sender: userOp.sender }, 'Added UserOperation to mempool')

    return entry
  }

  /**
   * Replace an existing UserOperation
   * @returns true if replacement was successful
   */
  replace(existingHash: Hex, newUserOp: UserOperation, _newHash: Hex): boolean {
    const existing = this.pool.get(existingHash)
    if (!existing) {
      return false
    }

    // Check gas price increase requirement
    const minNewGasPrice =
      (existing.userOp.maxFeePerGas * (100n + BigInt(this.config.minGasPriceIncrease))) / 100n

    if (newUserOp.maxFeePerGas < minNewGasPrice) {
      this.logger.debug(
        {
          existingGas: existing.userOp.maxFeePerGas.toString(),
          newGas: newUserOp.maxFeePerGas.toString(),
          required: minNewGasPrice.toString(),
        },
        'Replacement rejected: gas price increase too low'
      )
      return false
    }

    // Update the entry
    existing.userOp = newUserOp
    existing.addedAt = Date.now()

    this.logger.debug(
      { hash: existingHash, newGas: newUserOp.maxFeePerGas.toString() },
      'Replaced UserOperation'
    )

    return true
  }

  /**
   * Get a UserOperation by hash
   */
  get(userOpHash: Hex): MempoolEntry | undefined {
    return this.pool.get(userOpHash)
  }

  /**
   * Set the aggregator for a UserOperation
   * Called when simulation reveals the account uses an aggregator
   */
  setAggregator(userOpHash: Hex, aggregator: Address): boolean {
    const entry = this.pool.get(userOpHash)
    if (!entry) {
      this.logger.warn({ userOpHash }, 'Cannot set aggregator: entry not found')
      return false
    }

    const updatedEntry: MempoolEntry = {
      ...entry,
      aggregator,
    }
    this.pool.set(userOpHash, updatedEntry)

    this.logger.debug({ userOpHash, aggregator }, 'Set aggregator for UserOperation')
    return true
  }

  /**
   * Get all pending UserOperations for an entry point
   * Sorted by configured priority strategy
   */
  getPending(entryPoint: Address, maxCount?: number): MempoolEntry[] {
    const pending: MempoolEntry[] = []

    for (const entry of this.pool.values()) {
      if (entry.entryPoint === entryPoint && entry.status === 'pending') {
        pending.push(entry)
      }
    }

    // Sort by configured priority strategy
    this.sortByPriority(pending)

    if (maxCount) {
      return pending.slice(0, maxCount)
    }

    return pending
  }

  /**
   * Get pending UserOperations for bundle creation
   * Ensures same-sender operations are ordered by nonce
   */
  getPendingForBundle(entryPoint: Address, maxCount?: number): MempoolEntry[] {
    const pending = this.getPending(entryPoint)

    // Group by sender
    const bySender = new Map<Address, MempoolEntry[]>()
    for (const entry of pending) {
      const sender = entry.userOp.sender
      if (!bySender.has(sender)) {
        bySender.set(sender, [])
      }
      bySender.get(sender)!.push(entry)
    }

    // Sort each sender's ops by nonce and filter invalid sequences
    const validOps: MempoolEntry[] = []
    for (const [_sender, ops] of bySender.entries()) {
      // Sort by nonce
      ops.sort((a, b) => {
        const aNonce = a.userOp.nonce
        const bNonce = b.userOp.nonce
        return aNonce > bNonce ? 1 : aNonce < bNonce ? -1 : 0
      })

      // Only include consecutive nonce sequences starting from the minimum
      // (In production, we'd check against on-chain nonce)
      if (ops.length === 0) continue

      const minNonce = ops[0]!.userOp.nonce
      let expectedNonce = minNonce
      for (const op of ops) {
        if (op.userOp.nonce === expectedNonce) {
          validOps.push(op)
          expectedNonce++
        } else {
          // Gap in nonce sequence, stop including this sender's ops
          break
        }
      }
    }

    // Re-sort by priority while maintaining nonce order within sender
    // Group valid ops by sender again for proper ordering
    const validBySender = new Map<Address, MempoolEntry[]>()
    for (const entry of validOps) {
      const sender = entry.userOp.sender
      if (!validBySender.has(sender)) {
        validBySender.set(sender, [])
      }
      validBySender.get(sender)!.push(entry)
    }

    // Calculate sender priority (based on first op's priority)
    const senderPriority: Array<{ sender: Address; priority: bigint; ops: MempoolEntry[] }> = []
    for (const [sender, ops] of validBySender.entries()) {
      if (ops.length === 0) continue
      const firstOp = ops[0]!
      const priority = this.calculatePriority(firstOp)
      senderPriority.push({ sender, priority, ops })
    }

    // Sort senders by priority (descending)
    senderPriority.sort((a, b) => {
      return b.priority > a.priority ? 1 : b.priority < a.priority ? -1 : 0
    })

    // Flatten to final result
    const result: MempoolEntry[] = []
    for (const { ops } of senderPriority) {
      result.push(...ops)
    }

    if (maxCount) {
      return result.slice(0, maxCount)
    }

    return result
  }

  /**
   * Sort entries by configured priority strategy
   */
  private sortByPriority(entries: MempoolEntry[]): void {
    const now = Date.now()

    entries.sort((a, b) => {
      const aPriority = this.calculatePriorityWithTime(a, now)
      const bPriority = this.calculatePriorityWithTime(b, now)
      return bPriority > aPriority ? 1 : bPriority < aPriority ? -1 : 0
    })
  }

  /**
   * Calculate priority for an entry (used for sender ordering)
   */
  private calculatePriority(entry: MempoolEntry): bigint {
    return this.calculatePriorityWithTime(entry, Date.now())
  }

  /**
   * Calculate priority with time consideration
   */
  private calculatePriorityWithTime(entry: MempoolEntry, now: number): bigint {
    const { priorityStrategy, ageWeightFactor, maxAgeBoostMs } = this.config

    switch (priorityStrategy) {
      case 'priority_fee':
        return entry.userOp.maxPriorityFeePerGas

      case 'profit': {
        // Estimated total gas
        const totalGas =
          entry.userOp.callGasLimit +
          entry.userOp.verificationGasLimit +
          entry.userOp.preVerificationGas
        return totalGas * entry.userOp.maxPriorityFeePerGas
      }

      case 'fifo':
        // Invert addedAt so older entries have higher priority
        // Use a large number minus addedAt
        return BigInt(Number.MAX_SAFE_INTEGER) - BigInt(entry.addedAt)

      case 'age_weighted': {
        let ageMs = now - entry.addedAt
        // Apply max age cap if configured
        if (maxAgeBoostMs > 0 && ageMs > maxAgeBoostMs) {
          ageMs = maxAgeBoostMs
        }
        const ageSeconds = Math.floor(ageMs / 1000)
        const ageBoost = BigInt(ageSeconds * ageWeightFactor)
        return entry.userOp.maxFeePerGas + ageBoost
      }

      default:
        return entry.userOp.maxFeePerGas
    }
  }

  /**
   * Get UserOperations by sender (sorted by nonce)
   */
  getBySender(sender: Address): MempoolEntry[] {
    const hashes = this.bySender.get(sender)
    if (!hashes) return []

    const entries = Array.from(hashes)
      .map((hash) => this.pool.get(hash))
      .filter((entry): entry is MempoolEntry => entry !== undefined)

    // Sort by nonce
    entries.sort((a, b) => {
      const aNonce = a.userOp.nonce
      const bNonce = b.userOp.nonce
      return aNonce > bNonce ? 1 : aNonce < bNonce ? -1 : 0
    })

    return entries
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

    this.logger.debug({ userOpHash, status, transactionHash }, 'Updated UserOperation status')

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

    // Remove from nonce index
    const senderNonces = this.noncesBySender.get(entry.userOp.sender)
    if (senderNonces) {
      senderNonces.delete(entry.userOp.nonce)
      if (senderNonces.size === 0) {
        this.noncesBySender.delete(entry.userOp.sender)
      }
    }

    this.logger.debug({ userOpHash }, 'Removed UserOperation from mempool')

    return true
  }

  /**
   * Evict expired pending entries
   */
  evictExpired(): number {
    const now = Date.now()
    const toEvict: Hex[] = []

    for (const [hash, entry] of this.pool.entries()) {
      // Only evict pending entries
      if (entry.status !== 'pending') {
        continue
      }

      const age = now - entry.addedAt
      if (age > this.config.ttlMs) {
        toEvict.push(hash)
      }
    }

    for (const hash of toEvict) {
      this.remove(hash)
    }

    if (toEvict.length > 0) {
      this.logger.info({ count: toEvict.length }, 'Evicted expired entries')
    }

    return toEvict.length
  }

  /**
   * Start automatic eviction timer
   */
  startAutoEviction(): void {
    if (this.evictionTimer) {
      return // Already running
    }

    this.evictionTimer = setInterval(() => {
      this.evictExpired()
    }, this.config.evictionIntervalMs)

    this.logger.debug({ intervalMs: this.config.evictionIntervalMs }, 'Started auto eviction')
  }

  /**
   * Stop automatic eviction timer
   */
  stopAutoEviction(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer)
      this.evictionTimer = null
      this.logger.debug('Stopped auto eviction')
    }
  }

  /**
   * Clear all UserOperations
   */
  clear(): void {
    this.pool.clear()
    this.bySender.clear()
    this.noncesBySender.clear()
    this.logger.info('Cleared mempool')
  }

  /**
   * Get mempool size
   */
  get size(): number {
    return this.pool.size
  }

  /**
   * Get unique sender count (diagnostic)
   */
  get senderCount(): number {
    return this.bySender.size
  }

  /**
   * Get total nonce entry count across all senders (diagnostic)
   */
  get nonceEntryCount(): number {
    let total = 0
    for (const nonces of this.noncesBySender.values()) {
      total += nonces.size
    }
    return total
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

  /**
   * Get current configuration
   */
  getConfig(): Required<MempoolConfig> {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MempoolConfig>): void {
    this.config = { ...this.config, ...config }
    this.logger.info({ config: this.config }, 'Updated mempool config')
  }

  /**
   * Get the next expected nonce for a sender
   * @returns The next sequential nonce, or undefined if sender has no operations
   */
  getNextExpectedNonce(sender: Address): bigint | undefined {
    const nonces = this.noncesBySender.get(sender)
    if (!nonces || nonces.size === 0) {
      return undefined
    }

    // Find the maximum nonce
    let maxNonce = 0n
    for (const n of nonces) {
      if (n > maxNonce) maxNonce = n
    }

    return maxNonce + 1n
  }

  /**
   * Count pending operations for a sender
   */
  private countPendingForSender(sender: Address): number {
    const hashes = this.bySender.get(sender)
    if (!hashes) return 0

    let count = 0
    for (const hash of hashes) {
      const entry = this.pool.get(hash)
      if (entry && entry.status === 'pending') {
        count++
      }
    }
    return count
  }

  /**
   * Validate nonce continuity for a sender
   * @throws Error if nonce is invalid (duplicate or gap too large)
   */
  private validateNonce(sender: Address, nonce: bigint): void {
    const existingNonces = this.noncesBySender.get(sender)

    // If no existing operations from this sender, first operation is always valid
    if (!existingNonces || existingNonces.size === 0) {
      return
    }

    // Check for duplicate nonce
    if (existingNonces.has(nonce)) {
      throw new Error('nonce already exists in mempool for this sender')
    }

    // Calculate the maximum and minimum existing nonces
    let minNonce = BigInt(Number.MAX_SAFE_INTEGER)
    let maxNonce = 0n

    for (const n of existingNonces) {
      if (n < minNonce) minNonce = n
      if (n > maxNonce) maxNonce = n
    }

    // Check if the new nonce creates a gap that's too large
    // New nonce must be within maxNonceGap from existing nonces (above or below)
    const gapFromMax = nonce > maxNonce ? nonce - maxNonce - 1n : 0n
    const gapFromMin = nonce < minNonce ? minNonce - nonce - 1n : 0n

    // If nonce is within existing range, check if it fills a gap (always allowed)
    if (nonce > minNonce && nonce < maxNonce) {
      return // Filling a gap is always allowed
    }

    // For new nonces outside the range, check the gap
    const gap = gapFromMax > 0n ? gapFromMax : gapFromMin
    if (gap > BigInt(this.config.maxNonceGap)) {
      throw new Error(
        `nonce gap too large: gap of ${gap}, max allowed is ${this.config.maxNonceGap}`
      )
    }
  }

  /**
   * Evict the entry with lowest gas price
   * @returns true if an entry was evicted, false if new entry has lowest price
   */
  private evictLowestGasPrice(newGasPrice: bigint): boolean {
    let lowestEntry: MempoolEntry | null = null
    let lowestHash: Hex | null = null

    for (const [hash, entry] of this.pool.entries()) {
      // Only consider pending entries for eviction
      if (entry.status !== 'pending') {
        continue
      }

      if (!lowestEntry || entry.userOp.maxFeePerGas < lowestEntry.userOp.maxFeePerGas) {
        lowestEntry = entry
        lowestHash = hash
      }
    }

    // If the new entry has lower gas price than all existing, reject it
    if (!lowestEntry || newGasPrice <= lowestEntry.userOp.maxFeePerGas) {
      return false
    }

    // Evict the lowest gas price entry
    if (lowestHash) {
      this.remove(lowestHash)
      this.logger.debug(
        { hash: lowestHash, gasPrice: lowestEntry.userOp.maxFeePerGas.toString() },
        'Evicted lowest gas price entry'
      )
      return true
    }

    return false
  }
}

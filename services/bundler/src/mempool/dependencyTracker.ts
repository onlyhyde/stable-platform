import type { Address, Hex } from 'viem'
import type { MempoolEntry } from '../types'
import type { Logger } from '../utils/logger'

/**
 * Record of storage access by a UserOperation
 */
export interface StorageAccessRecord {
  /** UserOp hash */
  userOpHash: Hex
  /** Sender address */
  sender: Address
  /** Map of contract address -> set of storage slots accessed (read + write) */
  accessedSlots: Map<Address, Set<string>>
  /** Map of contract address -> set of storage slots written (SSTORE only, subset of accessedSlots).
   *  When undefined, all accessed slots are conservatively treated as writes (backward compat). */
  writtenSlots?: Map<Address, Set<string>>
  /** Set of addresses created via CREATE2 during validation (for factory collision detection) */
  createdAddresses?: Set<Address>
}

/**
 * Dependency between two UserOperations due to shared storage access
 */
export interface StorageDependency {
  /** The op that must execute first (writes to shared slot) */
  predecessor: Hex
  /** The op that depends on the predecessor */
  successor: Hex
  /** Contract address where the conflict occurs */
  contract: Address
  /** Storage slot(s) in conflict */
  slots: string[]
}

/**
 * Factory CREATE2 address collision between two UserOperations
 */
export interface FactoryCollision {
  /** First op (kept in bundle) */
  keeper: Hex
  /** Second op (excluded from bundle) */
  excluded: Hex
  /** Conflicting CREATE2 address */
  address: Address
}

/**
 * Write-write storage conflict between two UserOperations (EIP-4337 Section 7.3).
 * Two ops from different senders that both SSTORE to the same slot cannot safely
 * coexist in a bundle — the second one is excluded.
 */
export interface WriteConflict {
  /** First op (kept in bundle) */
  keeper: Hex
  /** Second op (excluded from bundle) */
  excluded: Hex
  /** Contract address where the conflict occurs */
  contract: Address
  /** Storage slot in conflict */
  slot: string
}

/**
 * Result of dependency-aware ordering
 */
export interface DependencyOrderResult {
  /** Ops ordered by dependencies (topological sort) */
  ordered: MempoolEntry[]
  /** Ops removed due to circular dependencies */
  conflicting: MempoolEntry[]
}

/**
 * Tracks storage access patterns across UserOperations to detect
 * cross-operation dependencies. When two ops from different senders
 * access the same contract + storage slot, they must be ordered
 * correctly in the bundle to avoid execution failures.
 *
 * Uses Kahn's algorithm for topological sorting.
 */
export class DependencyTracker {
  /** Map from userOpHash to its storage access records */
  private readonly accessRecords: Map<Hex, StorageAccessRecord> = new Map()
  /** Inverted index: "contract:slot" -> set of userOpHashes that access it */
  private readonly slotIndex: Map<string, Set<Hex>> = new Map()
  /** Inverted index: "contract:slot" -> set of userOpHashes that WRITE (SSTORE) to it */
  private readonly writeSlotIndex: Map<string, Set<Hex>> = new Map()
  /** Inverted index: created address -> set of userOpHashes that CREATE2 it */
  private readonly createdIndex: Map<string, Set<Hex>> = new Map()
  private readonly logger: Logger

  constructor(logger: Logger) {
    this.logger = logger.child({ module: 'dependencyTracker' })
  }

  /**
   * Record storage access for a UserOperation
   */
  recordAccess(record: StorageAccessRecord): void {
    // Remove any previous record for this op
    this.removeAccess(record.userOpHash)

    this.accessRecords.set(record.userOpHash, record)

    // Update storage slot inverted index
    for (const [contract, slots] of record.accessedSlots) {
      for (const slot of slots) {
        const key = this.slotKey(contract, slot)
        if (!this.slotIndex.has(key)) {
          this.slotIndex.set(key, new Set())
        }
        this.slotIndex.get(key)!.add(record.userOpHash)
      }
    }

    // Update write slot inverted index
    if (record.writtenSlots) {
      for (const [contract, slots] of record.writtenSlots) {
        for (const slot of slots) {
          const key = this.slotKey(contract, slot)
          if (!this.writeSlotIndex.has(key)) {
            this.writeSlotIndex.set(key, new Set())
          }
          this.writeSlotIndex.get(key)!.add(record.userOpHash)
        }
      }
    }

    // Update CREATE2 address inverted index
    if (record.createdAddresses) {
      for (const addr of record.createdAddresses) {
        const key = addr.toLowerCase()
        if (!this.createdIndex.has(key)) {
          this.createdIndex.set(key, new Set())
        }
        this.createdIndex.get(key)!.add(record.userOpHash)
      }
    }

    this.logger.debug(
      {
        userOpHash: record.userOpHash,
        sender: record.sender,
        createdCount: record.createdAddresses?.size ?? 0,
      },
      'Recorded storage access'
    )
  }

  /**
   * Remove storage access records for a UserOperation
   */
  removeAccess(userOpHash: Hex): void {
    const record = this.accessRecords.get(userOpHash)
    if (!record) return

    // Remove from storage slot inverted index
    for (const [contract, slots] of record.accessedSlots) {
      for (const slot of slots) {
        const key = this.slotKey(contract, slot)
        const hashes = this.slotIndex.get(key)
        if (hashes) {
          hashes.delete(userOpHash)
          if (hashes.size === 0) {
            this.slotIndex.delete(key)
          }
        }
      }
    }

    // Remove from write slot inverted index
    if (record.writtenSlots) {
      for (const [contract, slots] of record.writtenSlots) {
        for (const slot of slots) {
          const key = this.slotKey(contract, slot)
          const hashes = this.writeSlotIndex.get(key)
          if (hashes) {
            hashes.delete(userOpHash)
            if (hashes.size === 0) {
              this.writeSlotIndex.delete(key)
            }
          }
        }
      }
    }

    // Remove from CREATE2 address inverted index
    if (record.createdAddresses) {
      for (const addr of record.createdAddresses) {
        const key = addr.toLowerCase()
        const hashes = this.createdIndex.get(key)
        if (hashes) {
          hashes.delete(userOpHash)
          if (hashes.size === 0) {
            this.createdIndex.delete(key)
          }
        }
      }
    }

    this.accessRecords.delete(userOpHash)
  }

  /**
   * Find dependencies among a set of UserOperations.
   * A dependency exists when two ops from different senders access the same slot
   * AND at least one of them writes to it. Read-read pairs are safe and skipped.
   */
  findDependencies(userOpHashes: Hex[]): StorageDependency[] {
    const hashSet = new Set(userOpHashes)
    const dependencies: StorageDependency[] = []
    const seen = new Set<string>()

    for (const hash of userOpHashes) {
      const record = this.accessRecords.get(hash)
      if (!record) continue

      for (const [contract, slots] of record.accessedSlots) {
        for (const slot of slots) {
          const key = this.slotKey(contract, slot)
          const otherHashes = this.slotIndex.get(key)
          if (!otherHashes) continue

          for (const otherHash of otherHashes) {
            if (otherHash === hash) continue
            if (!hashSet.has(otherHash)) continue

            const otherRecord = this.accessRecords.get(otherHash)
            if (!otherRecord) continue

            // Only create dependency between different senders
            if (record.sender === otherRecord.sender) continue

            // EIP-4337 Section 7.3: Read-read pairs are NOT conflicts
            const recordWrites = this.hasWrite(record, contract, slot)
            const otherWrites = this.hasWrite(otherRecord, contract, slot)
            if (!recordWrites && !otherWrites) continue

            // Create a canonical pair key to avoid duplicates
            const pairKey = hash < otherHash ? `${hash}:${otherHash}` : `${otherHash}:${hash}`
            const depKey = `${pairKey}:${key}`

            if (seen.has(depKey)) continue
            seen.add(depKey)

            // Earlier-added op is the predecessor (by hash order as tiebreaker)
            dependencies.push({
              predecessor: hash < otherHash ? hash : otherHash,
              successor: hash < otherHash ? otherHash : hash,
              contract,
              slots: [slot],
            })
          }
        }
      }
    }

    return dependencies
  }

  /**
   * Order entries by dependencies using topological sort (Kahn's algorithm).
   * Entries with circular dependencies are removed and returned separately.
   */
  orderByDependencies(entries: MempoolEntry[]): DependencyOrderResult {
    if (entries.length <= 1) {
      return { ordered: [...entries], conflicting: [] }
    }

    const hashes = entries.map((e) => e.userOpHash)
    const deps = this.findDependencies(hashes)

    if (deps.length === 0) {
      return { ordered: [...entries], conflicting: [] }
    }

    const entryMap = new Map<Hex, MempoolEntry>()
    for (const entry of entries) {
      entryMap.set(entry.userOpHash, entry)
    }

    // Build adjacency list and in-degree count
    const adjacency = new Map<Hex, Set<Hex>>()
    const inDegree = new Map<Hex, number>()

    for (const hash of hashes) {
      adjacency.set(hash, new Set())
      inDegree.set(hash, 0)
    }

    for (const dep of deps) {
      const successors = adjacency.get(dep.predecessor)
      if (successors && !successors.has(dep.successor)) {
        successors.add(dep.successor)
        inDegree.set(dep.successor, (inDegree.get(dep.successor) ?? 0) + 1)
      }
    }

    // Kahn's algorithm
    const queue: Hex[] = []
    for (const [hash, degree] of inDegree) {
      if (degree === 0) {
        queue.push(hash)
      }
    }

    const sorted: Hex[] = []
    while (queue.length > 0) {
      const current = queue.shift()!
      sorted.push(current)

      const successors = adjacency.get(current)
      if (successors) {
        for (const succ of successors) {
          const newDegree = (inDegree.get(succ) ?? 1) - 1
          inDegree.set(succ, newDegree)
          if (newDegree === 0) {
            queue.push(succ)
          }
        }
      }
    }

    // Items not in sorted list have circular dependencies
    const sortedSet = new Set(sorted)
    const ordered: MempoolEntry[] = []
    const conflicting: MempoolEntry[] = []

    for (const hash of sorted) {
      const entry = entryMap.get(hash)
      if (entry) ordered.push(entry)
    }

    for (const entry of entries) {
      if (!sortedSet.has(entry.userOpHash)) {
        conflicting.push(entry)
        this.logger.warn(
          { userOpHash: entry.userOpHash },
          'Removed op with circular storage dependency'
        )
      }
    }

    if (conflicting.length > 0) {
      this.logger.info(
        { conflictCount: conflicting.length },
        'Removed ops with circular dependencies from bundle'
      )
    }

    return { ordered, conflicting }
  }

  /**
   * EIP-4337 Section 7.3: Detect factory CREATE2 address collisions within a bundle.
   * Two UserOps from different senders that would CREATE2 the same address cannot
   * both succeed — the second deployment would revert. Returns the collisions found
   * and keeps the first-seen op (by hash order).
   */
  findFactoryCollisions(userOpHashes: Hex[]): FactoryCollision[] {
    const collisions: FactoryCollision[] = []
    const claimed = new Map<string, Hex>() // address -> first claimer hash

    for (const hash of userOpHashes) {
      const record = this.accessRecords.get(hash)
      if (!record?.createdAddresses) continue

      for (const addr of record.createdAddresses) {
        const key = addr.toLowerCase()
        const existing = claimed.get(key)

        if (existing && existing !== hash) {
          collisions.push({
            keeper: existing,
            excluded: hash,
            address: addr,
          })
        } else if (!existing) {
          claimed.set(key, hash)
        }
      }
    }

    return collisions
  }

  /**
   * EIP-4337 Section 7.3: Detect write-write storage conflicts within a bundle.
   * Two ops from different senders that both SSTORE to the same contract+slot
   * cannot safely coexist. First-seen op (by iteration order) is kept; later ops excluded.
   */
  findWriteConflicts(userOpHashes: Hex[]): WriteConflict[] {
    const conflicts: WriteConflict[] = []
    const claimed = new Map<string, Hex>() // "contract:slot" -> first writer hash

    for (const hash of userOpHashes) {
      const record = this.accessRecords.get(hash)
      if (!record) continue

      for (const [contract, slots] of record.accessedSlots) {
        for (const slot of slots) {
          if (!this.hasWrite(record, contract, slot)) continue

          const key = this.slotKey(contract, slot)
          const existing = claimed.get(key)

          if (existing && existing !== hash) {
            const existingRecord = this.accessRecords.get(existing)
            if (!existingRecord) continue

            // Only flag cross-sender write-write conflicts
            if (record.sender === existingRecord.sender) continue

            conflicts.push({
              keeper: existing,
              excluded: hash,
              contract,
              slot,
            })
          } else if (!existing) {
            claimed.set(key, hash)
          }
        }
      }
    }

    return conflicts
  }

  /**
   * Get the number of tracked operations
   */
  get size(): number {
    return this.accessRecords.size
  }

  /**
   * Clear all tracked access records
   */
  clear(): void {
    this.accessRecords.clear()
    this.slotIndex.clear()
    this.writeSlotIndex.clear()
    this.createdIndex.clear()
  }

  /**
   * Check if a record writes to a specific contract+slot.
   * When writtenSlots is undefined (backward compat), conservatively assumes write.
   */
  private hasWrite(record: StorageAccessRecord, contract: Address, slot: string): boolean {
    if (!record.writtenSlots) return true
    const slots = record.writtenSlots.get(contract)
    return slots !== undefined && slots.has(slot)
  }

  private slotKey(contract: Address, slot: string): string {
    return `${contract.toLowerCase()}:${slot.toLowerCase()}`
  }
}

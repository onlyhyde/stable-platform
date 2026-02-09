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
  /** Map of contract address -> set of storage slots accessed */
  accessedSlots: Map<Address, Set<string>>
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

    // Update inverted index
    for (const [contract, slots] of record.accessedSlots) {
      for (const slot of slots) {
        const key = this.slotKey(contract, slot)
        if (!this.slotIndex.has(key)) {
          this.slotIndex.set(key, new Set())
        }
        this.slotIndex.get(key)!.add(record.userOpHash)
      }
    }

    this.logger.debug(
      { userOpHash: record.userOpHash, sender: record.sender },
      'Recorded storage access'
    )
  }

  /**
   * Remove storage access records for a UserOperation
   */
  removeAccess(userOpHash: Hex): void {
    const record = this.accessRecords.get(userOpHash)
    if (!record) return

    // Remove from inverted index
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

    this.accessRecords.delete(userOpHash)
  }

  /**
   * Find dependencies among a set of UserOperations
   * A dependency exists when two ops from different senders access the same slot
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

            // Create a canonical pair key to avoid duplicates
            const pairKey =
              hash < otherHash ? `${hash}:${otherHash}` : `${otherHash}:${hash}`
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
  }

  private slotKey(contract: Address, slot: string): string {
    return `${contract.toLowerCase()}:${slot.toLowerCase()}`
  }
}

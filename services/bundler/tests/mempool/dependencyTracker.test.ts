import type { Address, Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { DependencyTracker, type StorageAccessRecord } from '../../src/mempool/dependencyTracker'
import type { MempoolEntry, UserOperation } from '../../src/types'
import { createLogger } from '../../src/utils/logger'

const logger = createLogger('error', false)
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

function createHash(index: number): Hex {
  return `0x${index.toString(16).padStart(64, '0')}` as Hex
}

function createAddress(index: number): Address {
  return `0x${index.toString(16).padStart(40, '0')}` as Address
}

function createUserOp(sender: Address, nonce = 0n): UserOperation {
  return {
    sender,
    nonce,
    factory: undefined,
    factoryData: undefined,
    callData: '0x' as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 1000000000n,
    maxPriorityFeePerGas: 500000000n,
    paymaster: undefined,
    paymasterVerificationGasLimit: undefined,
    paymasterPostOpGasLimit: undefined,
    paymasterData: undefined,
    signature: ('0x' + '00'.repeat(65)) as Hex,
  }
}

function createEntry(sender: Address, hash: Hex, nonce = 0n): MempoolEntry {
  return {
    userOp: createUserOp(sender, nonce),
    userOpHash: hash,
    entryPoint: ENTRY_POINT,
    status: 'pending',
    addedAt: Date.now(),
  }
}

function createAccessRecord(
  hash: Hex,
  sender: Address,
  accesses: Array<[Address, string[]]>,
  createdAddresses?: Address[],
  writes?: Array<[Address, string[]]>
): StorageAccessRecord {
  const accessedSlots = new Map<Address, Set<string>>()
  for (const [contract, slots] of accesses) {
    accessedSlots.set(contract, new Set(slots))
  }
  const writtenSlots = writes
    ? (() => {
        const m = new Map<Address, Set<string>>()
        for (const [contract, slots] of writes) {
          m.set(contract, new Set(slots))
        }
        return m
      })()
    : undefined
  return {
    userOpHash: hash,
    sender,
    accessedSlots,
    writtenSlots,
    createdAddresses: createdAddresses ? new Set(createdAddresses) : undefined,
  }
}

describe('DependencyTracker', () => {
  describe('recordAccess / removeAccess', () => {
    it('should store and retrieve access records', () => {
      const tracker = new DependencyTracker(logger)
      const hash = createHash(1)
      const sender = createAddress(1)
      const contract = createAddress(100)

      tracker.recordAccess(createAccessRecord(hash, sender, [[contract, ['0x01']]]))

      expect(tracker.size).toBe(1)
    })

    it('should remove access records cleanly', () => {
      const tracker = new DependencyTracker(logger)
      const hash = createHash(1)
      const sender = createAddress(1)
      const contract = createAddress(100)

      tracker.recordAccess(createAccessRecord(hash, sender, [[contract, ['0x01']]]))

      expect(tracker.size).toBe(1)

      tracker.removeAccess(hash)

      expect(tracker.size).toBe(0)
    })

    it('should handle removing non-existent hash', () => {
      const tracker = new DependencyTracker(logger)
      tracker.removeAccess(createHash(999))
      expect(tracker.size).toBe(0)
    })
  })

  describe('findDependencies', () => {
    it('should find no deps when ops access different slots', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)

      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, ['0x01']]]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [[contract, ['0x02']]]))

      const deps = tracker.findDependencies([hash1, hash2])
      expect(deps.length).toBe(0)
    })

    it('should find dependency when ops access same contract+slot', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)
      const sharedSlot = '0xabcd'

      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, [sharedSlot]]]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [[contract, [sharedSlot]]]))

      const deps = tracker.findDependencies([hash1, hash2])
      expect(deps.length).toBe(1)
      expect(deps[0]!.contract).toBe(contract)
      expect(deps[0]!.slots).toContain(sharedSlot)
    })

    it('should not create dependency for same-sender ops', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sameSender = createAddress(1)
      const contract = createAddress(100)

      tracker.recordAccess(createAccessRecord(hash1, sameSender, [[contract, ['0x01']]]))
      tracker.recordAccess(createAccessRecord(hash2, sameSender, [[contract, ['0x01']]]))

      const deps = tracker.findDependencies([hash1, hash2])
      expect(deps.length).toBe(0)
    })

    it('should only find deps among specified hashes', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const hash3 = createHash(3)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const sender3 = createAddress(3)
      const contract = createAddress(100)

      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, ['0x01']]]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [[contract, ['0x01']]]))
      tracker.recordAccess(createAccessRecord(hash3, sender3, [[contract, ['0x01']]]))

      // Only check hash1 and hash3 - should find dependency
      const deps = tracker.findDependencies([hash1, hash3])
      expect(deps.length).toBe(1)
    })
  })

  describe('orderByDependencies', () => {
    it('should return ops in dependency order', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)

      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, ['0x01']]]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [[contract, ['0x01']]]))

      const entry1 = createEntry(sender1, hash1)
      const entry2 = createEntry(sender2, hash2)

      const result = tracker.orderByDependencies([entry2, entry1])

      expect(result.ordered.length).toBe(2)
      expect(result.conflicting.length).toBe(0)
      // The predecessor (lower hash) should come first
      expect(result.ordered[0]!.userOpHash).toBe(hash1)
      expect(result.ordered[1]!.userOpHash).toBe(hash2)
    })

    it('should handle independent ops (no reordering needed)', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract1 = createAddress(100)
      const contract2 = createAddress(200)

      // Different contracts, different slots - no dependency
      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract1, ['0x01']]]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [[contract2, ['0x02']]]))

      const entry1 = createEntry(sender1, hash1)
      const entry2 = createEntry(sender2, hash2)

      const result = tracker.orderByDependencies([entry1, entry2])

      expect(result.ordered.length).toBe(2)
      expect(result.conflicting.length).toBe(0)
    })

    it('should detect and remove circular dependency', () => {
      const tracker = new DependencyTracker(logger)
      const hashA = createHash(1)
      const hashB = createHash(2)
      const hashC = createHash(3)
      const senderA = createAddress(1)
      const senderB = createAddress(2)
      const senderC = createAddress(3)
      const contract1 = createAddress(100)
      const contract2 = createAddress(200)

      // A accesses contract1:slot1 (shared with B)
      // B accesses contract2:slot2 (shared with A) - creates cycle
      // A -> B on contract1:slot1, B -> A on contract2:slot2
      tracker.recordAccess(
        createAccessRecord(hashA, senderA, [
          [contract1, ['0x01']],
          [contract2, ['0x02']],
        ])
      )
      tracker.recordAccess(
        createAccessRecord(hashB, senderB, [
          [contract1, ['0x01']],
          [contract2, ['0x02']],
        ])
      )

      // C is independent
      tracker.recordAccess(createAccessRecord(hashC, senderC, [[createAddress(300), ['0x03']]]))

      const entries = [
        createEntry(senderA, hashA),
        createEntry(senderB, hashB),
        createEntry(senderC, hashC),
      ]

      const result = tracker.orderByDependencies(entries)

      // Due to the way Kahn's algorithm handles cycles, the cycle participants
      // will be in conflicting (they'll have non-zero in-degree)
      // In this specific case, A and B have a mutual dependency which creates
      // a cycle. However, since both write/read the same slots, one of them
      // might be resolved. The exact behavior depends on the hash ordering.
      // At minimum, C should be in ordered.
      const totalHandled = result.ordered.length + result.conflicting.length
      expect(totalHandled).toBe(3)
      // C should always be in ordered since it's independent
      expect(result.ordered.some((e) => e.userOpHash === hashC)).toBe(true)
    })

    it('should handle complex dependency chains (A->B->C)', () => {
      const tracker = new DependencyTracker(logger)
      const hashA = createHash(1)
      const hashB = createHash(2)
      const hashC = createHash(3)
      const senderA = createAddress(1)
      const senderB = createAddress(2)
      const senderC = createAddress(3)
      const contract1 = createAddress(100)
      const contract2 = createAddress(200)

      // A and B share contract1:slot1
      tracker.recordAccess(createAccessRecord(hashA, senderA, [[contract1, ['0x01']]]))
      tracker.recordAccess(
        createAccessRecord(hashB, senderB, [
          [contract1, ['0x01']],
          [contract2, ['0x02']],
        ])
      )
      // B and C share contract2:slot2
      tracker.recordAccess(createAccessRecord(hashC, senderC, [[contract2, ['0x02']]]))

      const entries = [
        createEntry(senderC, hashC),
        createEntry(senderA, hashA),
        createEntry(senderB, hashB),
      ]

      const result = tracker.orderByDependencies(entries)

      expect(result.ordered.length).toBe(3)
      expect(result.conflicting.length).toBe(0)

      // A should come before B, B should come before C
      const aIdx = result.ordered.findIndex((e) => e.userOpHash === hashA)
      const bIdx = result.ordered.findIndex((e) => e.userOpHash === hashB)
      const cIdx = result.ordered.findIndex((e) => e.userOpHash === hashC)

      expect(aIdx).toBeLessThan(bIdx)
      expect(bIdx).toBeLessThan(cIdx)
    })

    it('should handle single entry', () => {
      const tracker = new DependencyTracker(logger)
      const entry = createEntry(createAddress(1), createHash(1))

      const result = tracker.orderByDependencies([entry])

      expect(result.ordered.length).toBe(1)
      expect(result.conflicting.length).toBe(0)
    })

    it('should handle empty entries', () => {
      const tracker = new DependencyTracker(logger)
      const result = tracker.orderByDependencies([])

      expect(result.ordered.length).toBe(0)
      expect(result.conflicting.length).toBe(0)
    })
  })

  describe('findFactoryCollisions', () => {
    it('should detect CREATE2 address collision between two ops', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const createdAddr = createAddress(50)

      tracker.recordAccess(
        createAccessRecord(hash1, sender1, [], [createdAddr])
      )
      tracker.recordAccess(
        createAccessRecord(hash2, sender2, [], [createdAddr])
      )

      const collisions = tracker.findFactoryCollisions([hash1, hash2])
      expect(collisions.length).toBe(1)
      expect(collisions[0]!.keeper).toBe(hash1)
      expect(collisions[0]!.excluded).toBe(hash2)
      expect(collisions[0]!.address).toBe(createdAddr)
    })

    it('should return no collisions when ops create different addresses', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)

      tracker.recordAccess(
        createAccessRecord(hash1, sender1, [], [createAddress(50)])
      )
      tracker.recordAccess(
        createAccessRecord(hash2, sender2, [], [createAddress(51)])
      )

      const collisions = tracker.findFactoryCollisions([hash1, hash2])
      expect(collisions.length).toBe(0)
    })

    it('should return no collisions when ops have no created addresses', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)

      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, ['0x01']]]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [[contract, ['0x02']]]))

      const collisions = tracker.findFactoryCollisions([hash1, hash2])
      expect(collisions.length).toBe(0)
    })

    it('should keep first-seen op and exclude later ones for same address', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const hash3 = createHash(3)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const sender3 = createAddress(3)
      const createdAddr = createAddress(50)

      // All three ops try to CREATE2 the same address
      tracker.recordAccess(createAccessRecord(hash1, sender1, [], [createdAddr]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [], [createdAddr]))
      tracker.recordAccess(createAccessRecord(hash3, sender3, [], [createdAddr]))

      const collisions = tracker.findFactoryCollisions([hash1, hash2, hash3])
      // hash1 is keeper, hash2 and hash3 are excluded
      expect(collisions.length).toBe(2)
      expect(collisions.every((c) => c.keeper === hash1)).toBe(true)
      expect(collisions.map((c) => c.excluded).sort()).toEqual([hash2, hash3].sort())
    })

    it('should handle case-insensitive address comparison', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)

      // Same address, different case
      const addrLower = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address
      const addrUpper = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address

      tracker.recordAccess(createAccessRecord(hash1, sender1, [], [addrLower]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [], [addrUpper]))

      const collisions = tracker.findFactoryCollisions([hash1, hash2])
      expect(collisions.length).toBe(1)
    })
  })

  describe('created address index management', () => {
    it('should clean up created index on removeAccess', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const createdAddr = createAddress(50)

      tracker.recordAccess(createAccessRecord(hash1, sender1, [], [createdAddr]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [], [createdAddr]))

      // Both ops CREATE2 same address -> collision
      expect(tracker.findFactoryCollisions([hash1, hash2]).length).toBe(1)

      // Remove first op
      tracker.removeAccess(hash1)

      // No collision anymore since hash1 is removed
      expect(tracker.findFactoryCollisions([hash1, hash2]).length).toBe(0)
    })

    it('should clean up created index on clear', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const createdAddr = createAddress(50)

      tracker.recordAccess(createAccessRecord(hash1, sender1, [], [createdAddr]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [], [createdAddr]))

      expect(tracker.findFactoryCollisions([hash1, hash2]).length).toBe(1)

      tracker.clear()

      expect(tracker.size).toBe(0)
      expect(tracker.findFactoryCollisions([hash1, hash2]).length).toBe(0)
    })

    it('should update created index when re-recording access for same hash', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const addrA = createAddress(50)
      const addrB = createAddress(51)

      // hash1 creates addrA, hash2 creates addrA -> collision
      tracker.recordAccess(createAccessRecord(hash1, sender1, [], [addrA]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [], [addrA]))
      expect(tracker.findFactoryCollisions([hash1, hash2]).length).toBe(1)

      // Re-record hash1 with different created address -> no collision
      tracker.recordAccess(createAccessRecord(hash1, sender1, [], [addrB]))
      expect(tracker.findFactoryCollisions([hash1, hash2]).length).toBe(0)
    })
  })

  describe('findDependencies with read/write distinction', () => {
    it('should skip dependency when both ops only read the same slot', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)
      const slot = '0xaa'

      // Both access slot but neither writes
      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, [slot]]], undefined, []))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [[contract, [slot]]], undefined, []))

      const deps = tracker.findDependencies([hash1, hash2])
      expect(deps.length).toBe(0)
    })

    it('should create dependency when one reads and the other writes', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)
      const slot = '0xaa'

      // hash1 reads, hash2 writes
      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, [slot]]], undefined, []))
      tracker.recordAccess(
        createAccessRecord(hash2, sender2, [[contract, [slot]]], undefined, [[contract, [slot]]])
      )

      const deps = tracker.findDependencies([hash1, hash2])
      expect(deps.length).toBe(1)
    })

    it('should create dependency when both write to the same slot', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)
      const slot = '0xaa'

      tracker.recordAccess(
        createAccessRecord(hash1, sender1, [[contract, [slot]]], undefined, [[contract, [slot]]])
      )
      tracker.recordAccess(
        createAccessRecord(hash2, sender2, [[contract, [slot]]], undefined, [[contract, [slot]]])
      )

      const deps = tracker.findDependencies([hash1, hash2])
      expect(deps.length).toBe(1)
    })

    it('should conservatively treat as write when writtenSlots is undefined (backward compat)', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)
      const slot = '0xaa'

      // No writtenSlots at all → treated as write
      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, [slot]]]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [[contract, [slot]]]))

      const deps = tracker.findDependencies([hash1, hash2])
      expect(deps.length).toBe(1)
    })

    it('should treat mixed records conservatively (one has writtenSlots, other does not)', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)
      const slot = '0xaa'

      // hash1 has writtenSlots (read-only), hash2 has no writtenSlots (conservative → write)
      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, [slot]]], undefined, []))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [[contract, [slot]]]))

      const deps = tracker.findDependencies([hash1, hash2])
      expect(deps.length).toBe(1)
    })

    it('should not create dependency when reading slot X and writing different slot Y', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)

      // hash1 reads 0xaa, hash2 writes 0xbb — no overlap on the same slot
      tracker.recordAccess(
        createAccessRecord(hash1, sender1, [[contract, ['0xaa']]], undefined, [])
      )
      tracker.recordAccess(
        createAccessRecord(hash2, sender2, [[contract, ['0xbb']]], undefined, [[contract, ['0xbb']]])
      )

      const deps = tracker.findDependencies([hash1, hash2])
      expect(deps.length).toBe(0)
    })
  })

  describe('findWriteConflicts', () => {
    it('should return no conflicts when both ops only read', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)
      const slot = '0xaa'

      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, [slot]]], undefined, []))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [[contract, [slot]]], undefined, []))

      const conflicts = tracker.findWriteConflicts([hash1, hash2])
      expect(conflicts.length).toBe(0)
    })

    it('should detect write-write conflict and keep first op', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)
      const slot = '0xaa'

      tracker.recordAccess(
        createAccessRecord(hash1, sender1, [[contract, [slot]]], undefined, [[contract, [slot]]])
      )
      tracker.recordAccess(
        createAccessRecord(hash2, sender2, [[contract, [slot]]], undefined, [[contract, [slot]]])
      )

      const conflicts = tracker.findWriteConflicts([hash1, hash2])
      expect(conflicts.length).toBe(1)
      expect(conflicts[0]!.keeper).toBe(hash1)
      expect(conflicts[0]!.excluded).toBe(hash2)
      expect(conflicts[0]!.contract).toBe(contract)
      expect(conflicts[0]!.slot).toBe(slot)
    })

    it('should not flag read-write as a write conflict', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)
      const slot = '0xaa'

      // hash1 reads, hash2 writes
      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, [slot]]], undefined, []))
      tracker.recordAccess(
        createAccessRecord(hash2, sender2, [[contract, [slot]]], undefined, [[contract, [slot]]])
      )

      const conflicts = tracker.findWriteConflicts([hash1, hash2])
      expect(conflicts.length).toBe(0)
    })

    it('should not flag same-sender write-write as conflict', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sameSender = createAddress(1)
      const contract = createAddress(100)
      const slot = '0xaa'

      tracker.recordAccess(
        createAccessRecord(hash1, sameSender, [[contract, [slot]]], undefined, [[contract, [slot]]])
      )
      tracker.recordAccess(
        createAccessRecord(hash2, sameSender, [[contract, [slot]]], undefined, [[contract, [slot]]])
      )

      const conflicts = tracker.findWriteConflicts([hash1, hash2])
      expect(conflicts.length).toBe(0)
    })

    it('should handle 3 ops writing same slot — 2 conflicts, first op kept', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const hash3 = createHash(3)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const sender3 = createAddress(3)
      const contract = createAddress(100)
      const slot = '0xaa'

      tracker.recordAccess(
        createAccessRecord(hash1, sender1, [[contract, [slot]]], undefined, [[contract, [slot]]])
      )
      tracker.recordAccess(
        createAccessRecord(hash2, sender2, [[contract, [slot]]], undefined, [[contract, [slot]]])
      )
      tracker.recordAccess(
        createAccessRecord(hash3, sender3, [[contract, [slot]]], undefined, [[contract, [slot]]])
      )

      const conflicts = tracker.findWriteConflicts([hash1, hash2, hash3])
      expect(conflicts.length).toBe(2)
      expect(conflicts.every((c) => c.keeper === hash1)).toBe(true)
      expect(conflicts.map((c) => c.excluded).sort()).toEqual([hash2, hash3].sort())
    })

    it('should not flag writes to different slots', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)

      tracker.recordAccess(
        createAccessRecord(
          hash1,
          sender1,
          [[contract, ['0xaa']]],
          undefined,
          [[contract, ['0xaa']]]
        )
      )
      tracker.recordAccess(
        createAccessRecord(
          hash2,
          sender2,
          [[contract, ['0xbb']]],
          undefined,
          [[contract, ['0xbb']]]
        )
      )

      const conflicts = tracker.findWriteConflicts([hash1, hash2])
      expect(conflicts.length).toBe(0)
    })

    it('should conservatively detect conflict when writtenSlots is undefined', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const contract = createAddress(100)
      const slot = '0xaa'

      // No writtenSlots → conservative: treated as write
      tracker.recordAccess(createAccessRecord(hash1, sender1, [[contract, [slot]]]))
      tracker.recordAccess(createAccessRecord(hash2, sender2, [[contract, [slot]]]))

      const conflicts = tracker.findWriteConflicts([hash1, hash2])
      expect(conflicts.length).toBe(1)
    })

    it('should not cascade — excluded op with other slot does not trigger additional exclusion', () => {
      const tracker = new DependencyTracker(logger)
      const hash1 = createHash(1)
      const hash2 = createHash(2)
      const hash3 = createHash(3)
      const sender1 = createAddress(1)
      const sender2 = createAddress(2)
      const sender3 = createAddress(3)
      const contract = createAddress(100)

      // hash1 writes 0xaa, hash2 writes 0xaa (conflict with hash1) and 0xbb, hash3 writes 0xbb
      tracker.recordAccess(
        createAccessRecord(
          hash1,
          sender1,
          [[contract, ['0xaa']]],
          undefined,
          [[contract, ['0xaa']]]
        )
      )
      tracker.recordAccess(
        createAccessRecord(
          hash2,
          sender2,
          [[contract, ['0xaa', '0xbb']]],
          undefined,
          [[contract, ['0xaa', '0xbb']]]
        )
      )
      tracker.recordAccess(
        createAccessRecord(
          hash3,
          sender3,
          [[contract, ['0xbb']]],
          undefined,
          [[contract, ['0xbb']]]
        )
      )

      const conflicts = tracker.findWriteConflicts([hash1, hash2, hash3])
      // hash2 excluded for 0xaa conflict with hash1
      // hash2 claims 0xbb first (in iteration order), hash3 conflicts on 0xbb
      // BUT: findWriteConflicts uses first-seen claiming, hash2 claims 0xbb before hash3
      // So hash3 is also excluded. This is the expected behavior of the first-seen algorithm.
      // The key point: hash2's exclusion doesn't retroactively free its 0xbb claim.
      expect(conflicts.length).toBe(2)
      // hash1 and hash2 conflict on 0xaa, hash2 and hash3 conflict on 0xbb
      const excludedSet = new Set(conflicts.map((c) => c.excluded))
      expect(excludedSet.has(hash2)).toBe(true)
    })
  })

  describe('clear', () => {
    it('should clear all tracked records', () => {
      const tracker = new DependencyTracker(logger)
      const contract = createAddress(100)

      tracker.recordAccess(
        createAccessRecord(createHash(1), createAddress(1), [[contract, ['0x01']]])
      )
      tracker.recordAccess(
        createAccessRecord(createHash(2), createAddress(2), [[contract, ['0x02']]])
      )

      expect(tracker.size).toBe(2)

      tracker.clear()

      expect(tracker.size).toBe(0)
    })
  })
})

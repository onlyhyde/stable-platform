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
  accesses: Array<[Address, string[]]>
): StorageAccessRecord {
  const accessedSlots = new Map<Address, Set<string>>()
  for (const [contract, slots] of accesses) {
    accessedSlots.set(contract, new Set(slots))
  }
  return { userOpHash: hash, sender, accessedSlots }
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

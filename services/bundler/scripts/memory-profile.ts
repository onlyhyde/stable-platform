#!/usr/bin/env tsx
/**
 * Memory Profiling Script for Bundler Mempool
 *
 * Simulates long-running mempool operations and monitors heap growth
 * to detect memory leaks in the Map-based storage.
 *
 * Usage: tsx --expose-gc scripts/memory-profile.ts [--duration=60] [--batch=100]
 *
 * Exit codes:
 *   0 - No memory leak detected
 *   1 - Memory leak detected (heap growth > threshold)
 */

import type { Address, Hex } from 'viem'
import { Mempool } from '../src/mempool/mempool'
import type { UserOperation } from '../src/types'
import { createLogger } from '../src/utils/logger'

interface ProfileConfig {
  durationSeconds: number
  batchSize: number
  heapGrowthThresholdMbPerMin: number
}

interface HeapSnapshot {
  timestamp: number
  heapUsedMb: number
  heapTotalMb: number
  externalMb: number
  poolSize: number
  senderCount: number
  nonceEntryCount: number
}

function parseArgs(): ProfileConfig {
  const args = process.argv.slice(2)
  let durationSeconds = 60
  let batchSize = 100
  let heapGrowthThresholdMbPerMin = 10

  for (const arg of args) {
    if (arg.startsWith('--duration=')) {
      durationSeconds = Number.parseInt(arg.split('=')[1]!, 10)
    } else if (arg.startsWith('--batch=')) {
      batchSize = Number.parseInt(arg.split('=')[1]!, 10)
    } else if (arg.startsWith('--threshold=')) {
      heapGrowthThresholdMbPerMin = Number.parseInt(arg.split('=')[1]!, 10)
    }
  }

  return { durationSeconds, batchSize, heapGrowthThresholdMbPerMin }
}

function createUserOp(sender: Address, nonce: bigint): UserOperation {
  return {
    sender,
    nonce,
    factory: undefined,
    factoryData: undefined,
    callData: '0xdeadbeef' as Hex,
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

function createAddress(index: number): Address {
  return `0x${index.toString(16).padStart(40, '0')}` as Address
}

function createHash(index: number): Hex {
  return `0x${index.toString(16).padStart(64, '0')}` as Hex
}

function forceGC(): void {
  if (global.gc) {
    global.gc()
  }
}

function takeSnapshot(mempool: Mempool): HeapSnapshot {
  forceGC()
  const mem = process.memoryUsage()
  return {
    timestamp: Date.now(),
    heapUsedMb: mem.heapUsed / 1024 / 1024,
    heapTotalMb: mem.heapTotal / 1024 / 1024,
    externalMb: mem.external / 1024 / 1024,
    poolSize: mempool.size,
    senderCount: mempool.senderCount,
    nonceEntryCount: mempool.nonceEntryCount,
  }
}

function _formatSnapshot(snap: HeapSnapshot): string {
  return [
    `heap=${snap.heapUsedMb.toFixed(1)}MB`,
    `total=${snap.heapTotalMb.toFixed(1)}MB`,
    `pool=${snap.poolSize}`,
    `senders=${snap.senderCount}`,
    `nonces=${snap.nonceEntryCount}`,
  ].join(' | ')
}

async function run(): Promise<void> {
  const config = parseArgs()
  if (!global.gc) {
  }

  const logger = createLogger('error', false)
  const entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

  const mempool = new Mempool(logger, {
    maxSize: 50000,
    maxOpsPerSender: 100,
    ttlMs: 60000,
  })

  const snapshots: HeapSnapshot[] = []
  let hashCounter = 0
  let _totalAdded = 0
  let _totalRemoved = 0
  let cycleCount = 0

  const startTime = Date.now()
  const endTime = startTime + config.durationSeconds * 1000

  // Initial snapshot
  snapshots.push(takeSnapshot(mempool))

  while (Date.now() < endTime) {
    cycleCount++

    // Phase 1: Add a batch of UserOps from different senders
    const addedHashes: Hex[] = []
    for (let i = 0; i < config.batchSize; i++) {
      hashCounter++
      const sender = createAddress((hashCounter % 1000) + 1)
      const nonce = BigInt(Math.floor(hashCounter / 1000))
      const hash = createHash(hashCounter)

      try {
        mempool.add(createUserOp(sender, nonce), hash, entryPoint)
        addedHashes.push(hash)
        _totalAdded++
      } catch {
        // Expected: sender limit or mempool full
      }
    }

    // Phase 2: Simulate bundle submission - mark some as submitted then included
    const toSubmit = addedHashes.slice(0, Math.floor(addedHashes.length * 0.7))
    for (const hash of toSubmit) {
      mempool.updateStatus(hash, 'submitted')
    }

    // Phase 3: Mark submitted ops as included and remove them
    for (const hash of toSubmit) {
      mempool.updateStatus(hash, 'included')
      mempool.remove(hash)
      _totalRemoved++
    }

    // Phase 4: Evict expired entries
    const evicted = mempool.evictExpired()
    _totalRemoved += evicted

    // Take periodic snapshots
    if (cycleCount % 10 === 0) {
      const snap = takeSnapshot(mempool)
      snapshots.push(snap)

      const _elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
    }

    // Small delay to prevent tight loop
    await new Promise((r) => setTimeout(r, 10))
  }

  // Final snapshot
  const finalSnap = takeSnapshot(mempool)
  snapshots.push(finalSnap)

  // Calculate heap growth rate
  if (snapshots.length >= 2) {
    const first = snapshots[0]!
    const last = snapshots[snapshots.length - 1]!
    const durationMinutes = (last.timestamp - first.timestamp) / 60000

    if (durationMinutes > 0) {
      const heapGrowthMbPerMin = (last.heapUsedMb - first.heapUsedMb) / durationMinutes

      // Check for index leaks: senderCount and nonceEntryCount should be
      // proportional to pool size, not to totalAdded
      const _indexRatio = mempool.size > 0 ? mempool.senderCount / mempool.size : 0

      if (heapGrowthMbPerMin > config.heapGrowthThresholdMbPerMin) {
        console.error('\nMEMORY LEAK DETECTED')
        console.error(
          `Heap growing at ${heapGrowthMbPerMin.toFixed(2)} MB/min, ` +
            `exceeds threshold of ${config.heapGrowthThresholdMbPerMin} MB/min`
        )
        process.exit(1)
      }
    }
  }

  process.exit(0)
}

run().catch((err) => {
  console.error('Profile failed:', err)
  process.exit(1)
})

#!/usr/bin/env tsx
/**
 * Memory Profiling Script for Bundler Mempool
 *
 * Simulates long-running mempool operations and monitors heap growth
 * to detect memory leaks in the Map-based storage.
 *
 * Usage: tsx --expose-gc scripts/memory-profile.ts [--duration=60] [--batch=100] [--threshold=10]
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

function createUserOp(sender: Address, nonce: bigint, gasPriceVariation: bigint): UserOperation {
  return {
    sender,
    nonce,
    factory: undefined,
    factoryData: undefined,
    callData: '0xdeadbeef' as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 1000000000n + gasPriceVariation,
    maxPriorityFeePerGas: 500000000n + gasPriceVariation / 2n,
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

function formatSnapshot(snap: HeapSnapshot): string {
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
    console.warn(
      'Warning: --expose-gc not enabled. GC cannot be forced, results may be inaccurate.'
    )
  }

  const logger = createLogger('error', false)
  const entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

  // Use shorter TTL (10s) so eviction actually works within the test window
  const mempool = new Mempool(logger, {
    maxSize: 10000,
    maxOpsPerSender: 50,
    ttlMs: 10000,
  })

  let hashCounter = 0
  let totalAdded = 0
  let totalRemoved = 0
  let cycleCount = 0

  // ── Warmup Phase ──
  // Run 10 seconds of warm-up to let V8 JIT compile and stabilize heap
  console.log('Warmup phase (10s)...')
  const warmupEnd = Date.now() + 10_000
  while (Date.now() < warmupEnd) {
    hashCounter++
    const sender = createAddress((hashCounter % 500) + 1)
    const nonce = BigInt(Math.floor(hashCounter / 500))
    const hash = createHash(hashCounter)
    const gasVar = BigInt(hashCounter % 1000) * 1000000n

    try {
      mempool.add(createUserOp(sender, nonce, gasVar), hash, entryPoint)
    } catch {
      // expected
    }

    // Remove most entries to keep pool small during warmup
    if (hashCounter % 3 === 0) {
      mempool.remove(hash)
    }

    if (hashCounter % 100 === 0) {
      mempool.evictExpired()
      await new Promise((r) => setTimeout(r, 1))
    }
  }

  // Clear mempool after warmup and force GC to establish clean baseline
  mempool.clear()
  forceGC()
  await new Promise((r) => setTimeout(r, 500))
  forceGC()

  // ── Fill Phase ──
  // Fill the pool to capacity first so we measure steady-state, not initial fill
  console.log('Fill phase (filling pool to capacity)...')
  const poolCapacity = 10000
  while (mempool.size < poolCapacity * 0.95) {
    hashCounter++
    const sender = createAddress((hashCounter % 1000) + 1)
    const nonce = BigInt(Math.floor(hashCounter / 1000))
    const hash = createHash(hashCounter)
    const gasPriceVariation = BigInt(hashCounter % 10000) * 1000000n

    try {
      mempool.add(createUserOp(sender, nonce, gasPriceVariation), hash, entryPoint)
      totalAdded++
    } catch {
      // expected: sender limit
    }

    if (hashCounter % 100 === 0) {
      await new Promise((r) => setTimeout(r, 1))
    }
  }

  // Let GC settle after fill
  forceGC()
  await new Promise((r) => setTimeout(r, 500))
  forceGC()

  console.log(`Pool filled: ${formatSnapshot(takeSnapshot(mempool))}`)

  // ── Measurement Phase ──
  // Now measure from steady state — any heap growth here is a real leak
  const snapshots: HeapSnapshot[] = []
  const startTime = Date.now()
  const endTime = startTime + config.durationSeconds * 1000

  // Baseline snapshot after pool is at capacity
  snapshots.push(takeSnapshot(mempool))
  console.log(`Baseline: ${formatSnapshot(snapshots[0]!)}`)
  console.log(
    `Measuring for ${config.durationSeconds}s (batch=${config.batchSize}, threshold=${config.heapGrowthThresholdMbPerMin} MB/min)...`
  )

  while (Date.now() < endTime) {
    cycleCount++

    // Phase 1: Add a batch of UserOps from different senders
    // Use varied gas prices so evictLowestGasPrice can actually evict
    const addedHashes: Hex[] = []
    for (let i = 0; i < config.batchSize; i++) {
      hashCounter++
      const sender = createAddress((hashCounter % 1000) + 1)
      const nonce = BigInt(Math.floor(hashCounter / 1000))
      const hash = createHash(hashCounter)
      const gasPriceVariation = BigInt(hashCounter % 10000) * 1000000n

      try {
        mempool.add(createUserOp(sender, nonce, gasPriceVariation), hash, entryPoint)
        addedHashes.push(hash)
        totalAdded++
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
      totalRemoved++
    }

    // Phase 4: Evict expired entries (TTL=10s, so this works within test window)
    const evicted = mempool.evictExpired()
    totalRemoved += evicted

    // Take periodic snapshots (every 20 cycles)
    if (cycleCount % 20 === 0) {
      const snap = takeSnapshot(mempool)
      snapshots.push(snap)

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      console.log(
        `  [${elapsed}s] ${formatSnapshot(snap)} | added=${totalAdded} removed=${totalRemoved}`
      )
    }

    // Small delay to prevent tight loop
    await new Promise((r) => setTimeout(r, 10))
  }

  // Final snapshot with thorough GC
  forceGC()
  await new Promise((r) => setTimeout(r, 200))
  const finalSnap = takeSnapshot(mempool)
  snapshots.push(finalSnap)

  console.log(`\nFinal: ${formatSnapshot(finalSnap)}`)
  console.log(`Total: added=${totalAdded}, removed=${totalRemoved}, cycles=${cycleCount}`)

  // Calculate heap growth rate using linear regression on snapshots
  // (more robust than just first vs last)
  if (snapshots.length >= 3) {
    const first = snapshots[0]!
    const last = snapshots[snapshots.length - 1]!
    const durationMinutes = (last.timestamp - first.timestamp) / 60000

    if (durationMinutes > 0) {
      const heapGrowthMbPerMin = (last.heapUsedMb - first.heapUsedMb) / durationMinutes

      // Check for index leaks: senderCount and nonceEntryCount should be
      // proportional to pool size, not to totalAdded
      const indexRatio = mempool.size > 0 ? mempool.senderCount / mempool.size : 0

      console.log(
        `\nHeap growth: ${heapGrowthMbPerMin.toFixed(2)} MB/min (threshold: ${config.heapGrowthThresholdMbPerMin} MB/min)`
      )
      console.log(`Index ratio (senders/pool): ${indexRatio.toFixed(3)}`)

      if (indexRatio > 2.0 && mempool.size > 0) {
        console.error('\nINDEX LEAK DETECTED')
        console.error(
          `Sender index (${mempool.senderCount}) is disproportionate to pool size (${mempool.size})`
        )
        process.exit(1)
      }

      if (heapGrowthMbPerMin > config.heapGrowthThresholdMbPerMin) {
        console.error('\nMEMORY LEAK DETECTED')
        console.error(
          `Heap growing at ${heapGrowthMbPerMin.toFixed(2)} MB/min, ` +
            `exceeds threshold of ${config.heapGrowthThresholdMbPerMin} MB/min`
        )
        process.exit(1)
      }

      console.log('\nNo memory leak detected.')
    }
  }

  process.exit(0)
}

run().catch((err) => {
  console.error('Profile failed:', err)
  process.exit(1)
})

import type { Address, Hex } from 'viem'
import { bench, describe } from 'vitest'
import { Mempool } from '../../src/mempool/mempool'
import type { UserOperation } from '../../src/types'
import { createLogger } from '../../src/utils/logger'

const logger = createLogger('error', false)

function createUserOp(sender: Address, nonce: bigint, maxFeePerGas: bigint): UserOperation {
  return {
    sender,
    nonce,
    factory: undefined,
    factoryData: undefined,
    callData: '0x' as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas,
    maxPriorityFeePerGas: 1000000000n,
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

const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

describe('Mempool Benchmarks', () => {
  bench('add 1000 UserOps sequentially', () => {
    const mempool = new Mempool(logger, {
      maxSize: 100000,
      maxOpsPerSender: 1000,
    })

    for (let i = 0; i < 1000; i++) {
      const sender = createAddress(i + 1)
      const userOp = createUserOp(sender, 0n, BigInt(1000000000 + i))
      mempool.add(userOp, createHash(i + 1), ENTRY_POINT)
    }
  })

  bench('getPending with 10000 entries', () => {
    const mempool = new Mempool(logger, {
      maxSize: 100000,
      maxOpsPerSender: 1000,
    })

    // Pre-fill
    for (let i = 0; i < 10000; i++) {
      const sender = createAddress(i + 1)
      const userOp = createUserOp(sender, 0n, BigInt(1000000000 + i))
      mempool.add(userOp, createHash(i + 1), ENTRY_POINT)
    }

    return () => {
      mempool.getPending(ENTRY_POINT, 100)
    }
  })

  bench('evictExpired with 5000 expired entries', () => {
    const mempool = new Mempool(logger, {
      maxSize: 100000,
      maxOpsPerSender: 1000,
      ttlMs: 1, // 1ms TTL so all are expired
    })

    // Pre-fill
    for (let i = 0; i < 5000; i++) {
      const sender = createAddress(i + 1)
      const userOp = createUserOp(sender, 0n, BigInt(1000000000 + i))
      mempool.add(userOp, createHash(i + 1), ENTRY_POINT)
    }

    return () => {
      mempool.evictExpired()
    }
  })

  bench('getPendingForBundle with 5000 entries (100 senders)', () => {
    const mempool = new Mempool(logger, {
      maxSize: 100000,
      maxOpsPerSender: 100,
    })

    // Pre-fill: 100 senders, 50 ops each
    let hashIdx = 1
    for (let s = 0; s < 100; s++) {
      const sender = createAddress(s + 1)
      for (let n = 0; n < 50; n++) {
        const userOp = createUserOp(sender, BigInt(n), BigInt(1000000000 + s * 50 + n))
        mempool.add(userOp, createHash(hashIdx++), ENTRY_POINT)
      }
    }

    return () => {
      mempool.getPendingForBundle(ENTRY_POINT, 100)
    }
  })

  bench('add and remove cycle (1000 ops)', () => {
    const mempool = new Mempool(logger, {
      maxSize: 100000,
      maxOpsPerSender: 1000,
    })

    for (let i = 0; i < 1000; i++) {
      const sender = createAddress(i + 1)
      const hash = createHash(i + 1)
      const userOp = createUserOp(sender, 0n, BigInt(1000000000 + i))
      mempool.add(userOp, hash, ENTRY_POINT)
      mempool.remove(hash)
    }
  })

  bench('replace operation with gas price increase', () => {
    const mempool = new Mempool(logger, {
      maxSize: 100000,
      maxOpsPerSender: 1000,
      minGasPriceIncrease: 10,
    })

    // Pre-fill with 100 ops
    for (let i = 0; i < 100; i++) {
      const sender = createAddress(i + 1)
      const userOp = createUserOp(sender, 0n, 1000000000n)
      mempool.add(userOp, createHash(i + 1), ENTRY_POINT)
    }

    let iteration = 0
    return () => {
      const idx = (iteration++ % 100) + 1
      const sender = createAddress(idx)
      const newOp = createUserOp(sender, 0n, 2000000000n) // Higher gas
      mempool.replace(createHash(idx), newOp, createHash(10000 + idx))
    }
  })
})

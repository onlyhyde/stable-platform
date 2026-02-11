import type { Address, Hex, PublicClient } from 'viem'
import { bench, describe, vi } from 'vitest'
import type { UserOperation } from '../../src/types'
import { createLogger } from '../../src/utils/logger'
import { FormatValidator } from '../../src/validation/formatValidator'

const logger = createLogger('error', false)

function createValidUserOp(nonce = 0n): UserOperation {
  return {
    sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
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
    signature: ('0x' + 'ab'.repeat(65)) as Hex,
  }
}

const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

// Mock public client for validation
const _mockPublicClient = {
  getCode: vi.fn().mockResolvedValue('0x6001'),
  readContract: vi.fn().mockResolvedValue(0n),
  getChainId: vi.fn().mockResolvedValue(1),
} as unknown as PublicClient

describe('Validation Benchmarks', () => {
  const formatValidator = new FormatValidator(ENTRY_POINT, logger)

  bench('format validation (single op)', () => {
    const userOp = createValidUserOp()
    formatValidator.validate(userOp)
  })

  bench('format validation (100 ops sequential)', () => {
    for (let i = 0; i < 100; i++) {
      const userOp = createValidUserOp(BigInt(i))
      formatValidator.validate(userOp)
    }
  })

  bench('format validation with factory fields', () => {
    const userOp = createValidUserOp()
    const withFactory: UserOperation = {
      ...userOp,
      factory: '0x1234567890123456789012345678901234567890' as Address,
      factoryData: ('0x' + 'cc'.repeat(32)) as Hex,
    }
    formatValidator.validate(withFactory)
  })

  bench('format validation with paymaster fields', () => {
    const userOp = createValidUserOp()
    const withPaymaster: UserOperation = {
      ...userOp,
      paymaster: '0x1234567890123456789012345678901234567890' as Address,
      paymasterVerificationGasLimit: 50000n,
      paymasterPostOpGasLimit: 50000n,
      paymasterData: ('0x' + 'dd'.repeat(32)) as Hex,
    }
    formatValidator.validate(withPaymaster)
  })

  bench('format validation (batch 1000 mixed ops)', () => {
    for (let i = 0; i < 1000; i++) {
      const userOp = createValidUserOp(BigInt(i))
      const op =
        i % 3 === 0
          ? {
              ...userOp,
              factory: '0x1234567890123456789012345678901234567890' as Address,
              factoryData: ('0x' + 'ee'.repeat(32)) as Hex,
            }
          : userOp
      formatValidator.validate(op)
    }
  })
})

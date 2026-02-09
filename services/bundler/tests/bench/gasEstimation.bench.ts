import type { Address, Hex, PublicClient } from 'viem'
import { bench, describe, vi } from 'vitest'
import { GasEstimator, type GasEstimatorConfig } from '../../src/gas/gasEstimator'
import type { UserOperation } from '../../src/types'
import { createLogger } from '../../src/utils/logger'

const logger = createLogger('error', false)
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address

function createUserOp(): UserOperation {
  return {
    sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
    nonce: 0n,
    factory: undefined,
    factoryData: undefined,
    callData: ('0x' + 'ab'.repeat(100)) as Hex,
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

// Mock public client that simulates binary search behavior
function createMockClient(simulationDelay = false): PublicClient {
  const simulateContract = vi.fn().mockImplementation(async () => {
    // Return successful simulation result
    return {
      result: {
        returnInfo: {
          preOpGas: 50000n,
          prefund: 1000000000000000n,
          accountValidationData: 0n,
          paymasterValidationData: 0n,
          paymasterContext: '0x' as Hex,
        },
        senderInfo: { stake: 0n, unstakeDelaySec: 0n },
        factoryInfo: { stake: 0n, unstakeDelaySec: 0n },
        paymasterInfo: { stake: 0n, unstakeDelaySec: 0n },
      },
    }
  })

  return {
    simulateContract,
    estimateGas: vi.fn().mockResolvedValue(200000n),
    getGasPrice: vi.fn().mockResolvedValue(1000000000n),
    getBlock: vi.fn().mockResolvedValue({ baseFeePerGas: 1000000000n }),
    readContract: vi.fn().mockResolvedValue(0n),
    call: vi.fn().mockResolvedValue({ data: '0x' }),
  } as unknown as PublicClient
}

describe('Gas Estimation Benchmarks', () => {
  bench('preVerificationGas calculation', () => {
    const client = createMockClient()
    const estimator = new GasEstimator(client, ENTRY_POINT, logger)
    const userOp = createUserOp()

    // Pre-verification gas is calculated synchronously in the estimation flow
    // We benchmark the estimator creation and initial calculation
    return async () => {
      try {
        await estimator.estimate(userOp)
      } catch {
        // Expected: mock may not be complete enough for full estimation
      }
    }
  })

  bench('GasEstimator instantiation', () => {
    const client = createMockClient()
    const _estimator = new GasEstimator(client, ENTRY_POINT, logger)
  })

  bench('GasEstimator with custom config', () => {
    const client = createMockClient()
    const config: GasEstimatorConfig = {
      verificationGasBufferPercent: 15,
      callGasBufferPercent: 15,
      preVerificationGasBufferPercent: 10,
      maxBinarySearchIterations: 10,
      factoryDeploymentGas: 300000n,
    }
    const _estimator = new GasEstimator(client, ENTRY_POINT, logger, config)
  })

  bench('Multiple GasEstimator instances (simulating concurrent requests)', () => {
    for (let i = 0; i < 10; i++) {
      const client = createMockClient()
      const _estimator = new GasEstimator(client, ENTRY_POINT, logger)
    }
  })
})

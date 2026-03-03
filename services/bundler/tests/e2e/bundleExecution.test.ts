import type { Account, Address, Hex, Log, PublicClient, WalletClient } from 'viem'
import { encodeAbiParameters } from 'viem'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENT_SIGNATURES } from '../../src/abi'
import { RpcServer } from '../../src/rpc/server'
import type { BundlerConfig } from '../../src/types'
import { createLogger } from '../../src/utils/logger'

// Mock logger
const mockLogger = createLogger('error', false)

// Test constants
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const BENEFICIARY = '0x1234567890123456789012345678901234567890' as Address
const TEST_SENDER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address
const TEST_SENDER_2 = '0x1111111111111111111111111111111111111111' as Address
const TEST_SENDER_3 = '0x2222222222222222222222222222222222222222' as Address
const TEST_PAYMASTER = '0x3333333333333333333333333333333333333333' as Address
const TEST_ACCOUNT = '0x9999999999999999999999999999999999999999' as Address
const TEST_PORT = 0 // Use dynamic port to avoid EADDRINUSE

/**
 * Build ABI-encoded ValidationResult return data (no selector prefix).
 * v0.9: EntryPointSimulations returns normal data via state override.
 */
function buildValidationResultReturnData(): Hex {
  return encodeAbiParameters(
    [
      {
        name: 'result',
        type: 'tuple',
        components: [
          {
            name: 'returnInfo',
            type: 'tuple',
            components: [
              { name: 'preOpGas', type: 'uint256' },
              { name: 'prefund', type: 'uint256' },
              { name: 'accountValidationData', type: 'uint256' },
              { name: 'paymasterValidationData', type: 'uint256' },
              { name: 'paymasterContext', type: 'bytes' },
            ],
          },
          {
            name: 'senderInfo',
            type: 'tuple',
            components: [
              { name: 'stake', type: 'uint256' },
              { name: 'unstakeDelaySec', type: 'uint256' },
            ],
          },
          {
            name: 'factoryInfo',
            type: 'tuple',
            components: [
              { name: 'stake', type: 'uint256' },
              { name: 'unstakeDelaySec', type: 'uint256' },
            ],
          },
          {
            name: 'paymasterInfo',
            type: 'tuple',
            components: [
              { name: 'stake', type: 'uint256' },
              { name: 'unstakeDelaySec', type: 'uint256' },
            ],
          },
          {
            name: 'aggregatorInfo',
            type: 'tuple',
            components: [
              { name: 'aggregator', type: 'address' },
              {
                name: 'stakeInfo',
                type: 'tuple',
                components: [
                  { name: 'stake', type: 'uint256' },
                  { name: 'unstakeDelaySec', type: 'uint256' },
                ],
              },
            ],
          },
        ],
      },
    ],
    [
      {
        returnInfo: {
          preOpGas: 100n,
          prefund: 200n,
          accountValidationData: 0n,
          paymasterValidationData: 0n,
          paymasterContext: '0x',
        },
        senderInfo: { stake: 1n, unstakeDelaySec: 2n },
        factoryInfo: { stake: 3n, unstakeDelaySec: 4n },
        paymasterInfo: { stake: 5n, unstakeDelaySec: 6n },
        aggregatorInfo: {
          aggregator: TEST_ACCOUNT,
          stakeInfo: { stake: 7n, unstakeDelaySec: 8n },
        },
      },
    ]
  )
}

// Helper to create a packed UserOperation for RPC
function createPackedUserOp(
  overrides: Partial<Record<string, Hex | Address>> = {}
): Record<string, Hex> {
  return {
    sender: TEST_SENDER,
    nonce: '0x0',
    factory: '0x',
    factoryData: '0x',
    callData: '0x',
    callGasLimit: '0x186a0', // 100000
    verificationGasLimit: '0x186a0', // 100000
    preVerificationGas: '0xc350', // 50000
    maxFeePerGas: '0x3b9aca00', // 1 gwei
    maxPriorityFeePerGas: '0x3b9aca00', // 1 gwei
    paymaster: '0x',
    paymasterVerificationGasLimit: '0x',
    paymasterPostOpGasLimit: '0x',
    paymasterData: '0x',
    signature: ('0x' + '00'.repeat(65)) as Hex,
    ...overrides,
  } as Record<string, Hex>
}

// Helper to make JSON-RPC request
async function rpcCall(
  port: number,
  method: string,
  params: unknown[] = []
): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
  const response = await fetch(`http://127.0.0.1:${port}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  })
  return response.json()
}

describe('Bundle Execution E2E', () => {
  let mockPublicClient: PublicClient
  let mockWalletClient: WalletClient
  let server: RpcServer
  let config: BundlerConfig
  let lastTxHash: Hex
  let bundleCallCount: number
  let testPort: number

  // Store UserOperationEvent logs for testing
  const userOpEventLogs: Map<Hex, { success: boolean; actualGasCost: bigint }> = new Map()

  beforeAll(async () => {
    lastTxHash = ('0x' + '00'.repeat(32)) as Hex
    bundleCallCount = 0

    // Setup mock clients with more realistic behavior
    mockPublicClient = {
      getChainId: vi.fn().mockResolvedValue(1),
      getCode: vi.fn().mockResolvedValue('0x1234' as Hex),
      readContract: vi.fn().mockResolvedValue(0n), // nonce = 0
      estimateGas: vi.fn().mockResolvedValue(200000n),
      call: vi.fn().mockImplementation(async () => {
        // v0.9: EntryPointSimulations returns validation result as normal return
        // via state override (not revert)
        return { data: buildValidationResultReturnData() }
      }),
      getTransactionReceipt: vi.fn().mockImplementation(async ({ hash }: { hash: Hex }) => ({
        status: 'success',
        blockNumber: 12345n,
        blockHash: '0xblockhash' as Hex,
        transactionHash: hash,
        transactionIndex: 0,
        from: TEST_ACCOUNT,
        to: ENTRY_POINT,
        gasUsed: 150000n,
        cumulativeGasUsed: 150000n,
        effectiveGasPrice: 1000000000n,
        logs: [],
      })),
      waitForTransactionReceipt: vi.fn().mockImplementation(async ({ hash }: { hash: Hex }) => {
        // Generate UserOperationEvent logs based on stored data
        const logs: Log[] = []

        // Get all pending events for this transaction
        for (const [userOpHash, eventData] of userOpEventLogs) {
          logs.push({
            address: ENTRY_POINT,
            topics: [
              EVENT_SIGNATURES.UserOperationEvent as Hex,
              userOpHash, // indexed userOpHash
              TEST_SENDER as Hex, // indexed sender (padded)
              '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex, // indexed paymaster
            ] as [Hex, ...Hex[]],
            data: ('0x' +
              '0000000000000000000000000000000000000000000000000000000000000000' + // nonce
              (eventData.success
                ? '0000000000000000000000000000000000000000000000000000000000000001'
                : '0000000000000000000000000000000000000000000000000000000000000000') + // success
              '0000000000000000000000000000000000000000000000000000000002faf080' + // actualGasCost
              '0000000000000000000000000000000000000000000000000000000000030d40') as Hex, // actualGasUsed
            blockHash: '0xblockhash' as Hex,
            blockNumber: 12345n,
            transactionHash: hash,
            transactionIndex: 0,
            logIndex: logs.length,
            removed: false,
          })
        }

        return {
          status: 'success',
          blockNumber: 12345n,
          blockHash: '0xblockhash' as Hex,
          transactionHash: hash,
          transactionIndex: 0,
          from: TEST_ACCOUNT,
          to: ENTRY_POINT,
          gasUsed: 150000n,
          cumulativeGasUsed: 150000n,
          effectiveGasPrice: 1000000000n,
          logs,
        }
      }),
    } as unknown as PublicClient

    mockWalletClient = {
      account: { address: TEST_ACCOUNT } as Account,
      chain: { id: 1 },
      sendTransaction: vi.fn().mockImplementation(async () => {
        bundleCallCount++
        lastTxHash = `0x${bundleCallCount.toString(16).padStart(64, '0')}` as Hex
        return lastTxHash
      }),
    } as unknown as WalletClient

    config = {
      entryPoints: [ENTRY_POINT],
      beneficiary: BENEFICIARY,
      port: TEST_PORT,
      maxBundleSize: 10,
      bundleInterval: 60000, // Long interval (1 min) to prevent auto-bundling during tests
      debug: true,
    }

    server = new RpcServer(mockPublicClient, mockWalletClient, config, mockLogger)
    await server.start()
    testPort = server.getPort()
  })

  afterAll(async () => {
    await server.stop()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    userOpEventLogs.clear()
    bundleCallCount = 0
    await rpcCall(testPort, 'debug_bundler_clearState')
    await rpcCall(testPort, 'debug_bundler_clearReputation')
  })

  describe('Full UserOperation Flow', () => {
    it('should process UserOperation from submission to mempool inclusion', async () => {
      const packedOp = createPackedUserOp()

      // Step 1: Submit UserOperation
      const { result: userOpHash, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(error).toBeUndefined()
      expect(userOpHash).toBeDefined()
      expect(typeof userOpHash).toBe('string')

      // Step 2: Verify in mempool with pending status
      const { result: mempool } = await rpcCall(testPort, 'debug_bundler_dumpMempool', [
        ENTRY_POINT,
      ])

      const mempoolArray = mempool as Array<{ userOpHash: Hex; status: string }>
      expect(mempoolArray.length).toBe(1)
      expect(mempoolArray[0].userOpHash).toBe(userOpHash)
      expect(mempoolArray[0].status).toBe('pending')
    })

    it('should return null for getUserOperationByHash when UserOp has no transaction hash', async () => {
      const packedOp = createPackedUserOp()

      // Submit UserOperation
      const { result: userOpHash } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      // Get by hash - should return null since not yet included
      const { result, error } = await rpcCall(testPort, 'eth_getUserOperationByHash', [userOpHash])

      expect(error).toBeUndefined()
      expect(result).toBeNull()
    })

    it('should reject UserOperation with nonce too far in future', async () => {
      // Mock nonce check to return specific value
      vi.mocked(mockPublicClient.readContract).mockResolvedValueOnce(0n)

      const packedOp = createPackedUserOp({
        nonce: '0x64', // nonce 100, but on-chain is 0
      })

      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      // Should be rejected due to nonce gap (default maxNonceGap is 10)
      expect(result).toBeUndefined()
      expect(error).toBeDefined()
    })
  })

  describe('Multiple UserOperations', () => {
    it('should accept multiple UserOperations from different senders', async () => {
      const op1 = createPackedUserOp({ sender: TEST_SENDER as Hex })
      const op2 = createPackedUserOp({ sender: TEST_SENDER_2 as Hex })
      const op3 = createPackedUserOp({ sender: TEST_SENDER_3 as Hex })

      // Submit all operations
      const { result: hash1 } = await rpcCall(testPort, 'eth_sendUserOperation', [
        op1,
        ENTRY_POINT,
      ])
      const { result: hash2 } = await rpcCall(testPort, 'eth_sendUserOperation', [
        op2,
        ENTRY_POINT,
      ])
      const { result: hash3 } = await rpcCall(testPort, 'eth_sendUserOperation', [
        op3,
        ENTRY_POINT,
      ])

      expect(hash1).toBeDefined()
      expect(hash2).toBeDefined()
      expect(hash3).toBeDefined()

      // Verify all in mempool
      const { result: mempool } = await rpcCall(testPort, 'debug_bundler_dumpMempool', [
        ENTRY_POINT,
      ])
      const mempoolArray = mempool as Array<{ userOpHash: Hex }>
      expect(mempoolArray.length).toBe(3)
    })

    it('should accept sequential nonces from same sender', async () => {
      const op1 = createPackedUserOp({ sender: TEST_SENDER as Hex, nonce: '0x0' })
      const op2 = createPackedUserOp({ sender: TEST_SENDER as Hex, nonce: '0x1' })

      const { result: hash1 } = await rpcCall(testPort, 'eth_sendUserOperation', [
        op1,
        ENTRY_POINT,
      ])
      const { result: hash2 } = await rpcCall(testPort, 'eth_sendUserOperation', [
        op2,
        ENTRY_POINT,
      ])

      expect(hash1).toBeDefined()
      expect(hash2).toBeDefined()

      // Verify both in mempool
      const { result: mempool } = await rpcCall(testPort, 'debug_bundler_dumpMempool', [
        ENTRY_POINT,
      ])
      expect((mempool as unknown[]).length).toBe(2)
    })
  })

  describe('Gas Estimation Scenarios', () => {
    it('should estimate gas for UserOperation without paymaster', async () => {
      const packedOp = createPackedUserOp()

      const { result, error } = await rpcCall(testPort, 'eth_estimateUserOperationGas', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(error).toBeUndefined()
      const gasResult = result as {
        preVerificationGas: Hex
        verificationGasLimit: Hex
        callGasLimit: Hex
        paymasterVerificationGasLimit?: Hex
        paymasterPostOpGasLimit?: Hex
      }

      // Should have basic gas fields
      expect(gasResult.preVerificationGas).toBeDefined()
      expect(gasResult.verificationGasLimit).toBeDefined()
      expect(gasResult.callGasLimit).toBeDefined()

      // Should NOT have paymaster gas when no paymaster
      expect(gasResult.paymasterVerificationGasLimit).toBeUndefined()
      expect(gasResult.paymasterPostOpGasLimit).toBeUndefined()
    })

    it('should estimate gas for UserOperation with paymaster', async () => {
      const packedOp = createPackedUserOp({
        paymaster: TEST_PAYMASTER as Hex,
        paymasterVerificationGasLimit: '0x186a0', // 100000
        paymasterPostOpGasLimit: '0xc350', // 50000
        paymasterData: '0x1234' as Hex,
      })

      const { result, error } = await rpcCall(testPort, 'eth_estimateUserOperationGas', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(error).toBeUndefined()
      const gasResult = result as {
        preVerificationGas: Hex
        verificationGasLimit: Hex
        callGasLimit: Hex
        paymasterVerificationGasLimit?: Hex
        paymasterPostOpGasLimit?: Hex
      }

      expect(gasResult.preVerificationGas).toBeDefined()
      expect(gasResult.verificationGasLimit).toBeDefined()
      expect(gasResult.callGasLimit).toBeDefined()
      // Paymaster gas should be returned when paymaster is present
      expect(gasResult.paymasterVerificationGasLimit).toBeDefined()
      expect(gasResult.paymasterPostOpGasLimit).toBeDefined()
    })
  })

  describe('Reputation System Integration', () => {
    it('should reject UserOperation when factory is banned', async () => {
      const testFactory = '0x4444444444444444444444444444444444444444' as Address

      // Ban factory
      await rpcCall(testPort, 'debug_bundler_setReputation', [
        [{ address: testFactory, opsSeen: 100, opsIncluded: 0, status: 'banned' }],
      ])

      const packedOp = createPackedUserOp({
        factory: testFactory as Hex,
        factoryData: '0x1234' as Hex,
      })

      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(result).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.code).toBe(-32504) // BANNED_OR_THROTTLED
    })

    it('should reject UserOperation when paymaster is banned', async () => {
      // Ban paymaster
      await rpcCall(testPort, 'debug_bundler_setReputation', [
        [{ address: TEST_PAYMASTER, opsSeen: 100, opsIncluded: 0, status: 'banned' }],
      ])

      const packedOp = createPackedUserOp({
        paymaster: TEST_PAYMASTER as Hex,
        paymasterVerificationGasLimit: '0x186a0',
        paymasterPostOpGasLimit: '0xc350',
        paymasterData: '0x' as Hex,
      })

      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(result).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.code).toBe(-32504) // BANNED_OR_THROTTLED
    })

    it('should allow UserOperation when entities have good reputation', async () => {
      // Set good reputation for sender
      await rpcCall(testPort, 'debug_bundler_setReputation', [
        [{ address: TEST_SENDER, opsSeen: 10, opsIncluded: 10, status: 'ok' }],
      ])

      const packedOp = createPackedUserOp()

      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(error).toBeUndefined()
      expect(result).toBeDefined()
    })
  })

  describe('Paymaster Integration', () => {
    it('should accept UserOperation with valid paymaster fields', async () => {
      const packedOp = createPackedUserOp({
        paymaster: TEST_PAYMASTER as Hex,
        paymasterVerificationGasLimit: '0x186a0', // 100000
        paymasterPostOpGasLimit: '0xc350', // 50000
        paymasterData: '0x1234567890' as Hex,
      })

      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(error).toBeUndefined()
      expect(result).toBeDefined()
    })

    it('should reject UserOperation with paymaster but missing gas limits', async () => {
      const packedOp = createPackedUserOp({
        paymaster: TEST_PAYMASTER as Hex,
        // Missing paymasterVerificationGasLimit and paymasterPostOpGasLimit
        paymasterData: '0x1234' as Hex,
      })

      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      // Should fail validation due to missing paymaster gas limits
      expect(result).toBeUndefined()
      expect(error).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      // Create UserOp with invalid signature length
      const packedOp = createPackedUserOp({
        signature: '0x00' as Hex, // Too short
      })

      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(result).toBeUndefined()
      expect(error).toBeDefined()
    })

    it('should return proper error codes for different failure types', async () => {
      // Test invalid params error
      const { error: invalidParamsError } = await rpcCall(
        testPort,
        'eth_sendUserOperation',
        [createPackedUserOp(), '0x0000000000000000000000000000000000000001'] // Invalid entry point
      )
      expect(invalidParamsError?.code).toBe(-32602) // INVALID_PARAMS

      // Test banned sender error
      await rpcCall(testPort, 'debug_bundler_setReputation', [
        [{ address: TEST_SENDER_2, opsSeen: 100, opsIncluded: 0, status: 'banned' }],
      ])
      const { error: bannedError } = await rpcCall(testPort, 'eth_sendUserOperation', [
        createPackedUserOp({ sender: TEST_SENDER_2 as Hex }),
        ENTRY_POINT,
      ])
      expect(bannedError?.code).toBe(-32504) // BANNED_OR_THROTTLED
    })
  })

  describe('Mempool Management', () => {
    it('should respect maxOpsPerSender limit', async () => {
      // Default maxOpsPerSender is 4
      const ops = Array.from({ length: 5 }, (_, i) =>
        createPackedUserOp({ sender: TEST_SENDER as Hex, nonce: `0x${i}` as Hex })
      )

      // First 4 should succeed
      for (let i = 0; i < 4; i++) {
        const { error } = await rpcCall(testPort, 'eth_sendUserOperation', [ops[i], ENTRY_POINT])
        expect(error).toBeUndefined()
      }

      // 5th should fail (exceeds maxOpsPerSender)
      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        ops[4],
        ENTRY_POINT,
      ])

      expect(result).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toContain('sender has too many pending operations')
    })

    // Note: Same sender+nonce with different gas prices creates different userOpHash
    // The RPC server currently accepts both as separate operations
    // Replacement by nonce could be implemented in RPC server to call mempool.replace()
    it('should accept operations with same sender+nonce but different gas prices as separate operations', async () => {
      const op1 = createPackedUserOp({
        sender: TEST_SENDER as Hex,
        nonce: '0x0',
        maxFeePerGas: '0x3b9aca00', // 1 gwei
      })

      const op2 = createPackedUserOp({
        sender: TEST_SENDER as Hex,
        nonce: '0x0',
        maxFeePerGas: '0x77359400', // 2 gwei
        signature: ('0x' + '01'.repeat(65)) as Hex, // Different signature = different hash
      })

      // Submit first operation
      const { result: hash1 } = await rpcCall(testPort, 'eth_sendUserOperation', [
        op1,
        ENTRY_POINT,
      ])
      expect(hash1).toBeDefined()

      // Submit second operation with same nonce (different hash due to different signature/gas)
      const { result: hash2 } = await rpcCall(testPort, 'eth_sendUserOperation', [
        op2,
        ENTRY_POINT,
      ])
      expect(hash2).toBeDefined()

      // Both are in mempool (different hashes, though same nonce is allowed if < maxOpsPerSender)
      const { result: mempool } = await rpcCall(testPort, 'debug_bundler_dumpMempool', [
        ENTRY_POINT,
      ])
      expect((mempool as unknown[]).length).toBe(2)
    })

    it('should reject duplicate userOpHash', async () => {
      const op = createPackedUserOp({
        sender: TEST_SENDER as Hex,
        nonce: '0x0',
      })

      // Submit first time
      const { result: hash1 } = await rpcCall(testPort, 'eth_sendUserOperation', [op, ENTRY_POINT])
      expect(hash1).toBeDefined()

      // Submit exact same operation again (same hash)
      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [op, ENTRY_POINT])

      expect(result).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toContain('already in mempool')
    })
  })
})

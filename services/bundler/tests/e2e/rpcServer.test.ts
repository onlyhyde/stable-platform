import type { Account, Address, Hex, PublicClient, WalletClient } from 'viem'
import { encodeAbiParameters } from 'viem'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { RpcServer } from '../../src/rpc/server'
import type { BundlerConfig } from '../../src/types'
import { createLogger } from '../../src/utils/logger'

// Mock logger
const mockLogger = createLogger('error', false)

// Test constants
const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address
const BENEFICIARY = '0x1234567890123456789012345678901234567890' as Address
const TEST_SENDER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address
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
function createPackedUserOp(overrides: Partial<Record<string, Hex>> = {}): Record<string, Hex> {
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
  }
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

describe('RPC Server E2E', () => {
  let mockPublicClient: PublicClient
  let mockWalletClient: WalletClient
  let server: RpcServer
  let config: BundlerConfig
  let testPort: number

  beforeAll(async () => {
    // Setup mock clients
    mockPublicClient = {
      getChainId: vi.fn().mockResolvedValue(1),
      getCode: vi.fn().mockResolvedValue('0x1234' as Hex),
      readContract: vi.fn().mockResolvedValue(0n), // nonce = 0
      estimateGas: vi.fn().mockResolvedValue(100000n),
      call: vi.fn().mockImplementation(async () => {
        // v0.9: EntryPointSimulations returns validation result as normal return
        // via state override (not revert)
        return { data: buildValidationResultReturnData() }
      }),
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'success',
        blockNumber: 12345n,
        blockHash: '0xblockhash' as Hex,
        transactionHash: '0xtxhash' as Hex,
        transactionIndex: 0,
        from: TEST_ACCOUNT,
        to: ENTRY_POINT,
        gasUsed: 100000n,
        cumulativeGasUsed: 100000n,
        effectiveGasPrice: 1000000000n,
        logs: [],
      }),
    } as unknown as PublicClient

    mockWalletClient = {
      account: { address: TEST_ACCOUNT } as Account,
      chain: { id: 1 },
      sendTransaction: vi.fn().mockResolvedValue('0xtxhash123' as Hex),
    } as unknown as WalletClient

    config = {
      entryPoints: [ENTRY_POINT],
      beneficiary: BENEFICIARY,
      port: TEST_PORT,
      maxBundleSize: 10,
      bundleInterval: 60000, // 1 minute (won't trigger during tests)
      debug: true,
    }

    server = new RpcServer(mockPublicClient, mockWalletClient, config, mockLogger)
    await server.start()
    testPort = server.getPort()
  })

  afterAll(async () => {
    await server.stop()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Server Lifecycle', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`http://127.0.0.1:${testPort}/health`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('ok')
      expect(data.mempool).toBeDefined()
      expect(data.mempool.size).toBeGreaterThanOrEqual(0)
    })
  })

  describe('eth_chainId', () => {
    it('should return chain ID in hex format', async () => {
      const { result, error } = await rpcCall(testPort, 'eth_chainId')

      expect(error).toBeUndefined()
      expect(result).toBe('0x1') // Chain ID 1
    })
  })

  describe('eth_supportedEntryPoints', () => {
    it('should return configured entry points', async () => {
      const { result, error } = await rpcCall(testPort, 'eth_supportedEntryPoints')

      expect(error).toBeUndefined()
      expect(result).toEqual([ENTRY_POINT])
    })
  })

  describe('eth_estimateUserOperationGas', () => {
    it('should return gas estimates for valid UserOperation', async () => {
      const packedOp = createPackedUserOp()

      const { result, error } = await rpcCall(testPort, 'eth_estimateUserOperationGas', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(error).toBeUndefined()
      expect(result).toBeDefined()

      const gasResult = result as {
        preVerificationGas: Hex
        verificationGasLimit: Hex
        callGasLimit: Hex
      }

      // Gas estimates should be hex strings
      expect(gasResult.preVerificationGas).toMatch(/^0x[0-9a-f]+$/i)
      expect(gasResult.verificationGasLimit).toMatch(/^0x[0-9a-f]+$/i)
      expect(gasResult.callGasLimit).toMatch(/^0x[0-9a-f]+$/i)

      // Gas values should be reasonable (> 0)
      expect(BigInt(gasResult.preVerificationGas)).toBeGreaterThan(0n)
      expect(BigInt(gasResult.verificationGasLimit)).toBeGreaterThan(0n)
      expect(BigInt(gasResult.callGasLimit)).toBeGreaterThan(0n)
    })

    it('should reject unsupported entry point', async () => {
      const packedOp = createPackedUserOp()
      const unsupportedEntryPoint = '0x0000000000000000000000000000000000000001' as Address

      const { result, error } = await rpcCall(testPort, 'eth_estimateUserOperationGas', [
        packedOp,
        unsupportedEntryPoint,
      ])

      expect(result).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.code).toBe(-32602) // INVALID_PARAMS
      expect(error?.message).toContain('not supported')
    })
  })

  describe('eth_sendUserOperation', () => {
    beforeEach(async () => {
      // Clear mempool before each test
      await rpcCall(testPort, 'debug_bundler_clearState')
    })

    it('should accept valid UserOperation and return hash', async () => {
      const packedOp = createPackedUserOp()

      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(error).toBeUndefined()
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect((result as string).startsWith('0x')).toBe(true)
      expect((result as string).length).toBe(66) // 32 bytes + '0x'
    })

    it('should add UserOperation to mempool', async () => {
      const packedOp = createPackedUserOp()

      // Send UserOperation
      const { result: userOpHash } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      // Check mempool
      const { result: mempool } = await rpcCall(testPort, 'debug_bundler_dumpMempool', [
        ENTRY_POINT,
      ])

      expect(mempool).toBeDefined()
      const mempoolArray = mempool as Array<{ userOpHash: Hex; status: string }>
      expect(mempoolArray.length).toBe(1)
      expect(mempoolArray[0].userOpHash).toBe(userOpHash)
      expect(mempoolArray[0].status).toBe('pending')
    })

    it('should reject duplicate UserOperation', async () => {
      const packedOp = createPackedUserOp()

      // Send first time - should succeed
      const { error: error1 } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])
      expect(error1).toBeUndefined()

      // Send second time - should fail
      const { result, error: error2 } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(result).toBeUndefined()
      expect(error2).toBeDefined()
      expect(error2?.message).toContain('already in mempool')
    })

    it('should reject unsupported entry point', async () => {
      const packedOp = createPackedUserOp()
      const unsupportedEntryPoint = '0x0000000000000000000000000000000000000001' as Address

      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        unsupportedEntryPoint,
      ])

      expect(result).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.code).toBe(-32602)
    })

    it('should reject UserOperation with invalid sender address', async () => {
      const packedOp = createPackedUserOp({
        sender: '0xinvalid' as Hex,
      })

      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(result).toBeUndefined()
      expect(error).toBeDefined()
    })

    it('should reject UserOperation when sender is banned', async () => {
      // First, set sender as banned
      await rpcCall(testPort, 'debug_bundler_setReputation', [
        [{ address: TEST_SENDER, opsSeen: 100, opsIncluded: 0, status: 'banned' }],
      ])

      const packedOp = createPackedUserOp()

      const { result, error } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      expect(result).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.code).toBe(-32504) // BANNED_OR_THROTTLED

      // Clean up
      await rpcCall(testPort, 'debug_bundler_clearReputation')
    })
  })

  describe('eth_getUserOperationByHash', () => {
    it('should return null for unknown hash', async () => {
      const unknownHash = '0x' + '00'.repeat(32)

      const { result, error } = await rpcCall(testPort, 'eth_getUserOperationByHash', [
        unknownHash,
      ])

      expect(error).toBeUndefined()
      expect(result).toBeNull()
    })
  })

  describe('eth_getUserOperationReceipt', () => {
    it('should return null for unknown hash', async () => {
      const unknownHash = '0x' + '00'.repeat(32)

      const { result, error } = await rpcCall(testPort, 'eth_getUserOperationReceipt', [
        unknownHash,
      ])

      expect(error).toBeUndefined()
      expect(result).toBeNull()
    })

    it('should return null for pending UserOperation', async () => {
      // Clear state
      await rpcCall(testPort, 'debug_bundler_clearState')

      // Send UserOperation
      const packedOp = createPackedUserOp()
      const { result: userOpHash } = await rpcCall(testPort, 'eth_sendUserOperation', [
        packedOp,
        ENTRY_POINT,
      ])

      // Try to get receipt (should be null since not yet included)
      const { result, error } = await rpcCall(testPort, 'eth_getUserOperationReceipt', [
        userOpHash,
      ])

      expect(error).toBeUndefined()
      expect(result).toBeNull()
    })
  })

  describe('Debug Methods', () => {
    beforeEach(async () => {
      await rpcCall(testPort, 'debug_bundler_clearState')
      await rpcCall(testPort, 'debug_bundler_clearReputation')
    })

    describe('debug_bundler_clearState', () => {
      it('should clear mempool', async () => {
        // Add an operation
        const packedOp = createPackedUserOp()
        await rpcCall(testPort, 'eth_sendUserOperation', [packedOp, ENTRY_POINT])

        // Verify it's in mempool
        const { result: mempoolBefore } = await rpcCall(testPort, 'debug_bundler_dumpMempool', [
          ENTRY_POINT,
        ])
        expect((mempoolBefore as unknown[]).length).toBe(1)

        // Clear state
        const { result } = await rpcCall(testPort, 'debug_bundler_clearState')
        expect(result).toEqual({ success: true })

        // Verify mempool is empty
        const { result: mempoolAfter } = await rpcCall(testPort, 'debug_bundler_dumpMempool', [
          ENTRY_POINT,
        ])
        expect((mempoolAfter as unknown[]).length).toBe(0)
      })
    })

    describe('debug_bundler_dumpMempool', () => {
      it('should return empty array when mempool is empty', async () => {
        const { result, error } = await rpcCall(testPort, 'debug_bundler_dumpMempool', [
          ENTRY_POINT,
        ])

        expect(error).toBeUndefined()
        expect(result).toEqual([])
      })

      it('should return all operations in mempool', async () => {
        // Add operations
        const op1 = createPackedUserOp({ nonce: '0x0' })
        const op2 = createPackedUserOp({
          nonce: '0x1',
          sender: '0x1111111111111111111111111111111111111111' as Address,
        })

        await rpcCall(testPort, 'eth_sendUserOperation', [op1, ENTRY_POINT])
        await rpcCall(testPort, 'eth_sendUserOperation', [op2, ENTRY_POINT])

        const { result } = await rpcCall(testPort, 'debug_bundler_dumpMempool', [ENTRY_POINT])

        expect(result).toBeDefined()
        expect((result as unknown[]).length).toBe(2)
      })
    })

    describe('debug_bundler_setReputation', () => {
      it('should set reputation entries', async () => {
        const testAddress = '0x1234567890123456789012345678901234567890' as Address

        const { result } = await rpcCall(testPort, 'debug_bundler_setReputation', [
          [{ address: testAddress, opsSeen: 50, opsIncluded: 10, status: 'throttled' }],
        ])

        expect(result).toEqual({ success: true })

        // Verify reputation was set
        const { result: dump } = await rpcCall(testPort, 'debug_bundler_dumpReputation', [
          ENTRY_POINT,
        ])

        const entries = dump as Array<{ address: Address; opsSeen: number; status: string }>
        const entry = entries.find((e) => e.address === testAddress)
        expect(entry).toBeDefined()
        expect(entry?.opsSeen).toBe(50)
        expect(entry?.status).toBe('throttled')
      })
    })

    describe('debug_bundler_dumpReputation', () => {
      it('should return all reputation entries', async () => {
        // Set some reputation
        const address1 = '0x1111111111111111111111111111111111111111' as Address
        const address2 = '0x2222222222222222222222222222222222222222' as Address

        await rpcCall(testPort, 'debug_bundler_setReputation', [
          [
            { address: address1, opsSeen: 10, opsIncluded: 5 },
            { address: address2, opsSeen: 20, opsIncluded: 15 },
          ],
        ])

        const { result } = await rpcCall(testPort, 'debug_bundler_dumpReputation', [ENTRY_POINT])

        expect(result).toBeDefined()
        expect((result as unknown[]).length).toBeGreaterThanOrEqual(2)
      })
    })

    describe('debug_bundler_clearReputation', () => {
      it('should clear all reputation entries', async () => {
        // Set reputation
        await rpcCall(testPort, 'debug_bundler_setReputation', [
          [{ address: TEST_SENDER, opsSeen: 10, opsIncluded: 5 }],
        ])

        // Clear reputation
        const { result } = await rpcCall(testPort, 'debug_bundler_clearReputation')
        expect(result).toEqual({ success: true })

        // Verify cleared
        const { result: dump } = await rpcCall(testPort, 'debug_bundler_dumpReputation', [
          ENTRY_POINT,
        ])
        expect((dump as unknown[]).length).toBe(0)
      })
    })
  })

  describe('Error Handling', () => {
    it('should return error for unknown method', async () => {
      const { result, error } = await rpcCall(testPort, 'unknown_method')

      expect(result).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.code).toBe(-32601) // METHOD_NOT_FOUND
      expect(error?.message).toContain('not found')
    })

    it('should handle batch requests', async () => {
      const response = await fetch(`http://127.0.0.1:${testPort}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { jsonrpc: '2.0', id: 1, method: 'eth_chainId' },
          { jsonrpc: '2.0', id: 2, method: 'eth_supportedEntryPoints' },
        ]),
      })

      const results = await response.json()

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(2)
      expect(results[0].result).toBe('0x1')
      expect(results[1].result).toEqual([ENTRY_POINT])
    })
  })
})

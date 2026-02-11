import type { Address, Hex, LocalAccount } from 'viem'
import { encodeFunctionData } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSessionKeyExecutor,
  generateSessionKey,
  sessionKeyFromPrivateKey,
} from '../src/sessionKeyExecutor'
import type { ExecutionRequest, PermissionInput } from '../src/types'

describe('session-keys plugin', () => {
  let testPrivateKey: Hex
  let testSessionKey: LocalAccount
  const testExecutorAddress = '0x1234567890123456789012345678901234567890' as Address
  const testAccountAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address
  const testTargetAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address
  const testChainId = 1n

  beforeEach(async () => {
    testPrivateKey = generatePrivateKey()
    testSessionKey = privateKeyToAccount(testPrivateKey)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('createSessionKeyExecutor', () => {
    it('should create an executor with correct properties', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      expect(executor.executorAddress).toBe(testExecutorAddress)
      expect(executor.chainId).toBe(testChainId)
    })

    it('should have all required methods', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      // Management functions
      expect(executor.encodeAddSessionKey).toBeDefined()
      expect(executor.encodeRevokeSessionKey).toBeDefined()
      expect(executor.encodeGrantPermission).toBeDefined()
      expect(executor.encodeRevokePermission).toBeDefined()

      // Read functions
      expect(executor.getSessionKey).toBeDefined()
      expect(executor.getSessionKeyState).toBeDefined()
      expect(executor.hasPermission).toBeDefined()
      expect(executor.getActiveSessionKeys).toBeDefined()
      expect(executor.getRemainingSpendingLimit).toBeDefined()

      // Execution functions
      expect(executor.signExecution).toBeDefined()
      expect(executor.encodeExecuteOnBehalf).toBeDefined()
      expect(executor.encodeExecuteAsSessionKey).toBeDefined()
    })
  })

  describe('encodeAddSessionKey', () => {
    it('should encode add session key call data', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const callData = executor.encodeAddSessionKey({
        sessionKey: testSessionKey,
        validUntil: BigInt(Math.floor(Date.now() / 1000) + 3600),
        spendingLimit: 1000000000000000000n, // 1 ETH
      })

      expect(callData).toMatch(/^0x/)
      expect(callData.length).toBeGreaterThan(10) // Should have actual encoded data
    })

    it('should use default values when not provided', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const callData = executor.encodeAddSessionKey({
        sessionKey: testSessionKey,
      })

      expect(callData).toMatch(/^0x/)
    })

    it('should encode different session keys differently', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const sessionKey1 = privateKeyToAccount(generatePrivateKey())
      const sessionKey2 = privateKeyToAccount(generatePrivateKey())

      const callData1 = executor.encodeAddSessionKey({ sessionKey: sessionKey1 })
      const callData2 = executor.encodeAddSessionKey({ sessionKey: sessionKey2 })

      expect(callData1).not.toBe(callData2)
    })
  })

  describe('encodeRevokeSessionKey', () => {
    it('should encode revoke session key call data', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const callData = executor.encodeRevokeSessionKey(testSessionKey.address)

      expect(callData).toMatch(/^0x/)
      // Should contain the session key address
      expect(callData.toLowerCase()).toContain(testSessionKey.address.slice(2).toLowerCase())
    })
  })

  describe('encodeGrantPermission', () => {
    it('should encode grant permission call data', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const permission: PermissionInput = {
        target: testTargetAddress,
        selector: '0xa9059cbb', // transfer function
        maxValue: 1000000000000000000n, // 1 ETH
      }

      const callData = executor.encodeGrantPermission(testSessionKey.address, permission)

      expect(callData).toMatch(/^0x/)
    })

    it('should use default values for optional permission fields', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const permission: PermissionInput = {
        target: testTargetAddress,
      }

      const callData = executor.encodeGrantPermission(testSessionKey.address, permission)

      expect(callData).toMatch(/^0x/)
    })
  })

  describe('encodeRevokePermission', () => {
    it('should encode revoke permission call data', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const callData = executor.encodeRevokePermission(
        testSessionKey.address,
        testTargetAddress,
        '0xa9059cbb' as Hex
      )

      expect(callData).toMatch(/^0x/)
    })
  })

  describe('signExecution', () => {
    it('should sign execution request', async () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const request: ExecutionRequest = {
        target: testTargetAddress,
        value: 0n,
        data: '0x' as Hex,
      }

      const signature = await executor.signExecution(
        testSessionKey,
        testAccountAddress,
        request,
        0n
      )

      // Signature should be 65 bytes (130 hex chars + 0x prefix)
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/)
    })

    it('should produce different signatures for different requests', async () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const request1: ExecutionRequest = {
        target: testTargetAddress,
        value: 0n,
        data: '0x' as Hex,
      }
      const request2: ExecutionRequest = {
        target: testTargetAddress,
        value: 1n,
        data: '0x' as Hex,
      }

      const signature1 = await executor.signExecution(
        testSessionKey,
        testAccountAddress,
        request1,
        0n
      )
      const signature2 = await executor.signExecution(
        testSessionKey,
        testAccountAddress,
        request2,
        0n
      )

      expect(signature1).not.toBe(signature2)
    })

    it('should produce different signatures for different nonces', async () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const request: ExecutionRequest = {
        target: testTargetAddress,
        value: 0n,
        data: '0x' as Hex,
      }

      const signature1 = await executor.signExecution(
        testSessionKey,
        testAccountAddress,
        request,
        0n
      )
      const signature2 = await executor.signExecution(
        testSessionKey,
        testAccountAddress,
        request,
        1n
      )

      expect(signature1).not.toBe(signature2)
    })
  })

  describe('encodeExecuteOnBehalf', () => {
    it('should encode execute on behalf call data', async () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const request: ExecutionRequest = {
        target: testTargetAddress,
        value: 0n,
        data: '0xabcdef' as Hex,
      }

      const signature = await executor.signExecution(
        testSessionKey,
        testAccountAddress,
        request,
        0n
      )

      const callData = executor.encodeExecuteOnBehalf(testAccountAddress, request, signature)

      expect(callData).toMatch(/^0x/)
      expect(callData.length).toBeGreaterThan(10)
    })
  })

  describe('encodeExecuteAsSessionKey', () => {
    it('should encode execute as session key call data', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const request: ExecutionRequest = {
        target: testTargetAddress,
        value: 1000000000000000000n, // 1 ETH
        data: '0x' as Hex,
      }

      const callData = executor.encodeExecuteAsSessionKey(testAccountAddress, request)

      expect(callData).toMatch(/^0x/)
    })
  })

  describe('generateSessionKey', () => {
    it('should generate a valid session key', async () => {
      const sessionKey = await generateSessionKey()

      expect(sessionKey.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(sessionKey.signMessage).toBeDefined()
    })

    it('should generate unique session keys', async () => {
      const sessionKey1 = await generateSessionKey()
      const sessionKey2 = await generateSessionKey()

      expect(sessionKey1.address).not.toBe(sessionKey2.address)
    })
  })

  describe('sessionKeyFromPrivateKey', () => {
    it('should create session key from private key', async () => {
      const sessionKey = await sessionKeyFromPrivateKey(testPrivateKey)

      expect(sessionKey.address).toBe(testSessionKey.address)
    })

    it('should be able to sign messages', async () => {
      const sessionKey = await sessionKeyFromPrivateKey(testPrivateKey)

      const signature = await sessionKey.signMessage({
        message: 'test message',
      })

      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/)
    })
  })

  describe('edge cases', () => {
    it('should handle large values', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const callData = executor.encodeAddSessionKey({
        sessionKey: testSessionKey,
        spendingLimit: BigInt(2) ** BigInt(128) - BigInt(1),
      })

      expect(callData).toMatch(/^0x/)
    })

    it('should handle different chain IDs', async () => {
      const executor1 = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: 1n,
      })
      const executor2 = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: 137n,
      })

      const request: ExecutionRequest = {
        target: testTargetAddress,
        value: 0n,
        data: '0x' as Hex,
      }

      const signature1 = await executor1.signExecution(
        testSessionKey,
        testAccountAddress,
        request,
        0n
      )
      const signature2 = await executor2.signExecution(
        testSessionKey,
        testAccountAddress,
        request,
        0n
      )

      expect(signature1).not.toBe(signature2)
    })

    it('should handle empty call data', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      const request: ExecutionRequest = {
        target: testTargetAddress,
        value: 0n,
        data: '0x' as Hex,
      }

      const callData = executor.encodeExecuteAsSessionKey(testAccountAddress, request)

      expect(callData).toMatch(/^0x/)
    })

    it('should handle complex call data', () => {
      const executor = createSessionKeyExecutor({
        executorAddress: testExecutorAddress,
        chainId: testChainId,
      })

      // ERC20 transfer call data
      const complexData = encodeFunctionData({
        abi: [
          {
            name: 'transfer',
            type: 'function',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ type: 'bool' }],
          },
        ],
        functionName: 'transfer',
        args: [testTargetAddress, 1000000000000000000n],
      })

      const request: ExecutionRequest = {
        target: testTargetAddress,
        value: 0n,
        data: complexData,
      }

      const callData = executor.encodeExecuteAsSessionKey(testAccountAddress, request)

      expect(callData).toMatch(/^0x/)
      expect(callData.length).toBeGreaterThan(100)
    })
  })
})

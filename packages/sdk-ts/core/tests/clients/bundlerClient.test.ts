/**
 * Bundler Client Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBundlerClient } from '../../src/clients/bundlerClient'

function mockFetchResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  } as Response
}

describe('createBundlerClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should create a bundler client', () => {
    const client = createBundlerClient({ url: 'https://bundler.example.com' })
    expect(client).toBeDefined()
    expect(typeof client.sendUserOperation).toBe('function')
    expect(typeof client.estimateUserOperationGas).toBe('function')
    expect(typeof client.getUserOperationByHash).toBe('function')
    expect(typeof client.getUserOperationReceipt).toBe('function')
    expect(typeof client.getSupportedEntryPoints).toBe('function')
    expect(typeof client.getChainId).toBe('function')
    expect(typeof client.waitForUserOperationReceipt).toBe('function')
  })

  describe('sendUserOperation', () => {
    it('should send a packed user operation and return hash', async () => {
      const opHash = '0x' + 'a'.repeat(64)
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ jsonrpc: '2.0', id: 1, result: opHash })
      )

      const client = createBundlerClient({ url: 'https://bundler.example.com' })
      const result = await client.sendUserOperation({
        sender: ('0x' + '1'.repeat(40)) as `0x${string}`,
        nonce: 0n,
        callData: '0x' as `0x${string}`,
        callGasLimit: 100000n,
        verificationGasLimit: 100000n,
        preVerificationGas: 50000n,
        maxFeePerGas: 30000000000n,
        maxPriorityFeePerGas: 1500000000n,
        signature: ('0x' + 'ff'.repeat(65)) as `0x${string}`,
      })

      expect(result).toBe(opHash)

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!
      const body = JSON.parse(fetchCall[1]?.body as string)
      expect(body.method).toBe('eth_sendUserOperation')
    })
  })

  describe('estimateUserOperationGas', () => {
    it('should estimate gas and return parsed BigInt values', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            preVerificationGas: '0xc350',
            verificationGasLimit: '0x186a0',
            callGasLimit: '0x30d40',
          },
        })
      )

      const client = createBundlerClient({ url: 'https://bundler.example.com' })
      const result = await client.estimateUserOperationGas({
        sender: ('0x' + '1'.repeat(40)) as `0x${string}`,
        callData: '0x' as `0x${string}`,
      })

      expect(result.preVerificationGas).toBe(0xc350n)
      expect(result.verificationGasLimit).toBe(0x186a0n)
      expect(result.callGasLimit).toBe(0x30d40n)
    })

    it('should parse optional paymaster gas values', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            preVerificationGas: '0x100',
            verificationGasLimit: '0x200',
            callGasLimit: '0x300',
            paymasterVerificationGasLimit: '0x400',
            paymasterPostOpGasLimit: '0x500',
          },
        })
      )

      const client = createBundlerClient({ url: 'https://bundler.example.com' })
      const result = await client.estimateUserOperationGas({
        sender: ('0x' + '1'.repeat(40)) as `0x${string}`,
        callData: '0x' as `0x${string}`,
      })

      expect(result.paymasterVerificationGasLimit).toBe(0x400n)
      expect(result.paymasterPostOpGasLimit).toBe(0x500n)
    })
  })

  describe('getUserOperationByHash', () => {
    it('should return null when operation not found', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ jsonrpc: '2.0', id: 1, result: null })
      )

      const client = createBundlerClient({ url: 'https://bundler.example.com' })
      const result = await client.getUserOperationByHash(('0x' + 'a'.repeat(64)) as `0x${string}`)
      expect(result).toBeNull()
    })
  })

  describe('getUserOperationReceipt', () => {
    it('should return null when receipt not found', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ jsonrpc: '2.0', id: 1, result: null })
      )

      const client = createBundlerClient({ url: 'https://bundler.example.com' })
      const result = await client.getUserOperationReceipt(('0x' + 'a'.repeat(64)) as `0x${string}`)
      expect(result).toBeNull()
    })

    it('should parse receipt with BigInt values', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            userOpHash: '0x' + 'a'.repeat(64),
            entryPoint: '0x' + '5'.repeat(40),
            sender: '0x' + '1'.repeat(40),
            nonce: '0x0',
            actualGasCost: '0x2710',
            actualGasUsed: '0x1388',
            success: true,
            logs: [],
            receipt: {
              transactionHash: '0x' + 'b'.repeat(64),
              transactionIndex: '0x0',
              blockHash: '0x' + 'c'.repeat(64),
              blockNumber: '0x64',
              from: '0x' + '1'.repeat(40),
              cumulativeGasUsed: '0x5208',
              gasUsed: '0x5208',
              logs: [],
              status: '0x1',
              effectiveGasPrice: '0x6fc23ac00',
            },
          },
        })
      )

      const client = createBundlerClient({ url: 'https://bundler.example.com' })
      const receipt = await client.getUserOperationReceipt(('0x' + 'a'.repeat(64)) as `0x${string}`)

      expect(receipt).not.toBeNull()
      expect(receipt!.success).toBe(true)
      expect(receipt!.actualGasCost).toBe(0x2710n)
      expect(receipt!.actualGasUsed).toBe(0x1388n)
      expect(receipt!.receipt.blockNumber).toBe(0x64n)
      expect(receipt!.receipt.status).toBe('success')
    })

    it('should parse reverted receipt', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            userOpHash: '0x' + 'a'.repeat(64),
            entryPoint: '0x' + '5'.repeat(40),
            sender: '0x' + '1'.repeat(40),
            nonce: '0x0',
            actualGasCost: '0x0',
            actualGasUsed: '0x0',
            success: false,
            reason: 'AA23 reverted',
            logs: [],
            receipt: {
              transactionHash: '0x' + 'b'.repeat(64),
              transactionIndex: '0x0',
              blockHash: '0x' + 'c'.repeat(64),
              blockNumber: '0x64',
              from: '0x' + '1'.repeat(40),
              cumulativeGasUsed: '0x0',
              gasUsed: '0x0',
              logs: [],
              status: '0x0',
              effectiveGasPrice: '0x0',
            },
          },
        })
      )

      const client = createBundlerClient({ url: 'https://bundler.example.com' })
      const receipt = await client.getUserOperationReceipt(('0x' + 'a'.repeat(64)) as `0x${string}`)

      expect(receipt!.success).toBe(false)
      expect(receipt!.reason).toBe('AA23 reverted')
      expect(receipt!.receipt.status).toBe('reverted')
    })
  })

  describe('getSupportedEntryPoints', () => {
    it('should return entry point addresses', async () => {
      const entryPoints = ['0x' + '5'.repeat(40)]
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ jsonrpc: '2.0', id: 1, result: entryPoints })
      )

      const client = createBundlerClient({ url: 'https://bundler.example.com' })
      const result = await client.getSupportedEntryPoints()
      expect(result).toEqual(entryPoints)
    })
  })

  describe('getChainId', () => {
    it('should return chain ID as bigint', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ jsonrpc: '2.0', id: 1, result: '0x1' })
      )

      const client = createBundlerClient({ url: 'https://bundler.example.com' })
      const result = await client.getChainId()
      expect(result).toBe(1n)
    })
  })

  describe('waitForUserOperationReceipt', () => {
    it('should poll until receipt is found', async () => {
      const receipt = {
        userOpHash: '0x' + 'a'.repeat(64),
        entryPoint: '0x' + '5'.repeat(40),
        sender: '0x' + '1'.repeat(40),
        nonce: '0x0',
        actualGasCost: '0x100',
        actualGasUsed: '0x50',
        success: true,
        logs: [],
        receipt: {
          transactionHash: '0x' + 'b'.repeat(64),
          transactionIndex: '0x0',
          blockHash: '0x' + 'c'.repeat(64),
          blockNumber: '0x64',
          from: '0x' + '1'.repeat(40),
          cumulativeGasUsed: '0x5208',
          gasUsed: '0x5208',
          logs: [],
          status: '0x1',
          effectiveGasPrice: '0x1',
        },
      }

      vi.spyOn(globalThis, 'fetch')
        // First poll: null
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 1, result: null }))
        // Second poll: receipt found
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 2, result: receipt }))

      const client = createBundlerClient({ url: 'https://bundler.example.com' })
      const result = await client.waitForUserOperationReceipt(
        ('0x' + 'a'.repeat(64)) as `0x${string}`,
        { pollingInterval: 10, timeout: 5000 }
      )

      expect(result.success).toBe(true)
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('should throw on timeout', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse({ jsonrpc: '2.0', id: 1, result: null })
      )

      const client = createBundlerClient({ url: 'https://bundler.example.com' })
      await expect(
        client.waitForUserOperationReceipt(('0x' + 'a'.repeat(64)) as `0x${string}`, {
          pollingInterval: 10,
          timeout: 50,
        })
      ).rejects.toThrow('Timeout')
    })
  })
})

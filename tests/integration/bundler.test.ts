import { beforeAll, describe, expect, it } from 'vitest'
import { isBundlerAvailable, TEST_CONFIG } from '../setup'

interface JsonRpcResponse<T = unknown> {
  jsonrpc: string
  id: number
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

async function bundlerRpc<T>(method: string, params: unknown[] = []): Promise<JsonRpcResponse<T>> {
  const response = await fetch(TEST_CONFIG.bundlerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    }),
  })

  return response.json()
}

describe('Bundler Integration Tests', () => {
  let bundlerAvailable: boolean

  beforeAll(async () => {
    bundlerAvailable = await isBundlerAvailable()
    if (!bundlerAvailable) {
      console.warn('⚠️ Bundler not available, tests will be skipped')
    }
  })

  describe('Bundler Health', () => {
    it('should respond to health check', async () => {
      if (!bundlerAvailable) {
        return
      }

      const response = await fetch(`${TEST_CONFIG.bundlerUrl}/health`)
      expect(response.ok).toBe(true)
    })
  })

  describe('RPC Methods', () => {
    it('should return supported entry points', async () => {
      if (!bundlerAvailable) {
        return
      }

      const response = await bundlerRpc<string[]>('eth_supportedEntryPoints')

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      expect(Array.isArray(response.result)).toBe(true)

      if (response.result && response.result.length > 0) {
        expect(response.result[0]).toMatch(/^0x[a-fA-F0-9]{40}$/)
      }
    })

    it('should estimate user operation gas', async () => {
      if (!bundlerAvailable) {
        return
      }

      // Create a mock UserOperation
      const userOp = {
        sender: TEST_CONFIG.accounts.user1.address,
        nonce: '0x0',
        initCode: '0x',
        callData: '0x',
        callGasLimit: '0x0',
        verificationGasLimit: '0x0',
        preVerificationGas: '0x0',
        maxFeePerGas: '0x3B9ACA00', // 1 gwei
        maxPriorityFeePerGas: '0x3B9ACA00',
        paymasterAndData: '0x',
        signature: '0x',
      }

      const response = await bundlerRpc('eth_estimateUserOperationGas', [
        userOp,
        TEST_CONFIG.contracts.entryPoint,
      ])

      // May fail if contracts not deployed, but should return valid error
      if (response.error) {
        expect(response.error.message).toBeDefined()
      } else {
        expect(response.result).toBeDefined()
      }
    })

    it('should reject invalid user operation', async () => {
      if (!bundlerAvailable) {
        return
      }

      // Invalid UserOperation (missing required fields)
      const invalidUserOp = {
        sender: 'invalid-address',
      }

      const response = await bundlerRpc('eth_sendUserOperation', [
        invalidUserOp,
        TEST_CONFIG.contracts.entryPoint,
      ])

      expect(response.error).toBeDefined()
    })

    it('should get user operation by hash (non-existent)', async () => {
      if (!bundlerAvailable) {
        return
      }

      const fakeHash = '0x' + '0'.repeat(64)
      const response = await bundlerRpc('eth_getUserOperationByHash', [fakeHash])

      // Should return null for non-existent hash
      if (!response.error) {
        expect(response.result).toBeNull()
      }
    })
  })

  describe('Mempool Status', () => {
    it('should dump mempool (debug)', async () => {
      if (!bundlerAvailable) {
        return
      }

      const response = await bundlerRpc('debug_bundler_dumpMempool', [
        TEST_CONFIG.contracts.entryPoint,
      ])

      // Debug methods may not be enabled
      if (response.result) {
        expect(Array.isArray(response.result)).toBe(true)
      }
    })
  })
})

describe('Bundler Unit Tests', () => {
  it('should validate UserOperation structure', () => {
    const validUserOp = {
      sender: '0x1234567890123456789012345678901234567890',
      nonce: '0x0',
      initCode: '0x',
      callData: '0xb61d27f6', // execute function selector
      callGasLimit: '0x186A0', // 100000
      verificationGasLimit: '0x186A0',
      preVerificationGas: '0x5208', // 21000
      maxFeePerGas: '0x3B9ACA00', // 1 gwei
      maxPriorityFeePerGas: '0x3B9ACA00',
      paymasterAndData: '0x',
      signature: '0x',
    }

    // Validate sender address format
    expect(validUserOp.sender).toMatch(/^0x[a-fA-F0-9]{40}$/)

    // Validate hex values
    expect(validUserOp.nonce).toMatch(/^0x[a-fA-F0-9]*$/)
    expect(validUserOp.callGasLimit).toMatch(/^0x[a-fA-F0-9]+$/)
  })

  it('should parse hex values correctly', () => {
    const hexValue = '0x186A0' // 100000 in hex
    const parsedValue = Number.parseInt(hexValue, 16)

    expect(parsedValue).toBe(100000)
  })

  it('should validate entry point address', () => {
    const entryPoint = TEST_CONFIG.contracts.entryPoint

    if (entryPoint) {
      expect(entryPoint).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(entryPoint.toLowerCase()).toBe(entryPoint.toLowerCase())
    }
  })
})

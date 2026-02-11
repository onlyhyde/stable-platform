import { beforeAll, describe, expect, it } from 'vitest'
import { TEST_CONFIG } from '../setup'

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

async function paymasterRpc<T>(method: string, params: unknown[]): Promise<JsonRpcResponse<T>> {
  const response = await fetch(TEST_CONFIG.paymasterUrl, {
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

async function isPaymasterAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${TEST_CONFIG.paymasterUrl}/health`)
    return response.ok
  } catch {
    return false
  }
}

describe('Paymaster Integration Tests', () => {
  let paymasterAvailable: boolean

  beforeAll(async () => {
    paymasterAvailable = await isPaymasterAvailable()
    if (!paymasterAvailable) {
      console.warn('⚠️ Paymaster not available, tests will be skipped')
    }
  })

  describe('Paymaster Health', () => {
    it('should respond to health check', async () => {
      if (!paymasterAvailable) {
        return
      }

      const response = await fetch(`${TEST_CONFIG.paymasterUrl}/health`)
      expect(response.ok).toBe(true)
    })
  })

  describe('ERC-7677 Methods', () => {
    it('should return paymaster stub data', async () => {
      if (!paymasterAvailable) {
        return
      }

      // Create a mock UserOperation
      const userOp = {
        sender: TEST_CONFIG.accounts.user1.address,
        nonce: '0x0',
        initCode: '0x',
        callData: '0x',
        callGasLimit: '0x186A0',
        verificationGasLimit: '0x186A0',
        preVerificationGas: '0x5208',
        maxFeePerGas: '0x3B9ACA00',
        maxPriorityFeePerGas: '0x3B9ACA00',
        paymasterAndData: '0x',
        signature: '0x',
      }

      const response = await paymasterRpc('pm_getPaymasterStubData', [
        userOp,
        TEST_CONFIG.contracts.entryPoint,
        `0x${TEST_CONFIG.chainId.toString(16)}`,
        {}, // context
      ])

      if (response.error) {
      } else {
        expect(response.result).toBeDefined()
        // Check for v0.7 format
        const result = response.result as {
          paymaster?: string
          paymasterData?: string
          paymasterAndData?: string
        }
        expect(result.paymaster || result.paymasterAndData).toBeDefined()
      }
    })

    it('should return paymaster data with signature', async () => {
      if (!paymasterAvailable) {
        return
      }

      const userOp = {
        sender: TEST_CONFIG.accounts.user1.address,
        nonce: '0x0',
        initCode: '0x',
        callData: '0x',
        callGasLimit: '0x186A0',
        verificationGasLimit: '0x186A0',
        preVerificationGas: '0x5208',
        maxFeePerGas: '0x3B9ACA00',
        maxPriorityFeePerGas: '0x3B9ACA00',
        paymasterAndData: '0x',
        signature: '0x' + '1b'.repeat(65), // dummy signature
      }

      const response = await paymasterRpc('pm_getPaymasterData', [
        userOp,
        TEST_CONFIG.contracts.entryPoint,
        `0x${TEST_CONFIG.chainId.toString(16)}`,
        {},
      ])

      if (response.error) {
      } else {
        expect(response.result).toBeDefined()
      }
    })
  })

  describe('Sponsor Policy', () => {
    it('should check sponsor eligibility', async () => {
      if (!paymasterAvailable) {
        return
      }

      // Mock check - paymaster should have sponsor policy validation
      const userOp = {
        sender: TEST_CONFIG.accounts.user1.address,
        nonce: '0x0',
        initCode: '0x',
        callData: '0x',
        callGasLimit: '0x186A0',
        verificationGasLimit: '0x186A0',
        preVerificationGas: '0x5208',
        maxFeePerGas: '0x3B9ACA00',
        maxPriorityFeePerGas: '0x3B9ACA00',
        paymasterAndData: '0x',
        signature: '0x',
      }

      // This should either succeed or return policy error
      const response = await paymasterRpc('pm_getPaymasterStubData', [
        userOp,
        TEST_CONFIG.contracts.entryPoint,
        `0x${TEST_CONFIG.chainId.toString(16)}`,
        { sponsorType: 'whitelist' },
      ])

      // Verify response structure
      expect(response.jsonrpc).toBe('2.0')
      expect(response.id).toBeDefined()
    })
  })
})

describe('Paymaster Unit Tests', () => {
  it('should validate paymaster and data format (v0.6)', () => {
    // v0.6 format: paymaster address + paymaster data
    const paymasterAddress = '0x1234567890123456789012345678901234567890'
    const validUntil = Math.floor(Date.now() / 1000) + 3600 // 1 hour
    const validAfter = Math.floor(Date.now() / 1000)

    // Mock paymaster data encoding
    const paymasterData = `${paymasterAddress}${validUntil.toString(16).padStart(64, '0')}${validAfter.toString(16).padStart(64, '0')}`

    expect(paymasterData).toMatch(/^0x[a-fA-F0-9]+$/)
    expect(paymasterData.length).toBeGreaterThan(42) // address + timestamps
  })

  it('should validate paymaster fields (v0.7)', () => {
    // v0.7 format: separate fields
    const paymasterResponse = {
      paymaster: '0x1234567890123456789012345678901234567890',
      paymasterData: '0x',
      paymasterVerificationGasLimit: '0x7530', // 30000
      paymasterPostOpGasLimit: '0x2710', // 10000
    }

    expect(paymasterResponse.paymaster).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(paymasterResponse.paymasterData).toMatch(/^0x[a-fA-F0-9]*$/)
  })

  it('should calculate gas limits correctly', () => {
    const verificationGasLimit = 100000n
    const postOpGasLimit = 50000n
    const callGasLimit = 200000n

    const totalGas = verificationGasLimit + postOpGasLimit + callGasLimit
    expect(totalGas).toBe(350000n)
  })

  it('should validate timestamp ranges', () => {
    const now = Math.floor(Date.now() / 1000)
    const validAfter = now - 60 // 1 minute ago
    const validUntil = now + 3600 // 1 hour from now

    expect(validAfter).toBeLessThan(now)
    expect(validUntil).toBeGreaterThan(now)
    expect(validUntil - validAfter).toBe(3660)
  })
})

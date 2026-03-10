import { describe, expect, it } from 'vitest'
import {
  addressSchema,
  hexSchema,
  jsonRpcRequestSchema,
  sponsorPolicySchema,
  userOperationSchema,
} from '../src/schemas'

describe('Schemas', () => {
  describe('hexSchema', () => {
    it('should accept valid hex strings', () => {
      expect(hexSchema.safeParse('0x').success).toBe(true)
      expect(hexSchema.safeParse('0xabcdef').success).toBe(true)
      expect(hexSchema.safeParse('0x1234567890ABCDEF').success).toBe(true)
    })

    it('should reject invalid hex strings', () => {
      expect(hexSchema.safeParse('').success).toBe(false)
      expect(hexSchema.safeParse('abcdef').success).toBe(false)
      expect(hexSchema.safeParse('0xGGGG').success).toBe(false)
    })
  })

  describe('addressSchema', () => {
    it('should accept valid addresses', () => {
      expect(addressSchema.safeParse('0x1234567890123456789012345678901234567890').success).toBe(
        true
      )
    })

    it('should reject invalid addresses', () => {
      expect(addressSchema.safeParse('0x123').success).toBe(false)
      expect(addressSchema.safeParse('not-an-address').success).toBe(false)
      expect(addressSchema.safeParse('0x' + 'g'.repeat(40)).success).toBe(false)
    })
  })

  describe('jsonRpcRequestSchema', () => {
    it('should accept valid JSON-RPC requests', () => {
      const result = jsonRpcRequestSchema.safeParse({
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_getPaymasterData',
        params: [],
      })
      expect(result.success).toBe(true)
    })

    it('should accept string id', () => {
      const result = jsonRpcRequestSchema.safeParse({
        jsonrpc: '2.0',
        id: 'abc',
        method: 'test',
      })
      expect(result.success).toBe(true)
    })

    it('should default params to empty array', () => {
      const result = jsonRpcRequestSchema.safeParse({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.params).toEqual([])
      }
    })

    it('should reject invalid jsonrpc version', () => {
      const result = jsonRpcRequestSchema.safeParse({
        jsonrpc: '1.0',
        id: 1,
        method: 'test',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('sponsorPolicySchema', () => {
    it('should accept valid policy', () => {
      const result = sponsorPolicySchema.safeParse({
        id: 'test',
        name: 'Test Policy',
        active: true,
      })
      expect(result.success).toBe(true)
    })

    it('should accept policy with bigint fields as strings', () => {
      const result = sponsorPolicySchema.safeParse({
        id: 'test',
        name: 'Test',
        active: true,
        maxGasLimit: '5000000',
        maxGasCost: '1000000000000000000',
        dailyLimitPerSender: '100000000000000000',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.maxGasLimit).toBe(5000000n)
        expect(result.data.maxGasCost).toBe(1000000000000000000n)
      }
    })

    it('should accept policy with bigint fields as numbers', () => {
      const result = sponsorPolicySchema.safeParse({
        id: 'test',
        name: 'Test',
        active: true,
        maxGasLimit: 5000000,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.maxGasLimit).toBe(5000000n)
      }
    })

    it('should accept policy with whitelist/blacklist', () => {
      const result = sponsorPolicySchema.safeParse({
        id: 'test',
        name: 'Test',
        active: true,
        whitelist: ['0x1234567890123456789012345678901234567890'],
        blacklist: ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'],
      })
      expect(result.success).toBe(true)
    })

    it('should accept policy with time window', () => {
      const result = sponsorPolicySchema.safeParse({
        id: 'test',
        name: 'Test',
        active: true,
        startTime: 1700000000,
        endTime: 1700086400,
      })
      expect(result.success).toBe(true)
    })

    it('should reject policy without required fields', () => {
      expect(sponsorPolicySchema.safeParse({}).success).toBe(false)
      expect(sponsorPolicySchema.safeParse({ id: 'x' }).success).toBe(false)
      expect(sponsorPolicySchema.safeParse({ id: 'x', name: 'y' }).success).toBe(false)
    })

    it('should reject empty id', () => {
      const result = sponsorPolicySchema.safeParse({
        id: '',
        name: 'Test',
        active: true,
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid whitelist addresses', () => {
      const result = sponsorPolicySchema.safeParse({
        id: 'test',
        name: 'Test',
        active: true,
        whitelist: ['not-an-address'],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('userOperationSchema', () => {
    it('should accept valid v0.7 UserOperation', () => {
      const result = userOperationSchema.safeParse({
        sender: '0x1234567890123456789012345678901234567890',
        nonce: '0x0',
        callData: '0xabcdef',
        callGasLimit: '0x10000',
        verificationGasLimit: '0x10000',
        preVerificationGas: '0x5000',
        maxFeePerGas: '0x3B9ACA00',
        maxPriorityFeePerGas: '0x5F5E100',
        signature: '0x',
      })
      expect(result.success).toBe(true)
    })

    it('should accept with optional factory fields', () => {
      const result = userOperationSchema.safeParse({
        sender: '0x1234567890123456789012345678901234567890',
        nonce: '0x0',
        factory: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        factoryData: '0xabcd',
        callData: '0xabcdef',
        callGasLimit: '0x10000',
        verificationGasLimit: '0x10000',
        preVerificationGas: '0x5000',
        maxFeePerGas: '0x3B9ACA00',
        maxPriorityFeePerGas: '0x5F5E100',
        signature: '0x',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing required fields', () => {
      const result = userOperationSchema.safeParse({
        sender: '0x1234567890123456789012345678901234567890',
      })
      expect(result.success).toBe(false)
    })
  })
})

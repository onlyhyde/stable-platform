/**
 * InputValidator Tests
 *
 * T1: Security module coverage - input validation
 */

import { describe, expect, it } from 'vitest'
import {
  createInputValidator,
  InputValidator,
  isValidAddress,
  isValidChainId,
  isValidHex,
  isValidRpcRequest,
  isValidTransactionObject,
  sanitizeString,
} from '../../src/security/inputValidator'

describe('InputValidator', () => {
  const validator = new InputValidator()

  // ========================================================================
  // Factory
  // ========================================================================

  describe('createInputValidator', () => {
    it('should create an instance', () => {
      expect(createInputValidator()).toBeInstanceOf(InputValidator)
    })
  })

  // ========================================================================
  // validateAddress
  // ========================================================================

  describe('validateAddress', () => {
    it('should accept valid lowercase address', () => {
      const result = validator.validateAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')
      expect(result.isValid).toBe(true)
      expect(result.normalizedValue).toBeDefined()
    })

    it('should accept valid uppercase address', () => {
      const result = validator.validateAddress('0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045')
      expect(result.isValid).toBe(true)
    })

    it('should accept valid EIP-55 checksummed address', () => {
      const result = validator.validateAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
      expect(result.isValid).toBe(true)
    })

    it('should reject null/undefined/empty', () => {
      expect(validator.validateAddress('').isValid).toBe(false)
      expect(validator.validateAddress(null as any).isValid).toBe(false)
      expect(validator.validateAddress(undefined as any).isValid).toBe(false)
    })

    it('should reject address without 0x prefix', () => {
      const result = validator.validateAddress('d8da6bf26964af9d7eed9e03e53415d37aa96045')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Address must start with 0x')
    })

    it('should reject address with wrong length', () => {
      const result = validator.validateAddress('0x1234')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Address must be 42 characters')
    })

    it('should reject address with invalid hex characters', () => {
      const result = validator.validateAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Address contains invalid characters')
    })

    it('should warn about invalid EIP-55 checksum (mixed case)', () => {
      // Mixed case but wrong checksum
      const result = validator.validateAddress('0xd8DA6bf26964af9d7eed9e03e53415d37aa96045')
      expect(result.isValid).toBe(false)
      expect(result.warnings).toBeDefined()
    })
  })

  // ========================================================================
  // validateHex
  // ========================================================================

  describe('validateHex', () => {
    it('should accept valid hex with prefix', () => {
      const result = validator.validateHex('0xdeadbeef')
      expect(result.isValid).toBe(true)
      expect(result.normalizedValue).toBe('0xdeadbeef')
    })

    it('should reject hex without prefix when required', () => {
      const result = validator.validateHex('deadbeef', { requirePrefix: true })
      expect(result.isValid).toBe(false)
    })

    it('should accept hex without prefix when not required', () => {
      const result = validator.validateHex('deadbeef', { requirePrefix: false })
      expect(result.isValid).toBe(true)
      expect(result.normalizedValue).toBe('0xdeadbeef')
    })

    it('should validate exact length', () => {
      const result = validator.validateHex('0xab', { exactLength: 6 })
      expect(result.isValid).toBe(false)
    })

    it('should validate min length', () => {
      const result = validator.validateHex('0xab', { minLength: 10 })
      expect(result.isValid).toBe(false)
    })

    it('should validate max length', () => {
      const result = validator.validateHex('0xdeadbeefcafe', { maxLength: 6 })
      expect(result.isValid).toBe(false)
    })

    it('should reject invalid hex characters', () => {
      const result = validator.validateHex('0xZZZZ')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid hex characters')
    })

    it('should reject null/empty', () => {
      expect(validator.validateHex('').isValid).toBe(false)
      expect(validator.validateHex(null as any).isValid).toBe(false)
    })
  })

  // ========================================================================
  // validateChainId
  // ========================================================================

  describe('validateChainId', () => {
    it('should accept numeric chain ID', () => {
      const result = validator.validateChainId(1)
      expect(result.isValid).toBe(true)
      expect(result.normalizedValue).toBe(1)
    })

    it('should accept string chain ID', () => {
      const result = validator.validateChainId('137')
      expect(result.isValid).toBe(true)
      expect(result.normalizedValue).toBe(137)
    })

    it('should accept hex string chain ID', () => {
      const result = validator.validateChainId('0x89')
      expect(result.isValid).toBe(true)
      expect(result.normalizedValue).toBe(137)
    })

    it('should reject zero', () => {
      const result = validator.validateChainId(0)
      expect(result.isValid).toBe(false)
    })

    it('should reject negative', () => {
      const result = validator.validateChainId(-1)
      expect(result.isValid).toBe(false)
    })

    it('should reject non-integer', () => {
      const result = validator.validateChainId(1.5)
      expect(result.isValid).toBe(false)
    })

    it('should reject non-number types', () => {
      expect(validator.validateChainId(true).isValid).toBe(false)
      expect(validator.validateChainId(null).isValid).toBe(false)
      expect(validator.validateChainId({}).isValid).toBe(false)
    })

    it('should reject NaN string', () => {
      expect(validator.validateChainId('abc').isValid).toBe(false)
    })
  })

  // ========================================================================
  // validateTransaction
  // ========================================================================

  describe('validateTransaction', () => {
    const validFrom = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
    const validTo = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

    it('should accept valid transaction', () => {
      const result = validator.validateTransaction({
        from: validFrom,
        to: validTo,
        value: '0x0',
        data: '0x',
      })
      expect(result.isValid).toBe(true)
    })

    it('should require from address', () => {
      const result = validator.validateTransaction({ to: validTo })
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('from address'))).toBe(true)
    })

    it('should warn about missing to and data', () => {
      const result = validator.validateTransaction({ from: validFrom })
      expect(result.warnings).toBeDefined()
      expect(result.warnings!.some((w) => w.includes('no to address'))).toBe(true)
    })

    it('should validate hex fields', () => {
      const result = validator.validateTransaction({
        from: validFrom,
        to: validTo,
        value: 'not-hex',
      })
      expect(result.isValid).toBe(false)
    })

    it('should validate gas fields', () => {
      const result = validator.validateTransaction({
        from: validFrom,
        gas: 'invalid',
        gasPrice: 'invalid',
        maxFeePerGas: 'invalid',
        maxPriorityFeePerGas: 'invalid',
      })
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(4)
    })
  })

  // ========================================================================
  // validateRpcRequest
  // ========================================================================

  describe('validateRpcRequest', () => {
    it('should accept valid RPC request', () => {
      const result = validator.validateRpcRequest({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      })
      expect(result.isValid).toBe(true)
    })

    it('should require method', () => {
      const result = validator.validateRpcRequest({ params: [] })
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('method'))).toBe(true)
    })

    it('should reject non-string method', () => {
      const result = validator.validateRpcRequest({ method: 123 })
      expect(result.isValid).toBe(false)
    })

    it('should reject non-array params', () => {
      const result = validator.validateRpcRequest({ method: 'eth_chainId', params: 'not-array' })
      expect(result.isValid).toBe(false)
    })

    it('should reject invalid id type', () => {
      const result = validator.validateRpcRequest({ method: 'eth_chainId', id: true })
      expect(result.isValid).toBe(false)
    })

    it('should accept string id', () => {
      const result = validator.validateRpcRequest({ method: 'eth_chainId', id: 'req-1' })
      expect(result.isValid).toBe(true)
    })
  })

  // ========================================================================
  // sanitizeString
  // ========================================================================

  describe('sanitizeString', () => {
    it('should escape HTML by default', () => {
      const result = validator.sanitizeString('<script>alert("xss")</script>')
      expect(result).not.toContain('<script>')
      expect(result).toContain('&lt;script&gt;')
    })

    it('should remove null bytes', () => {
      const result = validator.sanitizeString('hello\x00world')
      expect(result).toBe('helloworld')
    })

    it('should trim whitespace', () => {
      const result = validator.sanitizeString('  hello  ')
      expect(result).toBe('hello')
    })

    it('should limit length', () => {
      const result = validator.sanitizeString('a'.repeat(100), { maxLength: 10 })
      expect(result.length).toBe(10)
    })

    it('should skip HTML escaping when disabled', () => {
      const result = validator.sanitizeString('<b>bold</b>', { escapeHtml: false })
      expect(result).toBe('<b>bold</b>')
    })

    it('should return empty string for non-string input', () => {
      expect(validator.sanitizeString(123 as any)).toBe('')
    })
  })

  // ========================================================================
  // Utility functions (use default validator)
  // ========================================================================

  describe('utility functions', () => {
    it('isValidAddress should work', () => {
      expect(isValidAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(true)
      expect(isValidAddress('invalid')).toBe(false)
    })

    it('isValidHex should work', () => {
      expect(isValidHex('0xdead')).toBe(true)
      expect(isValidHex('gggg')).toBe(false)
    })

    it('isValidChainId should work', () => {
      expect(isValidChainId(1)).toBe(true)
      expect(isValidChainId(-1)).toBe(false)
    })

    it('isValidTransactionObject should work', () => {
      expect(
        isValidTransactionObject({
          from: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
          to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        })
      ).toBe(true)
    })

    it('isValidRpcRequest should work', () => {
      expect(isValidRpcRequest({ method: 'eth_chainId', params: [] })).toBe(true)
      expect(isValidRpcRequest({})).toBe(false)
    })

    it('sanitizeString should work', () => {
      expect(sanitizeString('<b>test</b>')).toContain('&lt;b&gt;')
    })
  })
})

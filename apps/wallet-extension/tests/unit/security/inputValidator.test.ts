/**
 * Input Validator Tests
 * TDD tests for comprehensive input validation
 */

// Unmock to test real implementation
jest.unmock('@stablenet/core')

import {
  InputValidator,
  isValidInputAddress as isValidAddress,
  isValidChainId,
  isValidHex,
  isValidRpcRequest,
  isValidTransactionObject,
  sanitizeString,
} from '@stablenet/core'

describe('InputValidator', () => {
  let validator: InputValidator

  beforeEach(() => {
    validator = new InputValidator()
  })

  describe('constructor', () => {
    it('should create instance', () => {
      expect(validator).toBeInstanceOf(InputValidator)
    })
  })

  describe('validateAddress', () => {
    it('should accept valid checksummed addresses', () => {
      const result = validator.validateAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should accept valid lowercase addresses', () => {
      const result = validator.validateAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')

      expect(result.isValid).toBe(true)
    })

    it('should reject addresses without 0x prefix', () => {
      const result = validator.validateAddress('5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Address must start with 0x')
    })

    it('should reject addresses with invalid length', () => {
      const result = validator.validateAddress('0x5aAeb6053F3E94C9b9A09f3366')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Address must be 42 characters')
    })

    it('should reject addresses with invalid characters', () => {
      const result = validator.validateAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1GGGGZ')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Address contains invalid characters')
    })

    it('should reject null/undefined addresses', () => {
      const result = validator.validateAddress(null as unknown as string)

      expect(result.isValid).toBe(false)
    })

    it('should warn about mixed case without checksum', () => {
      // Mixed case but invalid checksum
      const result = validator.validateAddress('0x5aAeB6053f3E94c9b9a09F33669435E7EF1beAed')

      expect(result.warnings?.length).toBeGreaterThan(0)
    })
  })

  describe('validateHex', () => {
    it('should accept valid hex strings', () => {
      const result = validator.validateHex('0xdeadbeef')

      expect(result.isValid).toBe(true)
    })

    it('should accept hex without 0x prefix when allowed', () => {
      const result = validator.validateHex('deadbeef', { requirePrefix: false })

      expect(result.isValid).toBe(true)
    })

    it('should reject hex without 0x prefix by default', () => {
      const result = validator.validateHex('deadbeef')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Hex string must start with 0x')
    })

    it('should reject invalid hex characters', () => {
      const result = validator.validateHex('0xghijkl')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid hex characters')
    })

    it('should validate hex length when specified', () => {
      const result = validator.validateHex('0xdeadbeef', { exactLength: 10 })

      expect(result.isValid).toBe(true)
    })

    it('should reject wrong length when exactLength specified', () => {
      const result = validator.validateHex('0xdead', { exactLength: 10 })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Hex string must be exactly 10 characters')
    })

    it('should enforce minimum length', () => {
      const result = validator.validateHex('0xab', { minLength: 10 })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Hex string must be at least 10 characters')
    })

    it('should enforce maximum length', () => {
      const result = validator.validateHex('0xdeadbeefcafe', { maxLength: 6 })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Hex string must be at most 6 characters')
    })
  })

  describe('validateChainId', () => {
    it('should accept valid numeric chain IDs', () => {
      const result = validator.validateChainId(1)

      expect(result.isValid).toBe(true)
      expect(result.normalizedValue).toBe(1)
    })

    it('should accept hex chain IDs', () => {
      const result = validator.validateChainId('0x1')

      expect(result.isValid).toBe(true)
      expect(result.normalizedValue).toBe(1)
    })

    it('should accept string numeric chain IDs', () => {
      const result = validator.validateChainId('137')

      expect(result.isValid).toBe(true)
      expect(result.normalizedValue).toBe(137)
    })

    it('should reject negative chain IDs', () => {
      const result = validator.validateChainId(-1)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Chain ID must be positive')
    })

    it('should reject zero chain ID', () => {
      const result = validator.validateChainId(0)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Chain ID must be positive')
    })

    it('should reject non-integer chain IDs', () => {
      const result = validator.validateChainId(1.5)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Chain ID must be an integer')
    })

    it('should reject invalid string chain IDs', () => {
      const result = validator.validateChainId('invalid')

      expect(result.isValid).toBe(false)
    })
  })

  describe('validateTransaction', () => {
    it('should accept valid transaction object', () => {
      const result = validator.validateTransaction({
        from: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        value: '0x0',
        gas: '0x5208',
        data: '0x',
      })

      expect(result.isValid).toBe(true)
    })

    it('should require from address', () => {
      const result = validator.validateTransaction({
        to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        value: '0x0',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Transaction must have a from address')
    })

    it('should validate from address format', () => {
      const result = validator.validateTransaction({
        from: 'invalid-address',
        to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('from address'))).toBe(true)
    })

    it('should validate to address format when present', () => {
      const result = validator.validateTransaction({
        from: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        to: 'invalid-address',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('to address'))).toBe(true)
    })

    it('should allow missing to address for contract deployment', () => {
      const result = validator.validateTransaction({
        from: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        data: '0x608060405234801561001057600080fd5b50',
      })

      expect(result.isValid).toBe(true)
    })

    it('should validate value as hex', () => {
      const result = validator.validateTransaction({
        from: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        value: 'not-hex',
      })

      expect(result.isValid).toBe(false)
    })

    it('should validate gas as hex', () => {
      const result = validator.validateTransaction({
        from: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        gas: 'not-hex',
      })

      expect(result.isValid).toBe(false)
    })

    it('should validate gasPrice as hex', () => {
      const result = validator.validateTransaction({
        from: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        gasPrice: 'not-hex',
      })

      expect(result.isValid).toBe(false)
    })
  })

  describe('validateRpcRequest', () => {
    it('should accept valid RPC request', () => {
      const result = validator.validateRpcRequest({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: ['0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', 'latest'],
        id: 1,
      })

      expect(result.isValid).toBe(true)
    })

    it('should require method', () => {
      const result = validator.validateRpcRequest({
        jsonrpc: '2.0',
        params: [],
        id: 1,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('RPC request must have a method')
    })

    it('should require method to be string', () => {
      const result = validator.validateRpcRequest({
        jsonrpc: '2.0',
        method: 123,
        params: [],
        id: 1,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Method must be a string')
    })

    it('should validate params is array when present', () => {
      const result = validator.validateRpcRequest({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: 'not-an-array',
        id: 1,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Params must be an array')
    })

    it('should accept request without params', () => {
      const result = validator.validateRpcRequest({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        id: 1,
      })

      expect(result.isValid).toBe(true)
    })

    it('should validate id is number or string', () => {
      const result = validator.validateRpcRequest({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        id: { invalid: 'id' },
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('ID must be a number or string')
    })
  })

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      const result = validator.sanitizeString('  hello world  ')

      expect(result).toBe('hello world')
    })

    it('should remove null bytes', () => {
      const result = validator.sanitizeString('hello\x00world')

      expect(result).toBe('helloworld')
    })

    it('should limit string length', () => {
      const longString = 'a'.repeat(1000)
      const result = validator.sanitizeString(longString, { maxLength: 100 })

      expect(result.length).toBe(100)
    })

    it('should escape HTML by default', () => {
      const result = validator.sanitizeString('<script>alert("xss")</script>')

      expect(result).not.toContain('<script>')
      expect(result).toContain('&lt;')
    })

    it('should optionally not escape HTML', () => {
      const result = validator.sanitizeString('<b>bold</b>', {
        escapeHtml: false,
      })

      expect(result).toContain('<b>')
    })
  })
})

describe('Utility Functions', () => {
  describe('isValidAddress', () => {
    it('should return true for valid address', () => {
      expect(isValidAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(true)
    })

    it('should return false for invalid address', () => {
      expect(isValidAddress('invalid')).toBe(false)
    })
  })

  describe('isValidHex', () => {
    it('should return true for valid hex', () => {
      expect(isValidHex('0xdeadbeef')).toBe(true)
    })

    it('should return false for invalid hex', () => {
      expect(isValidHex('not-hex')).toBe(false)
    })
  })

  describe('isValidChainId', () => {
    it('should return true for valid chain ID', () => {
      expect(isValidChainId(1)).toBe(true)
    })

    it('should return false for invalid chain ID', () => {
      expect(isValidChainId(-1)).toBe(false)
    })
  })

  describe('isValidTransactionObject', () => {
    it('should return true for valid transaction', () => {
      expect(
        isValidTransactionObject({
          from: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
          to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        })
      ).toBe(true)
    })

    it('should return false for invalid transaction', () => {
      expect(isValidTransactionObject({ to: '0x123' })).toBe(false)
    })
  })

  describe('isValidRpcRequest', () => {
    it('should return true for valid RPC request', () => {
      expect(
        isValidRpcRequest({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          id: 1,
        })
      ).toBe(true)
    })

    it('should return false for invalid RPC request', () => {
      expect(isValidRpcRequest({ params: [] })).toBe(false)
    })
  })

  describe('sanitizeString', () => {
    it('should sanitize string', () => {
      expect(sanitizeString('  hello  ')).toBe('hello')
    })
  })
})

/**
 * TypedDataValidator Tests
 *
 * T1: Security module coverage - EIP-712 domain validation
 */

import { describe, expect, it } from 'vitest'
import type { TypedData } from '../../src/security/typedDataValidator'
import { createTypedDataValidator, TypedDataValidator } from '../../src/security/typedDataValidator'

describe('TypedDataValidator', () => {
  const validator = new TypedDataValidator()
  const chainId = 1
  const origin = 'https://app.uniswap.org'

  const validTypedData: TypedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Transfer: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
    },
    primaryType: 'Transfer',
    domain: {
      name: 'uniswap',
      chainId: 1,
      verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    },
    message: {
      to: '0x1234567890123456789012345678901234567890',
      amount: '1000000',
    },
  }

  // ========================================================================
  // Factory
  // ========================================================================

  describe('createTypedDataValidator', () => {
    it('should create an instance', () => {
      expect(createTypedDataValidator()).toBeInstanceOf(TypedDataValidator)
    })
  })

  // ========================================================================
  // Structure Validation
  // ========================================================================

  describe('structure validation', () => {
    it('should accept valid typed data', () => {
      const result = validator.validateTypedData(validTypedData, chainId, origin)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject non-object', () => {
      const result = validator.validateTypedData(null, chainId, origin)
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('object'))).toBe(true)
    })

    it('should reject missing types field', () => {
      const { types: _, ...noTypes } = validTypedData
      const result = validator.validateTypedData(noTypes, chainId, origin)
      expect(result.isValid).toBe(false)
    })

    it('should reject missing primaryType field', () => {
      const { primaryType: _, ...noPrimary } = validTypedData
      const result = validator.validateTypedData(noPrimary, chainId, origin)
      expect(result.isValid).toBe(false)
    })

    it('should reject missing message field', () => {
      const { message: _, ...noMessage } = validTypedData
      const result = validator.validateTypedData(noMessage, chainId, origin)
      expect(result.isValid).toBe(false)
    })

    it('should reject missing domain field', () => {
      const { domain: _, ...noDomain } = validTypedData
      const result = validator.validateTypedData(noDomain, chainId, origin)
      expect(result.isValid).toBe(false)
    })
  })

  // ========================================================================
  // Domain Validation
  // ========================================================================

  describe('domain validation', () => {
    it('should warn about empty domain', () => {
      const data = { ...validTypedData, domain: {} }
      const result = validator.validateTypedData(data, chainId, origin)

      expect(result.warnings.some((w) => w.type === 'empty_domain')).toBe(true)
    })

    it('should warn about chain ID mismatch', () => {
      const data = { ...validTypedData, domain: { ...validTypedData.domain, chainId: 137 } }
      const result = validator.validateTypedData(data, chainId, origin)

      expect(result.warnings.some((w) => w.type === 'chain_mismatch')).toBe(true)
      expect(result.warnings.find((w) => w.type === 'chain_mismatch')!.severity).toBe('critical')
    })

    it('should handle hex chain ID in domain', () => {
      const data = { ...validTypedData, domain: { ...validTypedData.domain, chainId: '0x89' } }
      const result = validator.validateTypedData(data, 137, origin)

      // Should match - 0x89 = 137
      expect(result.warnings.every((w) => w.type !== 'chain_mismatch')).toBe(true)
    })

    it('should warn about missing chain ID', () => {
      const { chainId: _, ...domainNoChain } = validTypedData.domain
      const data = { ...validTypedData, domain: domainNoChain }
      const result = validator.validateTypedData(data, chainId, origin)

      expect(result.warnings.some((w) => w.type === 'missing_chain_id')).toBe(true)
    })

    it('should warn about invalid verifying contract', () => {
      const data = {
        ...validTypedData,
        domain: { ...validTypedData.domain, verifyingContract: 'not-an-address' },
      }
      const result = validator.validateTypedData(data, chainId, origin)

      expect(result.warnings.some((w) => w.type === 'invalid_verifying_contract')).toBe(true)
    })

    it('should warn about missing verifying contract', () => {
      const { verifyingContract: _, ...domainNoContract } = validTypedData.domain
      const data = { ...validTypedData, domain: domainNoContract }
      const result = validator.validateTypedData(data, chainId, origin)

      expect(result.warnings.some((w) => w.type === 'missing_verifying_contract')).toBe(true)
    })
  })

  // ========================================================================
  // Origin Mismatch Detection
  // ========================================================================

  describe('origin mismatch', () => {
    it('should detect domain/origin mismatch for known protocols', () => {
      const data = {
        ...validTypedData,
        domain: { ...validTypedData.domain, name: 'uniswap' },
      }
      const result = validator.validateTypedData(data, chainId, 'https://evil-site.com')

      expect(result.warnings.some((w) => w.type === 'domain_origin_mismatch')).toBe(true)
    })

    it('should not flag legitimate origin for known protocol', () => {
      const data = {
        ...validTypedData,
        domain: { ...validTypedData.domain, name: 'uniswap' },
      }
      const result = validator.validateTypedData(data, chainId, 'https://app.uniswap.org')

      expect(
        result.warnings.filter(
          (w) => w.type === 'domain_origin_mismatch' && w.severity === 'critical'
        )
      ).toHaveLength(0)
    })
  })

  // ========================================================================
  // Suspicious Domain Names
  // ========================================================================

  describe('suspicious domain names', () => {
    it('should detect suspicious patterns', () => {
      const suspiciousNames = ['uniswapx', 'claim-reward-free', 'free-nft-drop', 'urgent-action']

      for (const name of suspiciousNames) {
        const data = { ...validTypedData, domain: { ...validTypedData.domain, name } }
        const result = validator.validateTypedData(data, chainId, 'https://example.com')

        expect(
          result.warnings.some((w) => w.type === 'suspicious_domain_name'),
          `Expected suspicious warning for "${name}"`
        ).toBe(true)
      }
    })
  })

  // ========================================================================
  // Permit Signature Detection
  // ========================================================================

  describe('permit signature detection', () => {
    it('should detect Permit primaryType', () => {
      const data = {
        ...validTypedData,
        primaryType: 'Permit',
        message: { spender: '0xabc', value: '1000', nonce: 0, deadline: 999999 },
      }
      const result = validator.validateTypedData(data, chainId, origin)

      expect(result.warnings.some((w) => w.type === 'permit_signature')).toBe(true)
    })

    it('should detect Permit2 primaryType', () => {
      const data = {
        ...validTypedData,
        primaryType: 'Permit2',
        message: { spender: '0xabc', value: '1000', nonce: 0, deadline: 999999 },
      }
      const result = validator.validateTypedData(data, chainId, origin)

      expect(result.warnings.some((w) => w.type === 'permit_signature')).toBe(true)
    })

    it('should detect permit-like messages by field heuristic', () => {
      const data = {
        ...validTypedData,
        primaryType: 'CustomApproval',
        message: { spender: '0xabc', value: '1000', nonce: 0, deadline: 999999 },
      }
      const result = validator.validateTypedData(data, chainId, origin)

      expect(result.warnings.some((w) => w.type === 'permit_signature')).toBe(true)
    })
  })

  // ========================================================================
  // High Value Approval Detection
  // ========================================================================

  describe('high value approval detection', () => {
    it('should detect max uint256 hex value', () => {
      const data = {
        ...validTypedData,
        message: {
          value: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        },
      }
      const result = validator.validateTypedData(data, chainId, origin)

      expect(result.warnings.some((w) => w.type === 'high_value_approval')).toBe(true)
    })

    it('should detect max uint256 decimal value', () => {
      const data = {
        ...validTypedData,
        message: {
          amount: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        },
      }
      const result = validator.validateTypedData(data, chainId, origin)

      expect(result.warnings.some((w) => w.type === 'high_value_approval')).toBe(true)
    })

    it('should not flag normal values', () => {
      const data = {
        ...validTypedData,
        message: { value: '1000000' },
      }
      const result = validator.validateTypedData(data, chainId, origin)

      expect(result.warnings.some((w) => w.type === 'high_value_approval')).toBe(false)
    })
  })

  // ========================================================================
  // getRiskLevel
  // ========================================================================

  describe('getRiskLevel', () => {
    it('should return critical for critical warnings', () => {
      expect(
        validator.getRiskLevel([{ type: 'chain_mismatch', message: '', severity: 'critical' }])
      ).toBe('critical')
    })

    it('should return high for high warnings', () => {
      expect(
        validator.getRiskLevel([
          { type: 'invalid_verifying_contract', message: '', severity: 'high' },
        ])
      ).toBe('high')
    })

    it('should return medium for medium warnings', () => {
      expect(
        validator.getRiskLevel([{ type: 'empty_domain', message: '', severity: 'medium' }])
      ).toBe('medium')
    })

    it('should return low for low warnings', () => {
      expect(
        validator.getRiskLevel([
          { type: 'missing_verifying_contract', message: '', severity: 'low' },
        ])
      ).toBe('low')
    })

    it('should return low for no warnings', () => {
      expect(validator.getRiskLevel([])).toBe('low')
    })
  })

  // ========================================================================
  // formatWarningsForDisplay
  // ========================================================================

  describe('formatWarningsForDisplay', () => {
    it('should sort by severity and add prefixes', () => {
      const warnings = [
        {
          type: 'missing_verifying_contract' as const,
          message: 'low msg',
          severity: 'low' as const,
        },
        { type: 'chain_mismatch' as const, message: 'critical msg', severity: 'critical' as const },
        { type: 'empty_domain' as const, message: 'medium msg', severity: 'medium' as const },
      ]
      const formatted = validator.formatWarningsForDisplay(warnings)

      expect(formatted[0]).toContain('critical msg')
      expect(formatted[1]).toContain('medium msg')
      expect(formatted[2]).toContain('low msg')
    })
  })
})

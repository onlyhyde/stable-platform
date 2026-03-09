/**
 * SignatureRiskAnalyzer Tests
 *
 * T1: Security module coverage - signature risk analysis
 */

import { describe, expect, it } from 'vitest'
import {
  createSignatureRiskAnalyzer,
  SignatureMethod,
  SignatureRiskAnalyzer,
  SignatureRiskLevel,
  SignatureRiskType,
} from '../../src/security/signatureRiskAnalyzer'

describe('SignatureRiskAnalyzer', () => {
  const analyzer = new SignatureRiskAnalyzer()

  // ========================================================================
  // Factory
  // ========================================================================

  describe('createSignatureRiskAnalyzer', () => {
    it('should create an instance', () => {
      const instance = createSignatureRiskAnalyzer()
      expect(instance).toBeInstanceOf(SignatureRiskAnalyzer)
    })
  })

  // ========================================================================
  // eth_sign (always CRITICAL - blind signing)
  // ========================================================================

  describe('eth_sign', () => {
    it('should always return CRITICAL risk', () => {
      const result = analyzer.analyzeSignature(SignatureMethod.ETH_SIGN, '0xdeadbeef')

      expect(result.method).toBe(SignatureMethod.ETH_SIGN)
      expect(result.riskLevel).toBe(SignatureRiskLevel.CRITICAL)
      expect(result.riskScore).toBe(95)
      expect(result.riskTypes).toContain(SignatureRiskType.BLIND_SIGNING)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.summary).toContain('CRITICAL')
    })
  })

  // ========================================================================
  // personal_sign
  // ========================================================================

  describe('personal_sign', () => {
    it('should return LOW risk for safe messages', () => {
      // Encode "Hello World" as hex
      const message = '0x' + Buffer.from('Hello World').toString('hex')
      const result = analyzer.analyzeSignature(SignatureMethod.PERSONAL_SIGN, message)

      expect(result.riskLevel).toBe(SignatureRiskLevel.LOW)
      expect(result.riskScore).toBe(20)
      expect(result.decodedMessage).toBe('Hello World')
    })

    it('should return MEDIUM risk for messages with dangerous keywords', () => {
      const message = '0x' + Buffer.from('approve unlimited spending').toString('hex')
      const result = analyzer.analyzeSignature(SignatureMethod.PERSONAL_SIGN, message)

      expect(result.riskLevel).toBe(SignatureRiskLevel.MEDIUM)
      expect(result.riskTypes).toContain(SignatureRiskType.SUSPICIOUS_MESSAGE)
    })

    it('should handle non-hex messages', () => {
      const result = analyzer.analyzeSignature(SignatureMethod.PERSONAL_SIGN, 'plain text message')

      expect(result.riskLevel).toBe(SignatureRiskLevel.LOW)
      expect(result.decodedMessage).toBe('plain text message')
    })
  })

  // ========================================================================
  // eth_signTypedData (legacy v1)
  // ========================================================================

  describe('eth_signTypedData (legacy)', () => {
    it('should return MEDIUM risk with LEGACY_FORMAT', () => {
      const data = JSON.stringify([{ type: 'string', name: 'message', value: 'hello' }])
      const result = analyzer.analyzeSignature(SignatureMethod.ETH_SIGN_TYPED_DATA, data)

      expect(result.riskLevel).toBe(SignatureRiskLevel.MEDIUM)
      expect(result.riskTypes).toContain(SignatureRiskType.LEGACY_FORMAT)
    })

    it('should flag malformed JSON', () => {
      const result = analyzer.analyzeSignature(SignatureMethod.ETH_SIGN_TYPED_DATA, 'not-json')

      expect(result.riskTypes).toContain(SignatureRiskType.LEGACY_FORMAT)
      expect(result.riskTypes).toContain(SignatureRiskType.MALFORMED_DATA)
    })
  })

  // ========================================================================
  // eth_signTypedData_v4 (EIP-712)
  // ========================================================================

  describe('eth_signTypedData_v4', () => {
    const baseTypedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'chainId', type: 'uint256' },
        ],
        Transfer: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
      primaryType: 'Transfer',
      domain: { name: 'TestDApp', chainId: 1 },
      message: { to: '0x1234', amount: '1000' },
    }

    it('should return LOW risk for normal typed data', () => {
      const result = analyzer.analyzeSignature(
        SignatureMethod.ETH_SIGN_TYPED_DATA_V4,
        JSON.stringify(baseTypedData)
      )

      expect(result.riskLevel).toBe(SignatureRiskLevel.LOW)
      expect(result.parsedTypedData).toBeDefined()
      expect(result.summary).toContain('TestDApp')
    })

    it('should detect Permit signature as MEDIUM risk', () => {
      const permitData = {
        ...baseTypedData,
        primaryType: 'Permit',
        message: { spender: '0xabc', value: '1000', nonce: 0, deadline: 999999 },
      }
      const result = analyzer.analyzeSignature(
        SignatureMethod.ETH_SIGN_TYPED_DATA_V4,
        JSON.stringify(permitData)
      )

      expect(result.riskLevel).toBe(SignatureRiskLevel.MEDIUM)
      expect(result.riskTypes).toContain(SignatureRiskType.TOKEN_APPROVAL)
      expect(result.contractInteraction?.spender).toBe('0xabc')
    })

    it('should detect unlimited approval as HIGH risk', () => {
      const unlimitedPermit = {
        ...baseTypedData,
        primaryType: 'Permit',
        domain: { name: 'USDC', verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        message: {
          spender: '0xabc',
          value: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
          nonce: 0,
          deadline: 999999,
        },
      }
      const result = analyzer.analyzeSignature(
        SignatureMethod.ETH_SIGN_TYPED_DATA_V4,
        JSON.stringify(unlimitedPermit)
      )

      expect(result.riskLevel).toBe(SignatureRiskLevel.HIGH)
      expect(result.riskTypes).toContain(SignatureRiskType.UNLIMITED_APPROVAL)
    })

    it('should detect setApprovalForAll as HIGH risk', () => {
      const nftApproval = {
        ...baseTypedData,
        primaryType: 'SetApprovalForAll',
        message: { operator: '0xabc', approved: true },
      }
      const result = analyzer.analyzeSignature(
        SignatureMethod.ETH_SIGN_TYPED_DATA_V4,
        JSON.stringify(nftApproval)
      )

      expect(result.riskLevel).toBe(SignatureRiskLevel.HIGH)
      expect(result.riskTypes).toContain(SignatureRiskType.NFT_APPROVAL_ALL)
      expect(result.contractInteraction?.operator).toBe('0xabc')
    })

    it('should return HIGH risk for malformed JSON', () => {
      const result = analyzer.analyzeSignature(
        SignatureMethod.ETH_SIGN_TYPED_DATA_V4,
        'not-valid-json'
      )

      expect(result.riskLevel).toBe(SignatureRiskLevel.HIGH)
      expect(result.riskTypes).toContain(SignatureRiskType.MALFORMED_DATA)
    })

    it('should extract verifyingContract from domain', () => {
      const withContract = {
        ...baseTypedData,
        domain: {
          name: 'TestDApp',
          verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        },
      }
      const result = analyzer.analyzeSignature(
        SignatureMethod.ETH_SIGN_TYPED_DATA_V4,
        JSON.stringify(withContract)
      )

      expect(result.contractInteraction?.verifyingContract).toBe(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      )
    })
  })

  // ========================================================================
  // eth_signTypedData_v3 (same path as v4)
  // ========================================================================

  describe('eth_signTypedData_v3', () => {
    it('should analyze like v4', () => {
      const data = JSON.stringify({
        types: { EIP712Domain: [], Test: [{ name: 'value', type: 'string' }] },
        primaryType: 'Test',
        domain: { name: 'App' },
        message: { value: 'test' },
      })
      const result = analyzer.analyzeSignature(SignatureMethod.ETH_SIGN_TYPED_DATA_V3, data)

      expect(result.method).toBe(SignatureMethod.ETH_SIGN_TYPED_DATA_V3)
      expect(result.riskLevel).toBe(SignatureRiskLevel.LOW)
    })
  })

  // ========================================================================
  // Unknown method (default path)
  // ========================================================================

  describe('unknown method', () => {
    it('should return MEDIUM risk for unknown methods', () => {
      const result = analyzer.analyzeSignature('unknown_method' as any, '0x')

      expect(result.riskLevel).toBe(SignatureRiskLevel.MEDIUM)
      expect(result.warnings).toContain('Unknown signature method')
    })
  })
})

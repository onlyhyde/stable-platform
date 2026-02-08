/**
 * Signature Risk Analyzer Tests
 * TDD tests for analyzing signing request risks
 */

// Unmock to test real implementation
jest.unmock('@stablenet/core')

import {
  SignatureMethod,
  SignatureRiskAnalyzer,
  SignatureRiskLevel,
  SignatureRiskType,
} from '@stablenet/core'

describe('SignatureRiskAnalyzer', () => {
  let analyzer: SignatureRiskAnalyzer

  beforeEach(() => {
    analyzer = new SignatureRiskAnalyzer()
  })

  describe('constructor', () => {
    it('should create instance', () => {
      expect(analyzer).toBeInstanceOf(SignatureRiskAnalyzer)
    })
  })

  describe('analyzeSignature', () => {
    describe('eth_sign (blind signing)', () => {
      it('should flag eth_sign as high risk (blind signing)', () => {
        const result = analyzer.analyzeSignature(SignatureMethod.ETH_SIGN, '0xdeadbeef')

        expect(result.riskLevel).toBe(SignatureRiskLevel.CRITICAL)
        expect(result.riskTypes).toContain(SignatureRiskType.BLIND_SIGNING)
        expect(result.warnings.length).toBeGreaterThan(0)
      })

      it('should include warning about raw data signing', () => {
        const result = analyzer.analyzeSignature(SignatureMethod.ETH_SIGN, '0xabcdef')

        expect(result.warnings).toContain(
          'eth_sign signs arbitrary data without human-readable context'
        )
      })
    })

    describe('personal_sign', () => {
      it('should be low risk for simple text messages', () => {
        const message = 'Login to MyDApp - Nonce: 12345'
        const result = analyzer.analyzeSignature(SignatureMethod.PERSONAL_SIGN, message)

        expect(result.riskLevel).toBe(SignatureRiskLevel.LOW)
        expect(result.decodedMessage).toBe(message)
      })

      it('should detect hex-encoded messages', () => {
        // "Hello World" in hex
        const hexMessage = '0x48656c6c6f20576f726c64'
        const result = analyzer.analyzeSignature(SignatureMethod.PERSONAL_SIGN, hexMessage)

        expect(result.decodedMessage).toBe('Hello World')
      })

      it('should warn about potentially dangerous message patterns', () => {
        const message = 'I approve spending unlimited tokens'
        const result = analyzer.analyzeSignature(SignatureMethod.PERSONAL_SIGN, message)

        expect(result.riskLevel).toBe(SignatureRiskLevel.MEDIUM)
        expect(result.warnings.length).toBeGreaterThan(0)
      })
    })

    describe('eth_signTypedData_v4 (EIP-712)', () => {
      it('should parse EIP-712 permit signature', () => {
        const typedData = {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ],
            Permit: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          primaryType: 'Permit',
          domain: {
            name: 'USD Coin',
            version: '1',
            chainId: 1,
            verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          },
          message: {
            owner: '0x1234567890123456789012345678901234567890',
            spender: '0xabcdef1234567890abcdef1234567890abcdef12',
            value: '1000000000000000000',
            nonce: 0,
            deadline: 1893456000,
          },
        }

        const result = analyzer.analyzeSignature(
          SignatureMethod.ETH_SIGN_TYPED_DATA_V4,
          JSON.stringify(typedData)
        )

        expect(result.parsedTypedData).toBeDefined()
        expect(result.parsedTypedData?.primaryType).toBe('Permit')
        expect(result.riskTypes).toContain(SignatureRiskType.TOKEN_APPROVAL)
      })

      it('should flag unlimited approval as high risk', () => {
        const typedData = {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ],
            Permit: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          primaryType: 'Permit',
          domain: {
            name: 'Token',
            chainId: 1,
            verifyingContract: '0xToken',
          },
          message: {
            owner: '0xOwner',
            spender: '0xSpender',
            // Max uint256 = unlimited approval
            value: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
            nonce: 0,
            deadline: 1893456000,
          },
        }

        const result = analyzer.analyzeSignature(
          SignatureMethod.ETH_SIGN_TYPED_DATA_V4,
          JSON.stringify(typedData)
        )

        expect(result.riskLevel).toBe(SignatureRiskLevel.HIGH)
        expect(result.riskTypes).toContain(SignatureRiskType.UNLIMITED_APPROVAL)
        expect(result.warnings).toContain('Unlimited token approval requested')
      })

      it('should detect setApprovalForAll (NFT bulk approval)', () => {
        const typedData = {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'chainId', type: 'uint256' },
            ],
            SetApprovalForAll: [
              { name: 'operator', type: 'address' },
              { name: 'approved', type: 'bool' },
            ],
          },
          primaryType: 'SetApprovalForAll',
          domain: {
            name: 'NFT Collection',
            chainId: 1,
          },
          message: {
            operator: '0xOperator',
            approved: true,
          },
        }

        const result = analyzer.analyzeSignature(
          SignatureMethod.ETH_SIGN_TYPED_DATA_V4,
          JSON.stringify(typedData)
        )

        expect(result.riskLevel).toBe(SignatureRiskLevel.HIGH)
        expect(result.riskTypes).toContain(SignatureRiskType.NFT_APPROVAL_ALL)
        expect(result.warnings).toContain(
          'Approving operator access to all NFTs in this collection'
        )
      })

      it('should handle malformed typed data gracefully', () => {
        const result = analyzer.analyzeSignature(
          SignatureMethod.ETH_SIGN_TYPED_DATA_V4,
          'not valid json'
        )

        expect(result.riskLevel).toBe(SignatureRiskLevel.HIGH)
        expect(result.riskTypes).toContain(SignatureRiskType.MALFORMED_DATA)
        expect(result.warnings).toContain('Could not parse typed data')
      })
    })

    describe('eth_signTypedData (legacy v1/v3)', () => {
      it('should analyze legacy typed data', () => {
        const legacyTypedData = [
          { type: 'string', name: 'message', value: 'Hello' },
          { type: 'uint256', name: 'amount', value: '1000' },
        ]

        const result = analyzer.analyzeSignature(
          SignatureMethod.ETH_SIGN_TYPED_DATA,
          JSON.stringify(legacyTypedData)
        )

        expect(result.riskLevel).toBe(SignatureRiskLevel.MEDIUM)
        expect(result.warnings).toContain('Using legacy typed data format')
      })
    })
  })

  describe('getRiskScore', () => {
    it('should return numeric risk score', () => {
      const result = analyzer.analyzeSignature(SignatureMethod.PERSONAL_SIGN, 'Simple message')

      expect(typeof result.riskScore).toBe('number')
      expect(result.riskScore).toBeGreaterThanOrEqual(0)
      expect(result.riskScore).toBeLessThanOrEqual(100)
    })

    it('should return higher score for riskier operations', () => {
      const lowRisk = analyzer.analyzeSignature(SignatureMethod.PERSONAL_SIGN, 'Login message')

      const highRisk = analyzer.analyzeSignature(SignatureMethod.ETH_SIGN, '0xdeadbeef')

      expect(highRisk.riskScore).toBeGreaterThan(lowRisk.riskScore)
    })
  })

  describe('detectContractInteraction', () => {
    it('should detect if signature authorizes contract interaction', () => {
      const typedData = {
        types: {
          EIP712Domain: [{ name: 'verifyingContract', type: 'address' }],
          Permit: [
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        domain: {
          verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        },
        message: {
          spender: '0xUnknownContract',
          value: '1000000',
        },
      }

      const result = analyzer.analyzeSignature(
        SignatureMethod.ETH_SIGN_TYPED_DATA_V4,
        JSON.stringify(typedData)
      )

      expect(result.contractInteraction).toBeDefined()
      expect(result.contractInteraction?.verifyingContract).toBe(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      )
    })
  })

  describe('formatRiskSummary', () => {
    it('should provide human-readable risk summary', () => {
      const result = analyzer.analyzeSignature(SignatureMethod.ETH_SIGN, '0xdeadbeef')

      expect(result.summary).toBeDefined()
      expect(typeof result.summary).toBe('string')
      expect(result.summary.length).toBeGreaterThan(0)
    })
  })
})

describe('SignatureRiskLevel', () => {
  it('should have correct risk levels', () => {
    expect(SignatureRiskLevel.SAFE).toBe('safe')
    expect(SignatureRiskLevel.LOW).toBe('low')
    expect(SignatureRiskLevel.MEDIUM).toBe('medium')
    expect(SignatureRiskLevel.HIGH).toBe('high')
    expect(SignatureRiskLevel.CRITICAL).toBe('critical')
  })
})

describe('SignatureRiskType', () => {
  it('should have correct risk types', () => {
    expect(SignatureRiskType.BLIND_SIGNING).toBe('blind_signing')
    expect(SignatureRiskType.TOKEN_APPROVAL).toBe('token_approval')
    expect(SignatureRiskType.UNLIMITED_APPROVAL).toBe('unlimited_approval')
    expect(SignatureRiskType.NFT_APPROVAL_ALL).toBe('nft_approval_all')
    expect(SignatureRiskType.MALFORMED_DATA).toBe('malformed_data')
  })
})

describe('SignatureMethod', () => {
  it('should have correct signature methods', () => {
    expect(SignatureMethod.ETH_SIGN).toBe('eth_sign')
    expect(SignatureMethod.PERSONAL_SIGN).toBe('personal_sign')
    expect(SignatureMethod.ETH_SIGN_TYPED_DATA).toBe('eth_signTypedData')
    expect(SignatureMethod.ETH_SIGN_TYPED_DATA_V4).toBe('eth_signTypedData_v4')
  })
})

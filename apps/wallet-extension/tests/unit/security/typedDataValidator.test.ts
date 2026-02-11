// Unmock to test real implementation
jest.unmock('@stablenet/core')

import { createTypedDataValidator, type TypedData, TypedDataValidator } from '@stablenet/core'

const typedDataValidator = createTypedDataValidator()

describe('TypedDataValidator', () => {
  let validator: TypedDataValidator

  beforeEach(() => {
    validator = new TypedDataValidator()
  })

  const validTypedData: TypedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' },
      ],
    },
    primaryType: 'Person',
    domain: {
      name: 'My App',
      version: '1',
      chainId: 1,
      verifyingContract: '0x1234567890123456789012345678901234567890',
    },
    message: {
      name: 'John',
      wallet: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    },
  }

  describe('validateTypedData', () => {
    describe('structure validation', () => {
      it('should validate correct typed data structure', () => {
        const result = validator.validateTypedData(validTypedData, 1, 'https://myapp.com')

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject non-object typed data', () => {
        const result = validator.validateTypedData('invalid', 1, 'https://example.com')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Typed data must be an object')
      })

      it('should reject null typed data', () => {
        const result = validator.validateTypedData(null, 1, 'https://example.com')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Typed data must be an object')
      })

      it('should require types field', () => {
        const data = { ...validTypedData, types: undefined }
        const result = validator.validateTypedData(data, 1, 'https://example.com')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Typed data must have "types" field')
      })

      it('should require primaryType field', () => {
        const data = { ...validTypedData, primaryType: undefined }
        const result = validator.validateTypedData(data, 1, 'https://example.com')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Typed data must have "primaryType" field')
      })

      it('should require message field', () => {
        const data = { ...validTypedData, message: undefined }
        const result = validator.validateTypedData(data, 1, 'https://example.com')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Typed data must have "message" field')
      })

      it('should require domain field', () => {
        const data = { ...validTypedData, domain: undefined }
        const result = validator.validateTypedData(data, 1, 'https://example.com')

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Typed data must have "domain" field')
      })
    })

    describe('chain ID validation', () => {
      it('should warn when chain ID mismatches', () => {
        const data = {
          ...validTypedData,
          domain: { ...validTypedData.domain, chainId: 137 }, // Polygon
        }
        const result = validator.validateTypedData(
          data,
          1, // Mainnet
          'https://example.com'
        )

        expect(result.isValid).toBe(true) // Still valid, but with warning
        const warning = result.warnings.find((w) => w.type === 'chain_mismatch')
        expect(warning).toBeDefined()
        expect(warning?.severity).toBe('critical')
      })

      it('should warn when chain ID is missing', () => {
        const data = {
          ...validTypedData,
          domain: {
            name: 'My App',
            verifyingContract: '0x1234567890123456789012345678901234567890',
          },
        }
        const result = validator.validateTypedData(data, 1, 'https://example.com')

        const warning = result.warnings.find((w) => w.type === 'missing_chain_id')
        expect(warning).toBeDefined()
        expect(warning?.severity).toBe('medium')
      })

      it('should handle hex chain ID', () => {
        const data = {
          ...validTypedData,
          domain: { ...validTypedData.domain, chainId: '0x1' },
        }
        const result = validator.validateTypedData(data, 1, 'https://example.com')

        const chainMismatchWarning = result.warnings.find((w) => w.type === 'chain_mismatch')
        expect(chainMismatchWarning).toBeUndefined()
      })

      it('should handle string decimal chain ID', () => {
        const data = {
          ...validTypedData,
          domain: { ...validTypedData.domain, chainId: '1' },
        }
        const result = validator.validateTypedData(data, 1, 'https://example.com')

        const chainMismatchWarning = result.warnings.find((w) => w.type === 'chain_mismatch')
        expect(chainMismatchWarning).toBeUndefined()
      })
    })

    describe('verifying contract validation', () => {
      it('should warn when verifying contract is missing', () => {
        const data = {
          ...validTypedData,
          domain: { name: 'My App', chainId: 1 },
        }
        const result = validator.validateTypedData(data, 1, 'https://example.com')

        const warning = result.warnings.find((w) => w.type === 'missing_verifying_contract')
        expect(warning).toBeDefined()
        expect(warning?.severity).toBe('low')
      })

      it('should warn when verifying contract is invalid', () => {
        const data = {
          ...validTypedData,
          domain: {
            ...validTypedData.domain,
            verifyingContract: 'invalid-address',
          },
        }
        const result = validator.validateTypedData(data, 1, 'https://example.com')

        const warning = result.warnings.find((w) => w.type === 'invalid_verifying_contract')
        expect(warning).toBeDefined()
        expect(warning?.severity).toBe('high')
      })
    })

    describe('domain name validation', () => {
      it('should warn when domain name does not match origin', () => {
        const data = {
          ...validTypedData,
          domain: {
            ...validTypedData.domain,
            name: 'SomeOtherApp',
          },
        }
        const result = validator.validateTypedData(data, 1, 'https://myapp.com')

        const warning = result.warnings.find((w) => w.type === 'domain_origin_mismatch')
        expect(warning).toBeDefined()
      })

      it('should detect Uniswap impersonation', () => {
        const data = {
          ...validTypedData,
          domain: {
            ...validTypedData.domain,
            name: 'Uniswap V3',
          },
        }
        const result = validator.validateTypedData(
          data,
          1,
          'https://fake-uniswap.com' // Not legitimate Uniswap domain
        )

        const warning = result.warnings.find((w) => w.type === 'domain_origin_mismatch')
        expect(warning).toBeDefined()
        expect(warning?.severity).toBe('critical')
      })

      it('should not warn for legitimate Uniswap domain', () => {
        const data = {
          ...validTypedData,
          domain: {
            ...validTypedData.domain,
            name: 'Uniswap V3',
          },
        }
        const result = validator.validateTypedData(data, 1, 'https://app.uniswap.org')

        const criticalMismatch = result.warnings.find(
          (w) => w.type === 'domain_origin_mismatch' && w.severity === 'critical'
        )
        expect(criticalMismatch).toBeUndefined()
      })

      it('should detect OpenSea impersonation', () => {
        const data = {
          ...validTypedData,
          domain: {
            ...validTypedData.domain,
            name: 'OpenSea',
          },
        }
        const result = validator.validateTypedData(data, 1, 'https://opensea-phishing.com')

        const warning = result.warnings.find((w) => w.type === 'domain_origin_mismatch')
        expect(warning).toBeDefined()
        expect(warning?.severity).toBe('critical')
      })
    })

    describe('suspicious pattern detection', () => {
      it('should detect suspicious domain names', () => {
        const suspiciousNames = [
          'UniswapX Free Airdrop',
          'OpenSea Rewards',
          'MetaMask Verification',
          'Claim Your Reward',
          'Free NFT Airdrop',
          'Urgent Action Required',
        ]

        for (const name of suspiciousNames) {
          const data = {
            ...validTypedData,
            domain: { ...validTypedData.domain, name },
          }
          const result = validator.validateTypedData(data, 1, 'https://example.com')

          const warning = result.warnings.find((w) => w.type === 'suspicious_domain_name')
          expect(warning).toBeDefined()
        }
      })
    })

    describe('empty domain', () => {
      it('should warn about empty domain', () => {
        const data = {
          ...validTypedData,
          domain: {},
        }
        const result = validator.validateTypedData(data, 1, 'https://example.com')

        const warning = result.warnings.find((w) => w.type === 'empty_domain')
        expect(warning).toBeDefined()
        expect(warning?.severity).toBe('medium')
      })
    })

    describe('permit signature detection', () => {
      it('should detect EIP-2612 permit signatures', () => {
        const permitData: TypedData = {
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
            name: 'USDC',
            version: '1',
            chainId: 1,
            verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          },
          message: {
            owner: '0x1234567890123456789012345678901234567890',
            spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            value: '1000000000000000000',
            nonce: 0,
            deadline: 1700000000,
          },
        }

        const result = validator.validateTypedData(permitData, 1, 'https://example.com')

        const warning = result.warnings.find((w) => w.type === 'permit_signature')
        expect(warning).toBeDefined()
        expect(warning?.severity).toBe('high')
      })

      it('should detect Permit2 signatures', () => {
        const permit2Data: TypedData = {
          types: {
            EIP712Domain: [],
            Permit2: [
              { name: 'details', type: 'PermitDetails' },
              { name: 'spender', type: 'address' },
              { name: 'sigDeadline', type: 'uint256' },
            ],
          },
          primaryType: 'Permit2',
          domain: {
            name: 'Permit2',
            chainId: 1,
            verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
          },
          message: {
            details: {},
            spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            sigDeadline: 1700000000,
          },
        }

        const result = validator.validateTypedData(permit2Data, 1, 'https://example.com')

        const warning = result.warnings.find((w) => w.type === 'permit_signature')
        expect(warning).toBeDefined()
      })
    })

    describe('high value approval detection', () => {
      it('should detect unlimited approval (max uint256 hex)', () => {
        const data = {
          ...validTypedData,
          primaryType: 'Permit',
          message: {
            spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            value: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            nonce: 0,
            deadline: 1700000000,
          },
        }

        const result = validator.validateTypedData(data, 1, 'https://example.com')

        const warning = result.warnings.find((w) => w.type === 'high_value_approval')
        expect(warning).toBeDefined()
        expect(warning?.severity).toBe('critical')
      })

      it('should detect unlimited approval (max uint256 decimal)', () => {
        const data = {
          ...validTypedData,
          message: {
            amount:
              '115792089237316195423570985008687907853269984665640564039457584007913129639935',
          },
        }

        const result = validator.validateTypedData(data, 1, 'https://example.com')

        const warning = result.warnings.find((w) => w.type === 'high_value_approval')
        expect(warning).toBeDefined()
      })
    })
  })

  describe('getRiskLevel', () => {
    it('should return critical for critical warnings', () => {
      const warnings = [
        { type: 'chain_mismatch' as const, message: 'test', severity: 'critical' as const },
      ]
      expect(validator.getRiskLevel(warnings)).toBe('critical')
    })

    it('should return high for high warnings', () => {
      const warnings = [
        { type: 'permit_signature' as const, message: 'test', severity: 'high' as const },
      ]
      expect(validator.getRiskLevel(warnings)).toBe('high')
    })

    it('should return medium for medium warnings', () => {
      const warnings = [
        { type: 'empty_domain' as const, message: 'test', severity: 'medium' as const },
      ]
      expect(validator.getRiskLevel(warnings)).toBe('medium')
    })

    it('should return low for low or no warnings', () => {
      expect(validator.getRiskLevel([])).toBe('low')
      const warnings = [
        { type: 'missing_verifying_contract' as const, message: 'test', severity: 'low' as const },
      ]
      expect(validator.getRiskLevel(warnings)).toBe('low')
    })

    it('should prioritize critical over other severities', () => {
      const warnings = [
        { type: 'missing_verifying_contract' as const, message: 'test', severity: 'low' as const },
        { type: 'empty_domain' as const, message: 'test', severity: 'medium' as const },
        { type: 'permit_signature' as const, message: 'test', severity: 'high' as const },
        { type: 'chain_mismatch' as const, message: 'test', severity: 'critical' as const },
      ]
      expect(validator.getRiskLevel(warnings)).toBe('critical')
    })
  })

  describe('formatWarningsForDisplay', () => {
    it('should format warnings with severity icons', () => {
      const warnings = [
        {
          type: 'chain_mismatch' as const,
          message: 'Chain mismatch',
          severity: 'critical' as const,
        },
        {
          type: 'permit_signature' as const,
          message: 'Permit detected',
          severity: 'high' as const,
        },
        { type: 'empty_domain' as const, message: 'Empty domain', severity: 'medium' as const },
        {
          type: 'missing_verifying_contract' as const,
          message: 'Missing contract',
          severity: 'low' as const,
        },
      ]

      const formatted = validator.formatWarningsForDisplay(warnings)

      expect(formatted[0]).toContain('🚨')
      expect(formatted[0]).toContain('Chain mismatch')
      expect(formatted[1]).toContain('⚠️')
      expect(formatted[2]).toContain('⚡')
      expect(formatted[3]).toContain('ℹ️')
    })

    it('should sort by severity (critical first)', () => {
      const warnings = [
        { type: 'missing_verifying_contract' as const, message: 'Low', severity: 'low' as const },
        { type: 'chain_mismatch' as const, message: 'Critical', severity: 'critical' as const },
        { type: 'empty_domain' as const, message: 'Medium', severity: 'medium' as const },
      ]

      const formatted = validator.formatWarningsForDisplay(warnings)

      expect(formatted[0]).toContain('Critical')
      expect(formatted[1]).toContain('Medium')
      expect(formatted[2]).toContain('Low')
    })
  })

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(typedDataValidator).toBeInstanceOf(TypedDataValidator)
    })
  })
})

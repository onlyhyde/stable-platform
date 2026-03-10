/**
 * AuthorizationRiskAnalyzer Tests
 *
 * T1: Security module coverage - EIP-7702 authorization risk analysis
 */

import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { ZERO_ADDRESS } from '../../src/eip7702/constants'
import {
  analyzeAuthorizationRisk,
  formatRiskWarningsForUI,
  getAuthorizationSummary,
} from '../../src/security/authorizationRiskAnalyzer'

const ACCOUNT = '0x1234567890123456789012345678901234567890' as Address
const UNKNOWN_CONTRACT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address

describe('AuthorizationRiskAnalyzer', () => {
  // ========================================================================
  // analyzeAuthorizationRisk
  // ========================================================================

  describe('analyzeAuthorizationRisk', () => {
    it('should return low risk for revocation (zero address)', () => {
      const result = analyzeAuthorizationRisk({
        account: ACCOUNT,
        contractAddress: ZERO_ADDRESS,
        chainId: 1,
        origin: 'https://app.stablenet.io',
      })

      expect(result.riskLevel).toBe('low')
      expect(result.isKnownContract).toBe(true)
      expect(result.contractInfo?.name).toBe('Revocation')
    })

    it('should return high risk for unknown contract', () => {
      const result = analyzeAuthorizationRisk({
        account: ACCOUNT,
        contractAddress: UNKNOWN_CONTRACT,
        chainId: 11155111, // Sepolia
        origin: 'https://app.stablenet.io',
      })

      expect(result.riskLevel).toBe('high')
      expect(result.isKnownContract).toBe(false)
      expect(result.warnings.some((w) => w.includes('not recognized'))).toBe(true)
    })

    it('should elevate risk for mainnet', () => {
      const result = analyzeAuthorizationRisk({
        account: ACCOUNT,
        contractAddress: UNKNOWN_CONTRACT,
        chainId: 1, // Mainnet
        origin: 'https://app.stablenet.io',
      })

      // Unknown contract on mainnet: at least high
      expect(result.riskLevel).toBe('high')
      expect(result.warnings.some((w) => w.includes('mainnet'))).toBe(true)
    })

    it('should warn about untrusted origins for unknown contracts', () => {
      const result = analyzeAuthorizationRisk({
        account: ACCOUNT,
        contractAddress: UNKNOWN_CONTRACT,
        chainId: 11155111,
        origin: 'https://evil-site.com',
      })

      expect(result.warnings.some((w) => w.includes('Verify this is a trusted'))).toBe(true)
    })

    it('should always include delegation implications warning', () => {
      const result = analyzeAuthorizationRisk({
        account: ACCOUNT,
        contractAddress: UNKNOWN_CONTRACT,
        chainId: 11155111,
        origin: 'https://app.stablenet.io',
      })

      expect(result.warnings.some((w) => w.includes('delegate contract controls'))).toBe(true)
    })
  })

  // ========================================================================
  // getAuthorizationSummary
  // ========================================================================

  describe('getAuthorizationSummary', () => {
    it('should return "Revoke Smart Account" for zero address', () => {
      expect(
        getAuthorizationSummary({
          contractAddress: ZERO_ADDRESS,
          chainId: 1,
          isKnownContract: true,
          contractInfo: { name: 'Revocation' },
        })
      ).toBe('Revoke Smart Account')
    })

    it('should format known contract name', () => {
      expect(
        getAuthorizationSummary({
          contractAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
          chainId: 1,
          isKnownContract: true,
          contractInfo: { name: 'Kernel v3.1' },
        })
      ).toBe('Upgrade to Kernel v3.1')
    })

    it('should format unknown contract with short address', () => {
      const summary = getAuthorizationSummary({
        contractAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
        chainId: 1,
        isKnownContract: false,
      })

      expect(summary).toContain('Delegate to')
      expect(summary).toContain('0xaaaaaa')
      expect(summary).toContain('Chain 1')
    })
  })

  // ========================================================================
  // formatRiskWarningsForUI
  // ========================================================================

  describe('formatRiskWarningsForUI', () => {
    it('should format danger for unrecognized contract warnings', () => {
      const result = analyzeAuthorizationRisk({
        account: ACCOUNT,
        contractAddress: UNKNOWN_CONTRACT,
        chainId: 11155111,
        origin: 'https://evil-site.com',
      })
      const formatted = formatRiskWarningsForUI(result)

      expect(formatted.some((f) => f.type === 'danger')).toBe(true)
    })

    it('should format warning for caution messages', () => {
      const result = analyzeAuthorizationRisk({
        account: ACCOUNT,
        contractAddress: UNKNOWN_CONTRACT,
        chainId: 1, // mainnet → caution
        origin: 'https://app.stablenet.io',
      })
      const formatted = formatRiskWarningsForUI(result)

      expect(formatted.some((f) => f.type === 'warning')).toBe(true)
    })

    it('should format info for general messages', () => {
      const result = analyzeAuthorizationRisk({
        account: ACCOUNT,
        contractAddress: ZERO_ADDRESS,
        chainId: 1,
        origin: 'https://app.stablenet.io',
      })
      const formatted = formatRiskWarningsForUI(result)

      expect(formatted.some((f) => f.type === 'info')).toBe(true)
    })
  })
})

/**
 * Phishing Detector Tests
 */

import { describe, expect, it } from 'vitest'
import {
  createPhishingDetector,
  PhishingDetector,
  PhishingPatternType,
  RiskLevel,
} from '../../src/security/phishingDetector'

describe('PhishingDetector', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const detector = new PhishingDetector()
      // Trusted domains should work
      const result = detector.checkUrl('https://uniswap.org')
      expect(result.isSafe).toBe(true)
    })

    it('should accept custom blocklist', () => {
      const detector = new PhishingDetector({
        blocklist: ['evil.com'],
      })
      const result = detector.checkUrl('https://evil.com')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL)
    })

    it('should accept custom allowlist', () => {
      const detector = new PhishingDetector({
        allowlist: ['custom-safe.com'],
      })
      const result = detector.checkUrl('https://custom-safe.com')
      expect(result.isSafe).toBe(true)
      expect(result.riskLevel).toBe(RiskLevel.SAFE)
    })

    it('should accept custom trusted domains', () => {
      const detector = new PhishingDetector({
        trustedDomains: ['mydapp.com'],
      })
      const result = detector.checkUrl('https://mydapp.com')
      expect(result.isSafe).toBe(true)
    })
  })

  describe('createPhishingDetector factory', () => {
    it('should create a PhishingDetector instance', () => {
      const detector = createPhishingDetector()
      expect(detector).toBeInstanceOf(PhishingDetector)
    })

    it('should forward config to constructor', () => {
      const detector = createPhishingDetector({ blocklist: ['bad.com'] })
      const result = detector.checkUrl('https://bad.com')
      expect(result.isSafe).toBe(false)
    })
  })

  describe('checkUrl', () => {
    const detector = new PhishingDetector()

    it('should mark invalid URL as unsafe', () => {
      const result = detector.checkUrl('not-a-url')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM)
      expect(result.patternType).toBe(PhishingPatternType.INVALID_URL)
    })

    it('should mark trusted domains as safe', () => {
      const result = detector.checkUrl('https://uniswap.org')
      expect(result.isSafe).toBe(true)
      expect(result.riskLevel).toBe(RiskLevel.SAFE)
    })

    it('should mark trusted domain subdomains as safe', () => {
      const result = detector.checkUrl('https://app.uniswap.org')
      expect(result.isSafe).toBe(true)
      expect(result.riskLevel).toBe(RiskLevel.SAFE)
    })

    it('should detect blocklisted domains', () => {
      const detector = new PhishingDetector({
        blocklist: ['phishing-site.com'],
      })
      const result = detector.checkUrl('https://phishing-site.com')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL)
      expect(result.patternType).toBe(PhishingPatternType.BLOCKLISTED)
    })

    it('should detect blocklisted base domain via subdomain', () => {
      const detector = new PhishingDetector({
        blocklist: ['phishing.com'],
      })
      const result = detector.checkUrl('https://app.phishing.com')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL)
    })

    it('should prioritize allowlist over blocklist', () => {
      const detector = new PhishingDetector({
        blocklist: ['example.com'],
        allowlist: ['example.com'],
      })
      const result = detector.checkUrl('https://example.com')
      expect(result.isSafe).toBe(true)
      expect(result.riskLevel).toBe(RiskLevel.SAFE)
    })

    it('should detect IP address URLs', () => {
      const result = detector.checkUrl('http://192.168.1.1')
      expect(result.isSafe).toBe(false)
      expect(result.patternType).toBe(PhishingPatternType.IP_ADDRESS)
    })

    it('should warn about HTTP connections', () => {
      // An unknown HTTP domain
      const result = detector.checkUrl('http://some-unknown-site.com')
      expect(result.warnings).toContain('Connection is not secure (HTTP)')
    })

    it('should detect punycode domains', () => {
      const result = detector.checkUrl('https://xn--nswap-3ra.org')
      expect(result.isSafe).toBe(false)
      expect(result.patternType).toBe(PhishingPatternType.HOMOGRAPH)
    })

    it('should detect suspicious subdomains', () => {
      const result = detector.checkUrl('https://metamask.evil-site.com')
      expect(result.isSafe).toBe(false)
      expect(result.patternType).toBe(PhishingPatternType.SUSPICIOUS_SUBDOMAIN)
    })

    it('should not flag suspicious subdomains on trusted base domains', () => {
      // uniswap.org is trusted, so a subdomain containing "wallet" should be fine
      const result = detector.checkUrl('https://wallet.uniswap.org')
      expect(result.isSafe).toBe(true)
    })

    it('should return domain info in result', () => {
      const result = detector.checkUrl('https://app.uniswap.org/swap')
      expect(result.url).toBe('https://app.uniswap.org/swap')
      expect(result.domain).toBe('app.uniswap.org')
      expect(result.baseDomain).toBe('uniswap.org')
    })

    it('should detect typosquatting of trusted domains', () => {
      // "unisswap" is similar to "uniswap"
      const result = detector.checkUrl('https://unisswap.org')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.HIGH)
      expect(result.patternType).toBe(PhishingPatternType.TYPOSQUATTING)
    })

    it('should flag suspicious TLDs', () => {
      const result = detector.checkUrl('https://something.xyz')
      expect(result.warnings).toContain('Domain uses suspicious TLD')
    })

    it('should treat unknown domains as not safe', () => {
      const result = detector.checkUrl('https://completely-unknown-domain.com')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.LOW)
    })
  })

  describe('checkDomain', () => {
    const detector = new PhishingDetector()

    it('should mark trusted domain as safe', () => {
      const result = detector.checkDomain('uniswap.org')
      expect(result.isSafe).toBe(true)
      expect(result.riskLevel).toBe(RiskLevel.SAFE)
    })

    it('should detect blocklisted domain', () => {
      const detector = new PhishingDetector({ blocklist: ['evil.com'] })
      const result = detector.checkDomain('evil.com')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL)
    })

    it('should prioritize allowlist', () => {
      const detector = new PhishingDetector({
        blocklist: ['dual.com'],
        allowlist: ['dual.com'],
      })
      const result = detector.checkDomain('dual.com')
      expect(result.isSafe).toBe(true)
    })

    it('should return baseDomain for subdomains', () => {
      const result = detector.checkDomain('app.uniswap.org')
      expect(result.baseDomain).toBe('uniswap.org')
    })

    it('should treat unknown domain with suspicious TLD as medium risk', () => {
      const result = detector.checkDomain('sketchy-site.xyz')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM)
    })

    it('should treat unknown domain without suspicious TLD as low risk', () => {
      const result = detector.checkDomain('unknown-site.com')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.LOW)
    })
  })

  describe('getSimilarityScore', () => {
    const detector = new PhishingDetector()

    it('should return 1 for identical strings', () => {
      expect(detector.getSimilarityScore('uniswap', 'uniswap')).toBe(1)
    })

    it('should return 1 for case-insensitive identical strings', () => {
      expect(detector.getSimilarityScore('Uniswap', 'uniswap')).toBe(1)
    })

    it('should return 0 for completely different strings', () => {
      expect(detector.getSimilarityScore('abc', 'xyz')).toBeLessThan(0.5)
    })

    it('should detect similar strings (typo)', () => {
      const score = detector.getSimilarityScore('uniswap', 'unisswap')
      expect(score).toBeGreaterThan(0.7)
      expect(score).toBeLessThan(1)
    })

    it('should return 1 for two empty strings', () => {
      expect(detector.getSimilarityScore('', '')).toBe(1)
    })
  })

  describe('list management', () => {
    it('should add to blocklist', () => {
      const detector = new PhishingDetector()
      detector.addToBlocklist('new-phishing.com')
      const result = detector.checkUrl('https://new-phishing.com')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL)
    })

    it('should remove from blocklist', () => {
      const detector = new PhishingDetector({ blocklist: ['site.com'] })
      detector.removeFromBlocklist('site.com')
      const result = detector.checkUrl('https://site.com')
      expect(result.patternType).not.toBe(PhishingPatternType.BLOCKLISTED)
    })

    it('should add to allowlist', () => {
      const detector = new PhishingDetector()
      detector.addToAllowlist('my-safe-site.com')
      const result = detector.checkUrl('https://my-safe-site.com')
      expect(result.isSafe).toBe(true)
    })

    it('should remove from allowlist', () => {
      const detector = new PhishingDetector({ allowlist: ['site.com'] })
      detector.removeFromAllowlist('site.com')
      const result = detector.checkUrl('https://site.com')
      // No longer explicitly safe
      expect(result.riskLevel).not.toBe(RiskLevel.SAFE)
    })

    it('should add trusted domains', () => {
      const detector = new PhishingDetector({ trustedDomains: [] })
      detector.addTrustedDomains(['newdapp.com'])
      const result = detector.checkUrl('https://newdapp.com')
      expect(result.isSafe).toBe(true)
    })

    it('should handle case-insensitive blocklist', () => {
      const detector = new PhishingDetector()
      detector.addToBlocklist('EVIL.COM')
      const result = detector.checkUrl('https://evil.com')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL)
    })
  })
})

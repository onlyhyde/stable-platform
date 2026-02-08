/**
 * Phishing Detection System Tests
 * TDD tests for URL and domain security validation
 */

// Unmock to test real implementation
jest.unmock('@stablenet/core')

import {
  PhishingDetector,
  PhishingPatternType,
  type PhishingResult,
  RiskLevel,
} from '@stablenet/core'

describe('PhishingDetector', () => {
  let detector: PhishingDetector

  beforeEach(() => {
    detector = new PhishingDetector()
  })

  describe('constructor', () => {
    it('should create instance with default blocklist', () => {
      expect(detector).toBeInstanceOf(PhishingDetector)
    })

    it('should accept custom blocklist', () => {
      const customDetector = new PhishingDetector({
        blocklist: ['malicious.com', 'phishing.org'],
      })
      expect(customDetector).toBeInstanceOf(PhishingDetector)
    })

    it('should accept custom allowlist', () => {
      const customDetector = new PhishingDetector({
        allowlist: ['trusted.com', 'safe.org'],
      })
      expect(customDetector).toBeInstanceOf(PhishingDetector)
    })
  })

  describe('checkUrl', () => {
    it('should return safe for valid trusted domains', () => {
      const result = detector.checkUrl('https://app.uniswap.org')

      expect(result.isSafe).toBe(true)
      expect(result.riskLevel).toBe(RiskLevel.SAFE)
    })

    it('should return unsafe for known phishing domains', () => {
      const customDetector = new PhishingDetector({
        blocklist: ['fake-metamask.com'],
      })
      const result = customDetector.checkUrl('https://fake-metamask.com')

      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL)
      expect(result.patternType).toBe(PhishingPatternType.BLOCKLISTED)
    })

    it('should detect typosquatting attacks', () => {
      const result = detector.checkUrl('https://uniswpa.org')

      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.HIGH)
      expect(result.patternType).toBe(PhishingPatternType.TYPOSQUATTING)
    })

    it('should detect punycode/homograph attacks', () => {
      // Using Cyrillic 'а' instead of Latin 'a'
      const result = detector.checkUrl('https://unіswap.org') // 'і' is Cyrillic

      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL)
      expect(result.patternType).toBe(PhishingPatternType.HOMOGRAPH)
    })

    it('should detect suspicious subdomains', () => {
      const result = detector.checkUrl('https://metamask.fake-wallet.com')

      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.HIGH)
      expect(result.patternType).toBe(PhishingPatternType.SUSPICIOUS_SUBDOMAIN)
    })

    it('should allow custom allowlisted domains', () => {
      const customDetector = new PhishingDetector({
        allowlist: ['my-safe-dapp.com'],
      })
      const result = customDetector.checkUrl('https://my-safe-dapp.com')

      expect(result.isSafe).toBe(true)
      expect(result.riskLevel).toBe(RiskLevel.SAFE)
    })

    it('should handle invalid URLs gracefully', () => {
      const result = detector.checkUrl('not-a-valid-url')

      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM)
      expect(result.patternType).toBe(PhishingPatternType.INVALID_URL)
    })

    it('should detect IP address URLs as suspicious', () => {
      const result = detector.checkUrl('http://192.168.1.1/wallet')

      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM)
      expect(result.patternType).toBe(PhishingPatternType.IP_ADDRESS)
    })

    it('should warn about HTTP (non-HTTPS) connections', () => {
      const result = detector.checkUrl('http://uniswap.org')

      expect(result.warnings).toContain('Connection is not secure (HTTP)')
    })
  })

  describe('checkDomain', () => {
    it('should extract and check domain from URL', () => {
      const result = detector.checkDomain('uniswap.org')

      expect(result.domain).toBe('uniswap.org')
      expect(result.isSafe).toBe(true)
    })

    it('should handle subdomains correctly', () => {
      const result = detector.checkDomain('app.uniswap.org')

      expect(result.domain).toBe('app.uniswap.org')
      expect(result.baseDomain).toBe('uniswap.org')
    })

    it('should detect newly registered domains', () => {
      // Simulated check - in real implementation would check domain age
      const result = detector.checkDomain('crypto-airdrop-2024.xyz')

      expect(result.warnings).toContain('Domain uses suspicious TLD')
    })
  })

  describe('getSimilarityScore', () => {
    it('should return high similarity for similar strings', () => {
      const score = detector.getSimilarityScore('uniswap', 'uniswpa')

      // Levenshtein similarity for swapped characters
      expect(score).toBeGreaterThan(0.7)
    })

    it('should return low similarity for different strings', () => {
      const score = detector.getSimilarityScore('uniswap', 'metamask')

      expect(score).toBeLessThan(0.5)
    })

    it('should return 1 for identical strings', () => {
      const score = detector.getSimilarityScore('uniswap', 'uniswap')

      expect(score).toBe(1)
    })
  })

  describe('addToBlocklist', () => {
    it('should add domain to blocklist', () => {
      detector.addToBlocklist('new-phishing-site.com')
      const result = detector.checkUrl('https://new-phishing-site.com')

      expect(result.isSafe).toBe(false)
      expect(result.patternType).toBe(PhishingPatternType.BLOCKLISTED)
    })
  })

  describe('addToAllowlist', () => {
    it('should add domain to allowlist', () => {
      detector.addToAllowlist('my-trusted-dapp.com')
      const result = detector.checkUrl('https://my-trusted-dapp.com')

      expect(result.isSafe).toBe(true)
    })

    it('should override blocklist for allowlisted domains', () => {
      detector.addToBlocklist('dual-listed.com')
      detector.addToAllowlist('dual-listed.com')
      const result = detector.checkUrl('https://dual-listed.com')

      expect(result.isSafe).toBe(true)
    })
  })

  describe('removeFromBlocklist', () => {
    it('should remove domain from blocklist', () => {
      detector.addToBlocklist('temporary-block.com')
      detector.removeFromBlocklist('temporary-block.com')
      const result = detector.checkUrl('https://temporary-block.com')

      expect(result.patternType).not.toBe(PhishingPatternType.BLOCKLISTED)
    })
  })

  describe('removeFromAllowlist', () => {
    it('should remove domain from allowlist', () => {
      detector.addToAllowlist('temporary-allow.com')
      detector.removeFromAllowlist('temporary-allow.com')
      const result = detector.checkUrl('https://temporary-allow.com')

      // Should be checked normally after removal - unknown domains are not safe
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.LOW) // Unknown domain, low risk
    })
  })
})

describe('PhishingResult', () => {
  it('should have required properties', () => {
    const result: PhishingResult = {
      url: 'https://test.com',
      domain: 'test.com',
      isSafe: true,
      riskLevel: RiskLevel.SAFE,
      warnings: [],
    }

    expect(result.url).toBeDefined()
    expect(result.domain).toBeDefined()
    expect(result.isSafe).toBeDefined()
    expect(result.riskLevel).toBeDefined()
    expect(result.warnings).toBeDefined()
  })

  it('should include pattern type for unsafe results', () => {
    const result: PhishingResult = {
      url: 'https://phishing.com',
      domain: 'phishing.com',
      isSafe: false,
      riskLevel: RiskLevel.CRITICAL,
      patternType: PhishingPatternType.BLOCKLISTED,
      warnings: ['Domain is blocklisted'],
      details: 'This domain has been reported for phishing',
    }

    expect(result.patternType).toBe(PhishingPatternType.BLOCKLISTED)
    expect(result.details).toBeDefined()
  })
})

describe('RiskLevel', () => {
  it('should have correct risk levels', () => {
    expect(RiskLevel.SAFE).toBe('safe')
    expect(RiskLevel.LOW).toBe('low')
    expect(RiskLevel.MEDIUM).toBe('medium')
    expect(RiskLevel.HIGH).toBe('high')
    expect(RiskLevel.CRITICAL).toBe('critical')
  })
})

describe('PhishingPatternType', () => {
  it('should have correct pattern types', () => {
    expect(PhishingPatternType.BLOCKLISTED).toBe('blocklisted')
    expect(PhishingPatternType.TYPOSQUATTING).toBe('typosquatting')
    expect(PhishingPatternType.HOMOGRAPH).toBe('homograph')
    expect(PhishingPatternType.SUSPICIOUS_SUBDOMAIN).toBe('suspicious_subdomain')
    expect(PhishingPatternType.IP_ADDRESS).toBe('ip_address')
    expect(PhishingPatternType.INVALID_URL).toBe('invalid_url')
  })
})

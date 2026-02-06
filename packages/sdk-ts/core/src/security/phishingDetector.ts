/**
 * Phishing Detection System
 * URL and domain security validation for wallet protection
 */

/**
 * Risk level enumeration
 */
export const RiskLevel = {
  SAFE: 'safe',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export type RiskLevelType = (typeof RiskLevel)[keyof typeof RiskLevel]

/**
 * Phishing pattern type enumeration
 */
export const PhishingPatternType = {
  BLOCKLISTED: 'blocklisted',
  TYPOSQUATTING: 'typosquatting',
  HOMOGRAPH: 'homograph',
  SUSPICIOUS_SUBDOMAIN: 'suspicious_subdomain',
  IP_ADDRESS: 'ip_address',
  INVALID_URL: 'invalid_url',
  SUSPICIOUS_TLD: 'suspicious_tld',
} as const

export type PhishingPatternTypeValue =
  (typeof PhishingPatternType)[keyof typeof PhishingPatternType]

/**
 * Phishing check result interface
 */
export interface PhishingResult {
  url: string
  domain: string
  baseDomain?: string
  isSafe: boolean
  riskLevel: RiskLevelType
  patternType?: PhishingPatternTypeValue
  warnings: string[]
  details?: string
}

/**
 * Domain check result interface
 */
export interface DomainResult {
  domain: string
  baseDomain?: string
  isSafe: boolean
  riskLevel: RiskLevelType
  warnings: string[]
}

/**
 * Phishing detector configuration
 */
export interface PhishingDetectorConfig {
  blocklist?: string[]
  allowlist?: string[]
  trustedDomains?: string[]
}

/**
 * Known trusted Web3 domains
 */
const DEFAULT_TRUSTED_DOMAINS = [
  'uniswap.org',
  'opensea.io',
  'metamask.io',
  'etherscan.io',
  'aave.com',
  'compound.finance',
  'curve.fi',
  'sushiswap.com',
  'balancer.fi',
  '1inch.io',
]

/**
 * Suspicious TLDs commonly used in phishing
 */
const SUSPICIOUS_TLDS = [
  '.xyz',
  '.top',
  '.work',
  '.click',
  '.tk',
  '.ml',
  '.ga',
  '.cf',
  '.gq',
  '.buzz',
  '.monster',
]

/**
 * Characters that look similar to ASCII (homograph attacks)
 */
const CONFUSABLE_CHARS: Record<string, string> = {
  а: 'a', // Cyrillic
  е: 'e', // Cyrillic
  і: 'i', // Cyrillic
  о: 'o', // Cyrillic
  р: 'p', // Cyrillic
  с: 'c', // Cyrillic
  ѕ: 's', // Cyrillic
  х: 'x', // Cyrillic
  у: 'y', // Cyrillic
  ω: 'w', // Greek
  ν: 'v', // Greek
  α: 'a', // Greek
  '0': 'o',
  '1': 'l',
}

/**
 * Phishing Detection System
 * Checks URLs and domains for potential phishing threats
 */
export class PhishingDetector {
  private blocklist: Set<string>
  private allowlist: Set<string>
  private trustedDomains: Set<string>

  constructor(config: PhishingDetectorConfig = {}) {
    this.blocklist = new Set(config.blocklist || [])
    this.allowlist = new Set(config.allowlist || [])
    this.trustedDomains = new Set(config.trustedDomains || DEFAULT_TRUSTED_DOMAINS)
  }

  /**
   * Check a URL for phishing threats
   */
  checkUrl(url: string): PhishingResult {
    const warnings: string[] = []

    // Try to parse the URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return {
        url,
        domain: '',
        isSafe: false,
        riskLevel: RiskLevel.MEDIUM,
        patternType: PhishingPatternType.INVALID_URL,
        warnings: ['Unable to parse URL'],
        details: 'The URL format is invalid',
      }
    }

    const domain = parsedUrl.hostname
    const baseDomain = this.getBaseDomain(domain)

    // Check for HTTP (non-secure) connection
    if (parsedUrl.protocol === 'http:') {
      warnings.push('Connection is not secure (HTTP)')
    }

    // Check if allowlisted (highest priority)
    if (this.isAllowlisted(domain) || this.isAllowlisted(baseDomain)) {
      return {
        url,
        domain,
        baseDomain,
        isSafe: true,
        riskLevel: RiskLevel.SAFE,
        warnings,
      }
    }

    // Check if blocklisted
    if (this.isBlocklisted(domain) || this.isBlocklisted(baseDomain)) {
      return {
        url,
        domain,
        baseDomain,
        isSafe: false,
        riskLevel: RiskLevel.CRITICAL,
        patternType: PhishingPatternType.BLOCKLISTED,
        warnings: [...warnings, 'Domain is blocklisted'],
        details: 'This domain has been reported for phishing',
      }
    }

    // Check for IP address
    if (this.isIPAddress(domain)) {
      return {
        url,
        domain,
        baseDomain,
        isSafe: false,
        riskLevel: RiskLevel.MEDIUM,
        patternType: PhishingPatternType.IP_ADDRESS,
        warnings: [...warnings, 'Direct IP address access detected'],
        details: 'Legitimate dApps rarely use IP addresses',
      }
    }

    // Check for homograph attacks (Punycode domains indicate IDN with non-ASCII chars)
    if (this.isPunycodeDomain(domain) || this.hasHomographCharacters(domain)) {
      return {
        url,
        domain,
        baseDomain,
        isSafe: false,
        riskLevel: RiskLevel.CRITICAL,
        patternType: PhishingPatternType.HOMOGRAPH,
        warnings: [...warnings, 'Potential homograph attack detected'],
        details: 'Domain contains non-ASCII characters that may look similar to ASCII letters',
      }
    }

    // Check for typosquatting
    const typosquattingTarget = this.detectTyposquatting(baseDomain)
    if (typosquattingTarget) {
      return {
        url,
        domain,
        baseDomain,
        isSafe: false,
        riskLevel: RiskLevel.HIGH,
        patternType: PhishingPatternType.TYPOSQUATTING,
        warnings: [...warnings, `Possible typosquatting of ${typosquattingTarget}`],
        details: `This domain is suspiciously similar to ${typosquattingTarget}`,
      }
    }

    // Check for suspicious subdomain patterns
    if (this.hasSuspiciousSubdomain(domain)) {
      return {
        url,
        domain,
        baseDomain,
        isSafe: false,
        riskLevel: RiskLevel.HIGH,
        patternType: PhishingPatternType.SUSPICIOUS_SUBDOMAIN,
        warnings: [...warnings, 'Suspicious subdomain pattern detected'],
        details: 'Subdomain contains known wallet/dApp names to mislead users',
      }
    }

    // Check for suspicious TLD
    if (this.hasSuspiciousTld(domain)) {
      warnings.push('Domain uses suspicious TLD')
    }

    // Check if it's a known trusted domain
    if (this.trustedDomains.has(baseDomain)) {
      return {
        url,
        domain,
        baseDomain,
        isSafe: true,
        riskLevel: RiskLevel.SAFE,
        warnings,
      }
    }

    // Default: unknown domain - treat with caution
    // Unknown domains should not be considered safe by default
    return {
      url,
      domain,
      baseDomain,
      isSafe: false,
      riskLevel: warnings.length > 0 ? RiskLevel.MEDIUM : RiskLevel.LOW,
      warnings: warnings.length > 0 ? warnings : ['Unknown domain - proceed with caution'],
    }
  }

  /**
   * Check a domain for phishing threats
   */
  checkDomain(domain: string): DomainResult {
    const warnings: string[] = []
    const baseDomain = this.getBaseDomain(domain)

    // Check for suspicious TLD
    if (this.hasSuspiciousTld(domain)) {
      warnings.push('Domain uses suspicious TLD')
    }

    // Check if allowlisted
    if (this.isAllowlisted(domain) || this.isAllowlisted(baseDomain)) {
      return {
        domain,
        baseDomain,
        isSafe: true,
        riskLevel: RiskLevel.SAFE,
        warnings,
      }
    }

    // Check if blocklisted
    if (this.isBlocklisted(domain) || this.isBlocklisted(baseDomain)) {
      return {
        domain,
        baseDomain,
        isSafe: false,
        riskLevel: RiskLevel.CRITICAL,
        warnings: [...warnings, 'Domain is blocklisted'],
      }
    }

    // Check if it's a known trusted domain
    if (this.trustedDomains.has(baseDomain) || this.trustedDomains.has(domain)) {
      return {
        domain,
        baseDomain,
        isSafe: true,
        riskLevel: RiskLevel.SAFE,
        warnings,
      }
    }

    // Unknown domains should not be considered safe by default
    return {
      domain,
      baseDomain,
      isSafe: false,
      riskLevel: warnings.length > 0 ? RiskLevel.MEDIUM : RiskLevel.LOW,
      warnings: warnings.length > 0 ? warnings : ['Unknown domain - proceed with caution'],
    }
  }

  /**
   * Calculate Levenshtein distance similarity between two strings
   * Returns a score between 0 and 1
   */
  getSimilarityScore(str1: string, str2: string): number {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()

    if (s1 === s2) return 1

    const len1 = s1.length
    const len2 = s2.length

    // Create distance matrix
    const matrix: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0))

    // Initialize first column
    for (let i = 0; i <= len1; i++) {
      const row = matrix[i]
      if (row) row[0] = i
    }

    // Initialize first row
    const firstRow = matrix[0]
    if (firstRow) {
      for (let j = 0; j <= len2; j++) {
        firstRow[j] = j
      }
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
        const currentRow = matrix[i]
        const prevRow = matrix[i - 1]
        if (currentRow && prevRow) {
          currentRow[j] = Math.min(
            (prevRow[j] ?? 0) + 1, // deletion
            (currentRow[j - 1] ?? 0) + 1, // insertion
            (prevRow[j - 1] ?? 0) + cost // substitution
          )
        }
      }
    }

    const lastRow = matrix[len1]
    const distance = lastRow?.[len2] ?? 0
    const maxLen = Math.max(len1, len2)

    return maxLen === 0 ? 1 : 1 - distance / maxLen
  }

  /**
   * Add a domain to the blocklist
   */
  addToBlocklist(domain: string): void {
    this.blocklist.add(domain.toLowerCase())
  }

  /**
   * Add a domain to the allowlist
   */
  addToAllowlist(domain: string): void {
    this.allowlist.add(domain.toLowerCase())
  }

  /**
   * Remove a domain from the blocklist
   */
  removeFromBlocklist(domain: string): void {
    this.blocklist.delete(domain.toLowerCase())
  }

  /**
   * Remove a domain from the allowlist
   */
  removeFromAllowlist(domain: string): void {
    this.allowlist.delete(domain.toLowerCase())
  }

  /**
   * Add trusted domains
   */
  addTrustedDomains(domains: string[]): void {
    for (const domain of domains) {
      this.trustedDomains.add(domain.toLowerCase())
    }
  }

  // Private helper methods

  private isBlocklisted(domain: string): boolean {
    return this.blocklist.has(domain.toLowerCase())
  }

  private isAllowlisted(domain: string): boolean {
    return this.allowlist.has(domain.toLowerCase())
  }

  private getBaseDomain(domain: string): string {
    const parts = domain.split('.')
    if (parts.length <= 2) return domain
    return parts.slice(-2).join('.')
  }

  private isIPAddress(domain: string): boolean {
    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
    // IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/

    return ipv4Pattern.test(domain) || ipv6Pattern.test(domain)
  }

  private hasHomographCharacters(domain: string): boolean {
    for (const char of domain) {
      if (CONFUSABLE_CHARS[char]) {
        return true
      }
    }
    return false
  }

  private detectTyposquatting(domain: string): string | null {
    const domainWithoutTld = domain.split('.')[0] ?? ''

    for (const trustedDomain of this.trustedDomains) {
      const trustedWithoutTld = trustedDomain.split('.')[0] ?? ''

      // Skip if it's the exact same name
      if (domainWithoutTld === trustedWithoutTld) continue

      const similarity = this.getSimilarityScore(domainWithoutTld, trustedWithoutTld)

      // High similarity but not exact match suggests typosquatting
      // Threshold 0.7 catches common typos like swapped letters
      if (similarity > 0.7 && similarity < 1) {
        return trustedDomain
      }
    }

    return null
  }

  private hasSuspiciousSubdomain(domain: string): boolean {
    const parts = domain.split('.')

    // Check if any subdomain contains known wallet/dApp names
    const suspiciousKeywords = [
      'metamask',
      'uniswap',
      'opensea',
      'ledger',
      'trezor',
      'coinbase',
      'binance',
      'wallet',
      'connect',
      'claim',
      'airdrop',
    ]

    // Only check subdomains, not the base domain
    const subdomains = parts.slice(0, -2)

    for (const subdomain of subdomains) {
      for (const keyword of suspiciousKeywords) {
        if (subdomain.toLowerCase().includes(keyword)) {
          // Check if base domain is not the legitimate one
          const baseDomain = this.getBaseDomain(domain)
          const isLegitimate = this.trustedDomains.has(baseDomain)

          if (!isLegitimate) {
            return true
          }
        }
      }
    }

    return false
  }

  private hasSuspiciousTld(domain: string): boolean {
    for (const tld of SUSPICIOUS_TLDS) {
      if (domain.endsWith(tld)) {
        return true
      }
    }
    return false
  }

  private isPunycodeDomain(domain: string): boolean {
    // Punycode domains start with 'xn--' which indicates IDN encoding
    // This means the original domain contained non-ASCII characters
    const parts = domain.split('.')
    return parts.some((part) => part.startsWith('xn--'))
  }
}

/**
 * Create a new PhishingDetector instance
 */
export function createPhishingDetector(config?: PhishingDetectorConfig): PhishingDetector {
  return new PhishingDetector(config)
}

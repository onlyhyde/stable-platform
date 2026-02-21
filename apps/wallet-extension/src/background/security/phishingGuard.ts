/**
 * Phishing Guard for Wallet Extension
 *
 * Lightweight phishing detection for connection requests.
 * Checks origin URLs against known blocklists and suspicious patterns
 * before allowing eth_requestAccounts to proceed.
 *
 * Based on patterns from @stablenet/core PhishingDetector.
 */

import { createLogger } from '../../shared/utils/logger'

const logger = createLogger('PhishingGuard')

export interface PhishingCheckResult {
  isSafe: boolean
  reason?: string
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Cached blocklisted domains - loaded from chrome.storage.local
 * Initialized empty and populated via updateBlocklist().
 */
let blocklistedDomains: Set<string> = new Set()

/** How often to refresh the blocklist from remote (4 hours) */
const BLOCKLIST_REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000

/** chrome.storage.local keys */
const STORAGE_KEY_BLOCKLIST = 'phishing_blocklist'
const STORAGE_KEY_BLOCKLIST_UPDATED = 'phishing_blocklist_updated_at'

/**
 * Load blocklist from chrome.storage.local into memory.
 * Called on extension startup to restore persisted blocklist.
 */
export async function loadBlocklist(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_BLOCKLIST)
    const domains: string[] = (result[STORAGE_KEY_BLOCKLIST] as string[] | undefined) ?? []
    if (Array.isArray(domains) && domains.length > 0) {
      blocklistedDomains = new Set(domains)
      logger.info('Loaded blocklist from storage', { count: domains.length })
    }
  } catch (err) {
    logger.error('Failed to load blocklist from storage', { error: err })
  }
}

/**
 * Update blocklist from a remote source and persist to chrome.storage.local.
 * @param remoteUrl - URL that returns a JSON array of domain strings
 */
export async function updateBlocklist(remoteUrl: string): Promise<void> {
  try {
    // Check if we need to refresh
    const stored = await chrome.storage.local.get(STORAGE_KEY_BLOCKLIST_UPDATED)
    const lastUpdated = stored[STORAGE_KEY_BLOCKLIST_UPDATED] as number | undefined
    if (lastUpdated && Date.now() - lastUpdated < BLOCKLIST_REFRESH_INTERVAL_MS) {
      return // Still fresh
    }

    const response = await fetch(remoteUrl, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data: unknown = await response.json()
    if (!Array.isArray(data) || !data.every((d) => typeof d === 'string')) {
      throw new Error('Invalid blocklist format: expected string array')
    }

    const domains = data as string[]
    blocklistedDomains = new Set(domains)

    await chrome.storage.local.set({
      [STORAGE_KEY_BLOCKLIST]: domains,
      [STORAGE_KEY_BLOCKLIST_UPDATED]: Date.now(),
    })

    logger.info('Updated blocklist from remote', { count: domains.length })
  } catch (err) {
    logger.warn('Failed to update blocklist from remote', { error: err })
  }
}

/**
 * Known trusted domains (legitimate Web3 sites)
 */
const TRUSTED_DOMAINS: ReadonlySet<string> = new Set([
  'uniswap.org',
  'app.uniswap.org',
  'opensea.io',
  'etherscan.io',
  'aave.com',
  'app.aave.com',
  'lido.fi',
  'metamask.io',
  'safe.global',
  'app.safe.global',
  'zora.co',
  'blur.io',
  'compound.finance',
  'curve.fi',
  'balancer.fi',
  'sushi.com',
  'pancakeswap.finance',
  'stargate.finance',
  '1inch.io',
])

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
 * Homograph characters (Cyrillic/Greek that look like ASCII)
 */
const HOMOGRAPH_CHARS: Record<string, string> = {
  '\u0430': 'a',
  '\u0435': 'e',
  '\u043E': 'o',
  '\u0440': 'p',
  '\u0441': 'c',
  '\u0443': 'y',
  '\u0445': 'x',
  '\u0456': 'i',
  '\u03B1': 'a',
  '\u03B5': 'e',
  '\u03BF': 'o',
  '\u03C1': 'p',
}

/**
 * Suspicious subdomain keywords
 */
const SUSPICIOUS_KEYWORDS = [
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

/**
 * Get the base domain (without subdomains) from a full domain.
 */
function getBaseDomain(domain: string): string {
  const parts = domain.split('.')
  if (parts.length <= 2) return domain
  return parts.slice(-2).join('.')
}

/**
 * Calculate Levenshtein distance similarity score between two strings.
 */
function getSimilarityScore(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  )
  for (let i = 0; i <= a.length; i++) {
    matrix[i]![0] = i
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0]![j] = j
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      )
    }
  }

  const distance = matrix[a.length]![b.length]!
  return 1 - distance / maxLen
}

/**
 * Check if a domain contains homograph characters.
 */
function hasHomographChars(domain: string): boolean {
  for (const char of domain) {
    if (HOMOGRAPH_CHARS[char]) return true
  }
  return false
}

/**
 * Check if a domain looks like a typosquatting attempt against trusted domains.
 */
function checkTyposquatting(domain: string): string | null {
  const baseDomain = getBaseDomain(domain)
  const domainWithoutTld = baseDomain.split('.')[0] ?? ''

  for (const trusted of TRUSTED_DOMAINS) {
    const trustedBase = getBaseDomain(trusted)
    const trustedWithoutTld = trustedBase.split('.')[0] ?? ''
    if (domainWithoutTld === trustedWithoutTld) continue

    const similarity = getSimilarityScore(domainWithoutTld, trustedWithoutTld)
    if (similarity > 0.7 && similarity < 1) {
      return trusted
    }
  }
  return null
}

/**
 * Check if a domain has suspicious subdomains.
 */
function hasSuspiciousSubdomain(domain: string): boolean {
  const parts = domain.split('.')
  const subdomains = parts.slice(0, -2)

  for (const subdomain of subdomains) {
    const lower = subdomain.toLowerCase()
    for (const keyword of SUSPICIOUS_KEYWORDS) {
      if (lower.includes(keyword)) {
        // Check that the base domain is NOT the legitimate one
        const baseDomain = getBaseDomain(domain)
        if (!TRUSTED_DOMAINS.has(baseDomain)) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * Check if a string looks like an IP address.
 */
function isIPAddress(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
}

/**
 * Check an origin for phishing indicators.
 * Returns a result indicating whether the origin is safe to connect.
 */
export function checkOrigin(origin: string): PhishingCheckResult {
  // Extension internal - always safe
  if (origin === 'extension') {
    return { isSafe: true, riskLevel: 'safe' }
  }

  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return {
      isSafe: false,
      reason: 'Invalid URL format',
      riskLevel: 'high',
    }
  }

  const hostname = url.hostname.toLowerCase()

  // 1. Blocklist check
  if (blocklistedDomains.has(hostname) || blocklistedDomains.has(getBaseDomain(hostname))) {
    logger.warn('Blocked phishing domain', { origin, hostname })
    return {
      isSafe: false,
      reason: `This site (${hostname}) has been identified as a phishing site`,
      riskLevel: 'critical',
    }
  }

  // 2. Trusted domain - safe
  if (TRUSTED_DOMAINS.has(hostname) || TRUSTED_DOMAINS.has(getBaseDomain(hostname))) {
    return { isSafe: true, riskLevel: 'safe' }
  }

  // 3. IP address check
  if (isIPAddress(hostname)) {
    return {
      isSafe: false,
      reason: 'IP address URLs are commonly used in phishing attacks',
      riskLevel: 'high',
    }
  }

  // 4. Homograph attack check
  if (hasHomographChars(hostname)) {
    logger.warn('Homograph attack detected', { origin, hostname })
    return {
      isSafe: false,
      reason: 'This domain uses characters that impersonate another site (homograph attack)',
      riskLevel: 'critical',
    }
  }

  // 5. Typosquatting check
  const typosquatTarget = checkTyposquatting(hostname)
  if (typosquatTarget) {
    logger.warn('Potential typosquatting', { origin, hostname, target: typosquatTarget })
    return {
      isSafe: false,
      reason: `This domain looks similar to ${typosquatTarget} and may be a phishing attempt`,
      riskLevel: 'high',
    }
  }

  // 6. Suspicious subdomain check
  if (hasSuspiciousSubdomain(hostname)) {
    return {
      isSafe: false,
      reason: 'This domain uses suspicious subdomains commonly found in phishing',
      riskLevel: 'high',
    }
  }

  // 7. Suspicious TLD check
  for (const tld of SUSPICIOUS_TLDS) {
    if (hostname.endsWith(tld)) {
      return {
        isSafe: true, // Allow but flag as low risk
        reason: `Uncommon domain extension (${tld})`,
        riskLevel: 'low',
      }
    }
  }

  // 8. Punycode check (IDN domains)
  if (hostname.split('.').some((part) => part.startsWith('xn--'))) {
    return {
      isSafe: false,
      reason: 'This domain uses internationalized encoding which may disguise phishing',
      riskLevel: 'medium',
    }
  }

  // Default: unknown domain, allow
  return { isSafe: true, riskLevel: 'safe' }
}

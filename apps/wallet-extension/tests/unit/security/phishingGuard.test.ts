/**
 * PhishingGuard Tests
 * Tests for origin phishing detection: blocklist, homograph, typosquatting, IP checks, etc.
 */

import {
  checkOrigin,
  loadBlocklist,
  updateBlocklist,
} from '../../../src/background/security/phishingGuard'

// We need to reset module state between tests since blocklistedDomains is module-level
beforeEach(() => {
  jest.restoreAllMocks()
})

describe('phishingGuard', () => {
  describe('checkOrigin', () => {
    describe('extension internal origin', () => {
      it('should return safe for "extension" origin', () => {
        const result = checkOrigin('extension')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })
    })

    describe('invalid URLs', () => {
      it('should return high risk for invalid URL', () => {
        const result = checkOrigin('not-a-url')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('high')
        expect(result.reason).toBe('Invalid URL format')
      })

      it('should return high risk for empty string', () => {
        const result = checkOrigin('')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('high')
      })
    })

    describe('trusted domains', () => {
      it('should return safe for uniswap.org', () => {
        const result = checkOrigin('https://uniswap.org')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })

      it('should return safe for app.uniswap.org', () => {
        const result = checkOrigin('https://app.uniswap.org')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })

      it('should return safe for opensea.io', () => {
        const result = checkOrigin('https://opensea.io')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })

      it('should return safe for etherscan.io', () => {
        const result = checkOrigin('https://etherscan.io/tx/0x123')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })

      it('should return safe for subdomain of trusted base domain', () => {
        const result = checkOrigin('https://sub.aave.com')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })
    })

    describe('IP address checks', () => {
      it('should allow private IP 127.0.0.1 (loopback)', () => {
        const result = checkOrigin('http://127.0.0.1:3000')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })

      it('should allow private IP 192.168.x.x', () => {
        const result = checkOrigin('http://192.168.1.100:8080')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })

      it('should allow private IP 10.x.x.x', () => {
        const result = checkOrigin('http://10.0.0.1')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })

      it('should allow private IP 172.16-31.x.x', () => {
        const result = checkOrigin('http://172.16.0.1')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })

      it('should block public IP addresses', () => {
        const result = checkOrigin('http://8.8.8.8')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('high')
        expect(result.reason).toContain('Public IP address')
      })

      it('should allow 0.0.0.0', () => {
        const result = checkOrigin('http://0.0.0.0:3000')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })

      it('should allow 169.254.x.x (link-local)', () => {
        const result = checkOrigin('http://169.254.1.1')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })
    })

    describe('localhost', () => {
      it('should allow localhost', () => {
        const result = checkOrigin('http://localhost:3000')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })
    })

    describe('homograph attack detection', () => {
      it('should detect Cyrillic "a" in domain (punycode encoded by URL parser)', () => {
        // \u0430 is Cyrillic small letter a
        // Node.js URL parser converts non-ASCII to punycode (xn-- prefix)
        const result = checkOrigin('https://uni\u0430wap.org')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('medium')
        expect(result.reason).toContain('internationalized encoding')
      })

      it('should detect Cyrillic "e" in domain (punycode encoded by URL parser)', () => {
        // URL parser converts homograph chars to punycode (xn--),
        // so the punycode detector fires with 'medium' risk
        const result = checkOrigin('https://op\u0435nsea.io')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('medium')
      })

      it('should detect Greek "o" in domain (punycode encoded by URL parser)', () => {
        // \u03BF is Greek small letter omicron — URL parser converts to punycode
        const result = checkOrigin('https://g\u03BFogle.com')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('medium')
      })

      it('should not flag domains without homograph chars', () => {
        const result = checkOrigin('https://example.com')
        expect(result.riskLevel).not.toBe('critical')
      })
    })

    describe('typosquatting detection', () => {
      it('should detect typosquatting of uniswap', () => {
        const result = checkOrigin('https://uniswep.org')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('high')
        expect(result.reason).toContain('similar to')
      })

      it('should detect typosquatting of opensea', () => {
        const result = checkOrigin('https://opencea.io')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('high')
      })

      it('should not flag completely different domains', () => {
        const result = checkOrigin('https://myapp.com')
        expect(result.isSafe).toBe(true)
      })

      it('should not flag exact match of trusted domain', () => {
        // Exact matches are handled by trusted domain check first
        const result = checkOrigin('https://uniswap.org')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })
    })

    describe('suspicious subdomain detection', () => {
      it('should flag metamask keyword in subdomain of untrusted domain', () => {
        const result = checkOrigin('https://metamask.evil.com')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('high')
        expect(result.reason).toContain('suspicious subdomains')
      })

      it('should flag uniswap keyword in subdomain of untrusted domain', () => {
        const result = checkOrigin('https://uniswap.phishing.com')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('high')
      })

      it('should flag wallet keyword in subdomain', () => {
        const result = checkOrigin('https://wallet-connect.evil.xyz')
        expect(result.isSafe).toBe(false)
      })

      it('should flag airdrop keyword in subdomain', () => {
        const result = checkOrigin('https://airdrop.scam.com')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('high')
      })

      it('should not flag suspicious keyword in subdomain of trusted base domain', () => {
        // e.g., metamask.metamask.io - base domain is trusted
        const result = checkOrigin('https://connect.metamask.io')
        expect(result.isSafe).toBe(true)
      })
    })

    describe('suspicious TLD detection', () => {
      it('should flag .xyz TLD as low risk but allow', () => {
        const result = checkOrigin('https://randomsite.xyz')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('low')
        expect(result.reason).toContain('.xyz')
      })

      it('should flag .tk TLD', () => {
        const result = checkOrigin('https://freesite.tk')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('low')
      })

      it('should flag .click TLD', () => {
        const result = checkOrigin('https://verify.click')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('low')
      })

      it('should not flag .com TLD', () => {
        const result = checkOrigin('https://example.com')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })
    })

    describe('punycode / IDN detection', () => {
      it('should flag xn-- punycode domains as medium risk', () => {
        const result = checkOrigin('https://xn--nxasmq6b.com')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('medium')
        expect(result.reason).toContain('internationalized encoding')
      })

      it('should flag domain with punycode subdomain', () => {
        const result = checkOrigin('https://xn--80ak6aa92e.example.com')
        expect(result.isSafe).toBe(false)
        expect(result.riskLevel).toBe('medium')
      })
    })

    describe('default behavior for unknown domains', () => {
      it('should allow unknown .com domains with safe risk', () => {
        const result = checkOrigin('https://totally-new-dapp.com')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })

      it('should allow unknown .io domains', () => {
        const result = checkOrigin('https://mydapp.io')
        expect(result.isSafe).toBe(true)
        expect(result.riskLevel).toBe('safe')
      })
    })
  })

  describe('loadBlocklist', () => {
    it('should load domains from chrome.storage.local', async () => {
      // Pre-set storage data
      await chrome.storage.local.set({
        phishing_blocklist: ['evil.com', 'phishing.io'],
      })

      await loadBlocklist()

      // Now checking a blocklisted domain should block it
      const result = checkOrigin('https://evil.com')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe('critical')
    })

    it('should handle empty blocklist gracefully', async () => {
      await loadBlocklist()
      // Should not throw and unknown domains should still work
      const result = checkOrigin('https://example.com')
      expect(result.isSafe).toBe(true)
    })

    it('should handle storage errors gracefully', async () => {
      ;(chrome.storage.local.get as jest.Mock).mockRejectedValueOnce(new Error('Storage error'))

      // Should not throw
      await expect(loadBlocklist()).resolves.not.toThrow()
    })
  })

  describe('updateBlocklist', () => {
    beforeEach(() => {
      global.fetch = jest.fn()
    })

    afterEach(() => {
      delete (global as Record<string, unknown>).fetch
    })

    it('should skip update if blocklist is still fresh', async () => {
      await chrome.storage.local.set({
        phishing_blocklist_updated_at: Date.now(),
      })

      await updateBlocklist('https://example.com/blocklist.json')

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should fetch and store blocklist from remote', async () => {
      const mockDomains = ['scam1.com', 'scam2.io']
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDomains),
      })

      await updateBlocklist('https://example.com/blocklist.json')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/blocklist.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )

      // Verify domains were stored
      const stored = await chrome.storage.local.get('phishing_blocklist')
      expect(stored.phishing_blocklist).toEqual(mockDomains)
    })

    it('should handle fetch failure gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      await expect(updateBlocklist('https://example.com/blocklist.json')).resolves.not.toThrow()
    })

    it('should handle invalid blocklist format', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ not: 'an array' }),
      })

      await expect(updateBlocklist('https://example.com/blocklist.json')).resolves.not.toThrow()
    })

    it('should handle non-OK HTTP response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await expect(updateBlocklist('https://example.com/blocklist.json')).resolves.not.toThrow()
    })
  })

  describe('blocklist check', () => {
    it('should block domain on the blocklist', async () => {
      await chrome.storage.local.set({
        phishing_blocklist: ['known-phishing.com'],
      })
      await loadBlocklist()

      const result = checkOrigin('https://known-phishing.com')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe('critical')
      expect(result.reason).toContain('phishing site')
    })

    it('should block base domain when subdomain of blocklisted domain', async () => {
      await chrome.storage.local.set({
        phishing_blocklist: ['phishing.com'],
      })
      await loadBlocklist()

      const result = checkOrigin('https://sub.phishing.com')
      expect(result.isSafe).toBe(false)
      expect(result.riskLevel).toBe('critical')
    })
  })
})

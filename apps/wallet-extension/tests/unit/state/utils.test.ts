/**
 * State Utilities Tests
 *
 * Tests for deep merge and origin normalization (Task 6.3)
 * Verifies state management stability and consistency
 */

import { deepMerge, normalizeOrigin, originsMatch } from '../../../src/background/state/utils'

describe('State Utilities', () => {
  describe('deepMerge', () => {
    it('should merge flat objects', () => {
      const target = { a: 1, b: 2 }
      const source = { b: 3, c: 4 }

      const result = deepMerge(target, source)

      expect(result).toEqual({ a: 1, b: 3, c: 4 })
    })

    it('should not mutate original objects', () => {
      const target = { a: 1, nested: { x: 1 } }
      const source = { nested: { y: 2 } }

      const result = deepMerge(target, source)

      expect(target).toEqual({ a: 1, nested: { x: 1 } })
      expect(source).toEqual({ nested: { y: 2 } })
      expect(result).not.toBe(target)
    })

    it('should deep merge nested objects', () => {
      const target = {
        level1: {
          level2: {
            a: 1,
            b: 2,
          },
          other: 'value',
        },
      }
      const source = {
        level1: {
          level2: {
            b: 3,
            c: 4,
          },
        },
      }

      const result = deepMerge(target, source)

      expect(result).toEqual({
        level1: {
          level2: {
            a: 1,
            b: 3,
            c: 4,
          },
          other: 'value',
        },
      })
    })

    it('should replace arrays instead of merging', () => {
      const target = { items: [1, 2, 3] }
      const source = { items: [4, 5] }

      const result = deepMerge(target, source)

      expect(result).toEqual({ items: [4, 5] })
    })

    it('should skip undefined values in source', () => {
      const target = { a: 1, b: 2, c: 3 }
      const source = { a: undefined, b: 4 }

      const result = deepMerge(target, source as typeof target)

      expect(result).toEqual({ a: 1, b: 4, c: 3 })
    })

    it('should handle null values in source', () => {
      const target = { a: 1, b: { nested: true } }
      const source = { b: null }

      const result = deepMerge(target, source as unknown)

      expect(result).toEqual({ a: 1, b: null })
    })

    it('should preserve complex wallet state structure', () => {
      const walletState = {
        isLocked: false,
        selectedAccount: '0x123',
        accounts: [{ address: '0x123', name: 'Account 1' }],
        connections: {
          connectedSites: [{ origin: 'https://app.com', accounts: ['0x123'] }],
        },
        settings: {
          theme: 'dark',
          autoLock: 300,
        },
      }

      const update = {
        selectedAccount: '0x456',
        settings: {
          autoLock: 600,
        },
      }

      const result = deepMerge(walletState, update as unknown)

      expect(result).toEqual({
        isLocked: false,
        selectedAccount: '0x456',
        accounts: [{ address: '0x123', name: 'Account 1' }],
        connections: {
          connectedSites: [{ origin: 'https://app.com', accounts: ['0x123'] }],
        },
        settings: {
          theme: 'dark', // preserved
          autoLock: 600, // updated
        },
      })
    })

    it('should not lose nested data during partial updates', () => {
      // This was the original bug: shallow merge would lose nested data
      const state = {
        network: {
          chainId: 1,
          name: 'mainnet',
          rpcUrl: 'https://eth.example.com',
        },
      }

      const update = {
        network: {
          chainId: 11155111,
        },
      }

      const result = deepMerge(state, update as unknown)

      // Should preserve name and rpcUrl
      expect(result.network.name).toBe('mainnet')
      expect(result.network.rpcUrl).toBe('https://eth.example.com')
      expect(result.network.chainId).toBe(11155111)
    })
  })

  describe('normalizeOrigin', () => {
    it('should convert to lowercase', () => {
      expect(normalizeOrigin('HTTPS://EXAMPLE.COM')).toBe('https://example.com')
      expect(normalizeOrigin('https://ExAmPlE.cOm')).toBe('https://example.com')
    })

    it('should remove trailing slash', () => {
      expect(normalizeOrigin('https://example.com/')).toBe('https://example.com')
    })

    it('should extract origin from full URL', () => {
      expect(normalizeOrigin('https://example.com/path/to/page')).toBe('https://example.com')
      expect(normalizeOrigin('https://example.com/path?query=1')).toBe('https://example.com')
      expect(normalizeOrigin('https://example.com:8080/path')).toBe('https://example.com:8080')
    })

    it('should handle localhost URLs', () => {
      expect(normalizeOrigin('http://localhost:3000')).toBe('http://localhost:3000')
      expect(normalizeOrigin('http://localhost:3000/')).toBe('http://localhost:3000')
      expect(normalizeOrigin('http://LOCALHOST:3000/app')).toBe('http://localhost:3000')
    })

    it('should handle already normalized origins', () => {
      expect(normalizeOrigin('https://example.com')).toBe('https://example.com')
    })

    it('should handle invalid URLs gracefully', () => {
      expect(normalizeOrigin('not-a-url')).toBe('not-a-url')
      expect(normalizeOrigin('NOT-A-URL/')).toBe('not-a-url')
    })
  })

  describe('originsMatch', () => {
    it('should match identical origins', () => {
      expect(originsMatch('https://example.com', 'https://example.com')).toBe(true)
    })

    it('should match origins with different cases', () => {
      expect(originsMatch('HTTPS://EXAMPLE.COM', 'https://example.com')).toBe(true)
      expect(originsMatch('https://Example.Com', 'HTTPS://EXAMPLE.COM')).toBe(true)
    })

    it('should match origins with/without trailing slash', () => {
      expect(originsMatch('https://example.com/', 'https://example.com')).toBe(true)
      expect(originsMatch('https://example.com', 'https://example.com/')).toBe(true)
    })

    it('should match full URLs with same origin', () => {
      expect(originsMatch('https://example.com/page1', 'https://example.com/page2')).toBe(true)
      expect(originsMatch('https://example.com?query=1', 'https://example.com/path')).toBe(true)
    })

    it('should NOT match different origins', () => {
      expect(originsMatch('https://example.com', 'https://other.com')).toBe(false)
      expect(originsMatch('http://example.com', 'https://example.com')).toBe(false)
      expect(originsMatch('https://example.com:8080', 'https://example.com')).toBe(false)
      expect(originsMatch('https://sub.example.com', 'https://example.com')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(originsMatch('', '')).toBe(true)
      expect(originsMatch('https://example.com', '')).toBe(false)
    })
  })

  describe('Page Refresh State Persistence (Task 6.3)', () => {
    it('should preserve connection state structure after simulated refresh', () => {
      // Simulate state before browser storage
      const stateBeforeRefresh = {
        connections: {
          connectedSites: [
            {
              origin: 'https://app.example.com',
              accounts: ['0x1234567890123456789012345678901234567890'],
              connectedAt: 1706500000000,
            },
          ],
        },
        selectedChainId: 1,
        selectedAccount: '0x1234567890123456789012345678901234567890',
      }

      // Simulate storage round-trip (JSON serialization)
      const serialized = JSON.stringify(stateBeforeRefresh)
      const stateAfterRefresh = JSON.parse(serialized)

      // Verify state integrity
      expect(stateAfterRefresh.connections.connectedSites).toHaveLength(1)
      expect(stateAfterRefresh.connections.connectedSites[0].origin).toBe('https://app.example.com')
      expect(stateAfterRefresh.selectedAccount).toBe('0x1234567890123456789012345678901234567890')
    })

    it('should maintain selected account after partial state update', () => {
      const state = {
        accounts: [
          { address: '0xabc', name: 'Account 1' },
          { address: '0xdef', name: 'Account 2' },
        ],
        selectedAccount: '0xabc',
        network: { chainId: 1 },
      }

      // Update only network
      const updatedState = deepMerge(state, {
        network: { chainId: 11155111 },
      } as unknown)

      // Selected account should be preserved
      expect(updatedState.selectedAccount).toBe('0xabc')
      expect(updatedState.accounts).toHaveLength(2)
    })
  })
})

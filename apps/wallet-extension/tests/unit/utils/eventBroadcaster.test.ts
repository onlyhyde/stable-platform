/**
 * EventBroadcaster Tests
 *
 * Tests for origin-isolated event broadcasting system (Task 6.1, 6.4)
 * Verifies EIP-1193 events and privacy protection (SEC-1)
 */

import type { Address } from 'viem'
import { mockChrome } from '../../utils/mockChrome'
import { TEST_ACCOUNTS, TEST_ORIGINS } from '../../utils/testUtils'

// Mock the logger
jest.mock('../../../src/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}))

// Mock constants
jest.mock('../../../src/shared/constants', () => ({
  PROVIDER_EVENTS: {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    ACCOUNTS_CHANGED: 'accountsChanged',
    CHAIN_CHANGED: 'chainChanged',
  },
  RPC_ERRORS: {
    DISCONNECTED: { code: 4900, message: 'The provider is disconnected from all chains' },
    CHAIN_DISCONNECTED: {
      code: 4901,
      message: 'The provider is disconnected from the specified chain',
    },
  },
  DEFAULT_VALUES: {
    CHAIN_ID_HEX: '0x1',
  },
}))

// Import after mocks
import { EventBroadcaster, eventBroadcaster } from '../../../src/background/utils/eventBroadcaster'

describe('EventBroadcaster', () => {
  let broadcaster: EventBroadcaster

  beforeEach(() => {
    jest.clearAllMocks()
    broadcaster = new EventBroadcaster()

    // Reset tabs query mock
    mockChrome.tabs.query.mockResolvedValue([])
    mockChrome.tabs.sendMessage.mockResolvedValue(undefined)
  })

  describe('broadcastToOrigin', () => {
    it('should validate origin format and reject invalid origins', async () => {
      // Invalid origins should not trigger tab query
      await broadcaster.broadcastToOrigin('invalid-origin', 'connect', {})
      await broadcaster.broadcastToOrigin('file:///local/file', 'connect', {})
      await broadcaster.broadcastToOrigin('', 'connect', {})

      expect(mockChrome.tabs.query).not.toHaveBeenCalled()
    })

    it('should accept valid http/https origins', async () => {
      await broadcaster.broadcastToOrigin('https://example.com', 'connect', { chainId: '0x1' })

      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        url: 'https://example.com/*',
      })
    })

    it('should send message only to tabs matching the origin', async () => {
      const matchingTab = { id: 1, url: 'https://example.com/app' }
      const _nonMatchingTab = { id: 2, url: 'https://other.com/page' }

      mockChrome.tabs.query.mockResolvedValue([matchingTab])

      await broadcaster.broadcastToOrigin('https://example.com', 'connect', { chainId: '0x1' })

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'PROVIDER_EVENT',
          event: 'connect',
          origin: 'https://example.com',
        })
      )
    })

    it('should skip tabs without id or url', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { url: 'https://example.com/page' }, // no id
        { id: 2 }, // no url
        { id: 3, url: 'https://example.com/page' }, // valid
      ])

      await broadcaster.broadcastToOrigin('https://example.com', 'connect', { chainId: '0x1' })

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1)
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(3, expect.any(Object))
    })

    it('should handle sendMessage errors gracefully', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com/app' }])
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not ready'))

      // Should not throw
      await expect(
        broadcaster.broadcastToOrigin('https://example.com', 'connect', { chainId: '0x1' })
      ).resolves.not.toThrow()
    })
  })

  describe('broadcastConnect (Task 6.1)', () => {
    it('should broadcast connect event with chainId', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://app.example.com/dapp' }])

      await broadcaster.broadcastConnect(TEST_ORIGINS.trusted, '0x1')

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'PROVIDER_EVENT',
          event: 'connect',
          data: { chainId: '0x1' },
        })
      )
    })

    it('should normalize origin before broadcasting', async () => {
      mockChrome.tabs.query.mockResolvedValue([])

      await broadcaster.broadcastConnect('https://EXAMPLE.COM/', '0x1')

      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        url: 'https://example.com/*',
      })
    })
  })

  describe('broadcastDisconnect (Task 6.1)', () => {
    it('should broadcast disconnect event with error object', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://app.example.com/dapp' }])

      await broadcaster.broadcastDisconnect(TEST_ORIGINS.trusted)

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'PROVIDER_EVENT',
          event: 'disconnect',
          data: {
            code: 4900,
            message: 'The provider is disconnected from all chains',
          },
        })
      )
    })
  })

  describe('broadcastAccountsChanged (Task 6.1)', () => {
    it('should broadcast accounts array to specific origin', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://app.example.com/dapp' }])
      const accounts = [TEST_ACCOUNTS.account1.address]

      await broadcaster.broadcastAccountsChanged(TEST_ORIGINS.trusted, accounts)

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'PROVIDER_EVENT',
          event: 'accountsChanged',
          data: accounts,
        })
      )
    })

    it('should filter out invalid addresses', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://app.example.com/dapp' }])
      const mixedAccounts = [
        TEST_ACCOUNTS.account1.address,
        'invalid-address',
        '0x123', // too short
        TEST_ACCOUNTS.account2.address,
      ] as Address[]

      await broadcaster.broadcastAccountsChanged(TEST_ORIGINS.trusted, mixedAccounts)

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          data: [TEST_ACCOUNTS.account1.address, TEST_ACCOUNTS.account2.address],
        })
      )
    })

    it('should broadcast empty array when disconnecting', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://app.example.com/dapp' }])

      await broadcaster.broadcastAccountsChanged(TEST_ORIGINS.trusted, [])

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          data: [],
        })
      )
    })
  })

  describe('broadcastChainChanged (Task 6.1)', () => {
    it('should broadcast chainId to all connected origins', async () => {
      const origins = ['https://app1.com', 'https://app2.com']

      mockChrome.tabs.query
        .mockResolvedValueOnce([{ id: 1, url: 'https://app1.com/page' }])
        .mockResolvedValueOnce([{ id: 2, url: 'https://app2.com/page' }])

      await broadcaster.broadcastChainChanged('0xaa36a7', origins)

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2)
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          event: 'chainChanged',
          data: '0xaa36a7',
        })
      )
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          event: 'chainChanged',
          data: '0xaa36a7',
        })
      )
    })

    it('should reject invalid chainId format', async () => {
      await broadcaster.broadcastChainChanged('1', ['https://example.com']) // not hex
      await broadcaster.broadcastChainChanged('', ['https://example.com'])

      expect(mockChrome.tabs.query).not.toHaveBeenCalled()
    })
  })

  describe('Origin Isolation (SEC-1 / Task 6.4)', () => {
    it('should NOT send origin A accounts to origin B tabs', async () => {
      // Setup: tabs from two different origins
      mockChrome.tabs.query.mockImplementation((query) => {
        if (query.url?.includes('app-a.com')) {
          return Promise.resolve([{ id: 1, url: 'https://app-a.com/page' }])
        }
        if (query.url?.includes('app-b.com')) {
          return Promise.resolve([{ id: 2, url: 'https://app-b.com/page' }])
        }
        return Promise.resolve([])
      })

      const accountsA = [TEST_ACCOUNTS.account1.address]
      const _accountsB = [TEST_ACCOUNTS.account2.address]

      // Broadcast to origin A
      await broadcaster.broadcastAccountsChanged('https://app-a.com', accountsA)

      // Verify only tab 1 received the message
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1)
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          data: accountsA,
          origin: 'https://app-a.com',
        })
      )

      // Tab 2 should NOT have received origin A's accounts
      expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalledWith(2, expect.any(Object))
    })

    it('should handle multiple tabs from same origin', async () => {
      // Multiple tabs from same origin should all receive the event
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://app.com/page1' },
        { id: 2, url: 'https://app.com/page2' },
        { id: 3, url: 'https://app.com/dashboard' },
      ])

      await broadcaster.broadcastAccountsChanged('https://app.com', [
        TEST_ACCOUNTS.account1.address,
      ])

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(3)
    })
  })

  describe('Data Sanitization', () => {
    it('should sanitize connect event data', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com/app' }])

      // Invalid connect data should be sanitized
      await broadcaster.broadcastToOrigin('https://example.com', 'connect', null)

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          data: { chainId: '0x1' }, // default
        })
      )
    })

    it('should sanitize disconnect event data', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com/app' }])

      // Invalid disconnect data should be sanitized
      await broadcaster.broadcastToOrigin('https://example.com', 'disconnect', 'invalid')

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          data: { code: 4900, message: 'The provider is disconnected from all chains' },
        })
      )
    })

    it('should sanitize chainChanged event data', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com/app' }])

      // Non-hex chainId should be rejected
      await broadcaster.broadcastToOrigin('https://example.com', 'chainChanged', '1')

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          data: null,
        })
      )
    })
  })

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(eventBroadcaster).toBeInstanceOf(EventBroadcaster)
    })
  })
})

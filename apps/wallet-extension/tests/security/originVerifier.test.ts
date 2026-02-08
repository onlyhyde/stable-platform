/**
 * Origin Verifier Tests (SEC-3)
 *
 * Tests trusted origin resolution from chrome.runtime.MessageSender.
 */

import {
  isOriginAllowed,
  originFromUrl,
  resolveOrigin,
} from '../../src/shared/security/originVerifier'

// Helper to create a mock MessageSender
function createSender(
  overrides: Partial<chrome.runtime.MessageSender> = {}
): chrome.runtime.MessageSender {
  return {
    id: 'test-extension-id',
    ...overrides,
  }
}

describe('originFromUrl', () => {
  it('should extract origin from valid URLs', () => {
    expect(originFromUrl('https://example.com/path')).toBe('https://example.com')
    expect(originFromUrl('http://localhost:3000/app')).toBe('http://localhost:3000')
    expect(originFromUrl('https://sub.domain.com:8080')).toBe('https://sub.domain.com:8080')
  })

  it('should return empty string for invalid URLs', () => {
    expect(originFromUrl('')).toBe('')
    expect(originFromUrl(undefined)).toBe('')
    expect(originFromUrl('not-a-url')).toBe('')
  })

  it('should handle chrome-extension URLs', () => {
    expect(originFromUrl('chrome-extension://abcdef/popup.html')).toBe('chrome-extension://abcdef')
  })
})

describe('resolveOrigin', () => {
  it('should derive origin from sender.tab.url (content script)', () => {
    const sender = createSender({
      tab: {
        id: 1,
        index: 0,
        highlighted: false,
        active: true,
        pinned: false,
        incognito: false,
        windowId: 1,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        url: 'https://example.com/page',
      },
    })
    const result = resolveOrigin(sender)
    expect(result.origin).toBe('https://example.com')
    expect(result.isExtension).toBe(false)
    expect(result.isValidExternal).toBe(true)
    expect(result.tabId).toBe(1)
  })

  it('should treat chrome-extension tab URL as internal', () => {
    const sender = createSender({
      tab: {
        id: 2,
        index: 0,
        highlighted: false,
        active: true,
        pinned: false,
        incognito: false,
        windowId: 1,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        url: 'chrome-extension://abcdef/approval.html',
      },
    })
    const result = resolveOrigin(sender)
    expect(result.origin).toBe('extension')
    expect(result.isExtension).toBe(true)
  })

  it('should use sender.origin for popup (chrome-extension://)', () => {
    const sender = createSender({
      origin: 'chrome-extension://abcdef',
    })
    const result = resolveOrigin(sender)
    expect(result.origin).toBe('extension')
    expect(result.isExtension).toBe(true)
  })

  it('should use sender.origin for non-extension origins', () => {
    const sender = createSender({
      origin: 'https://dapp.example.com',
    })
    const result = resolveOrigin(sender)
    expect(result.origin).toBe('https://dapp.example.com')
    expect(result.isExtension).toBe(false)
    expect(result.isValidExternal).toBe(true)
  })

  it('should default to extension for empty sender', () => {
    const sender = createSender()
    const result = resolveOrigin(sender)
    expect(result.origin).toBe('extension')
    expect(result.isExtension).toBe(true)
  })

  it('should mark non-http/https external origins as unknown', () => {
    const sender = createSender({
      origin: 'file:///local/file.html',
    })
    const result = resolveOrigin(sender)
    expect(result.origin).toBe('unknown')
    expect(result.isExtension).toBe(false)
    expect(result.isValidExternal).toBe(false)
  })

  it('should prioritize tab.url over sender.origin', () => {
    const sender = createSender({
      tab: {
        id: 3,
        index: 0,
        highlighted: false,
        active: true,
        pinned: false,
        incognito: false,
        windowId: 1,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        url: 'https://tab-url.com',
      },
      origin: 'https://sender-origin.com',
    })
    const result = resolveOrigin(sender)
    expect(result.origin).toBe('https://tab-url.com')
  })
})

describe('isOriginAllowed', () => {
  it('should allow extension origins', () => {
    expect(
      isOriginAllowed({ origin: 'extension', isExtension: true, isValidExternal: false })
    ).toBe(true)
  })

  it('should allow valid external origins', () => {
    expect(
      isOriginAllowed({ origin: 'https://dapp.com', isExtension: false, isValidExternal: true })
    ).toBe(true)
  })

  it('should deny unknown origins', () => {
    expect(isOriginAllowed({ origin: 'unknown', isExtension: false, isValidExternal: false })).toBe(
      false
    )
  })
})

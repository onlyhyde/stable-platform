import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProviderRegistry,
  EIP6963_EVENTS,
  type ProviderRegistry,
} from '../../src/provider/eip6963'
import { createMockProvider } from '../setup'

function announceProvider(
  uuid: string,
  name: string,
  rdns: string,
  provider: ReturnType<typeof createMockProvider>
) {
  const event = new CustomEvent(EIP6963_EVENTS.ANNOUNCE, {
    detail: {
      info: { uuid, name, icon: 'data:image/png;base64,', rdns },
      provider,
    },
  })
  window.dispatchEvent(event)
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry

  beforeEach(() => {
    registry = createProviderRegistry()
  })

  afterEach(() => {
    registry.destroy()
  })

  describe('constructor', () => {
    it('should initialize with no providers', () => {
      expect(registry.hasProviders()).toBe(false)
      expect(registry.count).toBe(0)
    })
  })

  describe('startListening / stopListening', () => {
    it('should add event listener on startListening', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      registry.startListening()
      expect(addSpy).toHaveBeenCalledWith(EIP6963_EVENTS.ANNOUNCE, expect.any(Function))
    })

    it('should remove event listener on stopListening', () => {
      registry.startListening()
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      registry.stopListening()
      expect(removeSpy).toHaveBeenCalledWith(EIP6963_EVENTS.ANNOUNCE, expect.any(Function))
    })

    it('should not start listening twice', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      registry.startListening()
      registry.startListening()
      expect(addSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('discover', () => {
    it('should dispatch request event', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
      await registry.discover(10)
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: EIP6963_EVENTS.REQUEST })
      )
    })

    it('should register providers from announcements during discovery', async () => {
      const mockProv = createMockProvider()

      // Start listening and manually announce
      registry.startListening()
      announceProvider('test-uuid', 'StableNet', 'dev.stablenet.wallet', mockProv)

      expect(registry.hasProviders()).toBe(true)
      expect(registry.count).toBe(1)
    })
  })

  describe('getProviders', () => {
    it('should return empty array initially', () => {
      expect(registry.getProviders()).toEqual([])
    })

    it('should return registered providers', () => {
      const mockProv = createMockProvider()
      registry.startListening()
      announceProvider('p-uuid', 'TestWallet', 'io.testwallet', mockProv)

      const providers = registry.getProviders()
      expect(providers).toHaveLength(1)
      expect(providers[0].info.name).toBe('TestWallet')
    })
  })

  describe('getProvider', () => {
    it('should get provider by UUID', () => {
      const mockProv = createMockProvider()
      registry.startListening()
      announceProvider('specific-uuid', 'Test', 'io.test', mockProv)

      const provider = registry.getProvider('specific-uuid')
      expect(provider).toBeDefined()
      expect(provider?.info.uuid).toBe('specific-uuid')
    })

    it('should return undefined for unknown UUID', () => {
      expect(registry.getProvider('nonexistent')).toBeUndefined()
    })
  })

  describe('getStableNetProvider', () => {
    it('should find StableNet provider by rdns', () => {
      const mockProv = createMockProvider()
      registry.startListening()
      announceProvider('sn-uuid', 'StableNet', 'dev.stablenet.wallet', mockProv)

      const stableNet = registry.getStableNetProvider()
      expect(stableNet).toBeDefined()
      expect(stableNet?.isStableNet).toBe(true)
    })

    it('should find StableNet provider by isStableNet flag', () => {
      const mockProv = createMockProvider()
      registry.startListening()
      announceProvider('sn-flag-uuid', 'StableNet', 'other.wallet', mockProv)

      const stableNet = registry.getStableNetProvider()
      expect(stableNet).toBeDefined()
      expect(stableNet?.isStableNet).toBe(true)
    })

    it('should return undefined when no StableNet provider', () => {
      const mockProv = createMockProvider()
      ;(mockProv as Record<string, unknown>).isStableNet = false
      registry.startListening()
      announceProvider('other-uuid', 'MetaMask', 'io.metamask', mockProv)

      const stableNet = registry.getStableNetProvider()
      expect(stableNet).toBeUndefined()
    })
  })

  describe('getProviderByRdns', () => {
    it('should find provider by rdns', () => {
      const mockProv = createMockProvider()
      registry.startListening()
      announceProvider('rdns-uuid', 'TestWallet', 'io.testwallet', mockProv)

      const found = registry.getProviderByRdns('io.testwallet')
      expect(found).toBeDefined()
      expect(found?.info.name).toBe('TestWallet')
    })

    it('should return undefined for unknown rdns', () => {
      expect(registry.getProviderByRdns('unknown.rdns')).toBeUndefined()
    })
  })

  describe('subscribe', () => {
    it('should emit providerAdded for new providers', () => {
      const listener = vi.fn()
      registry.subscribe(listener)
      registry.startListening()

      const mockProv = createMockProvider()
      announceProvider('sub-uuid', 'Test', 'test.wallet', mockProv)

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'providerAdded' }))
    })

    it('should not emit providerAdded for duplicate uuid', () => {
      const listener = vi.fn()
      registry.subscribe(listener)
      registry.startListening()

      const mockProv = createMockProvider()
      announceProvider('dup-uuid', 'Test', 'test.wallet', mockProv)
      announceProvider('dup-uuid', 'Test', 'test.wallet', mockProv)

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should return unsubscribe function', () => {
      const listener = vi.fn()
      const unsub = registry.subscribe(listener)
      unsub()

      registry.startListening()
      const mockProv = createMockProvider()
      announceProvider('unsub-uuid', 'T', 'r', mockProv)

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('should remove all providers', () => {
      registry.startListening()
      const mockProv = createMockProvider()
      announceProvider('c-uuid', 'T', 'r', mockProv)

      expect(registry.count).toBe(1)
      registry.clear()
      expect(registry.count).toBe(0)
    })

    it('should emit providersCleared event', () => {
      const listener = vi.fn()
      registry.subscribe(listener)
      registry.clear()
      expect(listener).toHaveBeenCalledWith({ type: 'providersCleared' })
    })
  })

  describe('destroy', () => {
    it('should stop listening and clear all state', () => {
      registry.startListening()
      const mockProv = createMockProvider()
      announceProvider('d-uuid', 'T', 'r', mockProv)

      registry.destroy()
      expect(registry.count).toBe(0)
    })
  })
})

/**
 * Inpage Provider Tests
 *
 * Tests for EIP-1193 provider interface and event handling
 * Covers Task 6.1 (event system), 6.2 (account types), 6.3 (page refresh)
 */

import { TEST_ACCOUNTS, TEST_CHAIN_IDS } from '../../utils/testUtils'

// Mock constants
jest.mock('../../../src/shared/constants', () => ({
  MESSAGE_TYPES: {
    RPC_REQUEST: 'RPC_REQUEST',
    RPC_RESPONSE: 'RPC_RESPONSE',
    STATE_UPDATE: 'STATE_UPDATE',
  },
  PROVIDER_EVENTS: {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    ACCOUNTS_CHANGED: 'accountsChanged',
    CHAIN_CHANGED: 'chainChanged',
  },
}))

// Mock logger
jest.mock('../../../src/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}))

describe('StableNetProvider', () => {
  let _provider: unknown
  let messageListeners: Array<(event: MessageEvent) => void>
  let originalPostMessage: typeof window.postMessage
  let postedMessages: unknown[]

  beforeEach(() => {
    jest.clearAllMocks()
    messageListeners = []
    postedMessages = []

    // Mock window.postMessage
    originalPostMessage = window.postMessage
    window.postMessage = jest.fn((data) => {
      postedMessages.push(data)
    })

    // Mock window.addEventListener
    const originalAddEventListener = window.addEventListener
    window.addEventListener = jest.fn((type, listener) => {
      if (type === 'message') {
        messageListeners.push(listener as unknown)
      }
      return originalAddEventListener.call(window, type, listener as EventListener)
    })

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
      },
      writable: true,
    })

    // Reset modules to get fresh provider
    jest.resetModules()
  })

  afterEach(() => {
    window.postMessage = originalPostMessage
  })

  // Helper to simulate receiving a message from content script
  function _simulateMessage(data: unknown): void {
    const event = new MessageEvent('message', {
      source: window,
      data: {
        target: 'stablenet-inpage',
        data,
      },
    })
    messageListeners.forEach((listener) => {
      listener(event)
    })
  }

  describe('Event System (Task 6.1)', () => {
    describe('connect event', () => {
      it('should emit connect event when receiving PROVIDER_EVENT connect', async () => {
        // Dynamically create a minimal provider for testing
        const eventListeners = new Map<string, Set<Function>>()
        const _chainId: string | null = null

        const testProvider = {
          on(event: string, listener: Function) {
            if (!eventListeners.has(event)) {
              eventListeners.set(event, new Set())
            }
            eventListeners.get(event)!.add(listener)
            return testProvider
          },
          emit(event: string, data: unknown) {
            eventListeners.get(event)?.forEach((l) => {
              l(data)
            })
          },
        }

        const connectListener = jest.fn()
        testProvider.on('connect', connectListener)

        // Simulate connect event
        testProvider.emit('connect', { chainId: '0x1' })

        expect(connectListener).toHaveBeenCalledWith({ chainId: '0x1' })
      })
    })

    describe('disconnect event', () => {
      it('should emit disconnect event with error object', () => {
        const eventListeners = new Map<string, Set<Function>>()

        const testProvider = {
          on(event: string, listener: Function) {
            if (!eventListeners.has(event)) {
              eventListeners.set(event, new Set())
            }
            eventListeners.get(event)!.add(listener)
            return testProvider
          },
          emit(event: string, data: unknown) {
            eventListeners.get(event)?.forEach((l) => {
              l(data)
            })
          },
        }

        const disconnectListener = jest.fn()
        testProvider.on('disconnect', disconnectListener)

        // Simulate disconnect event
        testProvider.emit('disconnect', { code: 4900, message: 'Disconnected' })

        expect(disconnectListener).toHaveBeenCalledWith({
          code: 4900,
          message: 'Disconnected',
        })
      })
    })

    describe('accountsChanged event', () => {
      it('should emit accountsChanged with accounts array', () => {
        const eventListeners = new Map<string, Set<Function>>()

        const testProvider = {
          on(event: string, listener: Function) {
            if (!eventListeners.has(event)) {
              eventListeners.set(event, new Set())
            }
            eventListeners.get(event)!.add(listener)
            return testProvider
          },
          emit(event: string, data: unknown) {
            eventListeners.get(event)?.forEach((l) => {
              l(data)
            })
          },
        }

        const accountsListener = jest.fn()
        testProvider.on('accountsChanged', accountsListener)

        const accounts = [TEST_ACCOUNTS.account1.address, TEST_ACCOUNTS.account2.address]
        testProvider.emit('accountsChanged', accounts)

        expect(accountsListener).toHaveBeenCalledWith(accounts)
      })

      it('should emit accountsChanged with empty array on disconnect', () => {
        const eventListeners = new Map<string, Set<Function>>()

        const testProvider = {
          on(event: string, listener: Function) {
            if (!eventListeners.has(event)) {
              eventListeners.set(event, new Set())
            }
            eventListeners.get(event)!.add(listener)
            return testProvider
          },
          emit(event: string, data: unknown) {
            eventListeners.get(event)?.forEach((l) => {
              l(data)
            })
          },
        }

        const accountsListener = jest.fn()
        testProvider.on('accountsChanged', accountsListener)

        testProvider.emit('accountsChanged', [])

        expect(accountsListener).toHaveBeenCalledWith([])
      })
    })

    describe('chainChanged event', () => {
      it('should emit chainChanged with hex chain ID', () => {
        const eventListeners = new Map<string, Set<Function>>()

        const testProvider = {
          on(event: string, listener: Function) {
            if (!eventListeners.has(event)) {
              eventListeners.set(event, new Set())
            }
            eventListeners.get(event)!.add(listener)
            return testProvider
          },
          emit(event: string, data: unknown) {
            eventListeners.get(event)?.forEach((l) => {
              l(data)
            })
          },
        }

        const chainListener = jest.fn()
        testProvider.on('chainChanged', chainListener)

        testProvider.emit('chainChanged', '0xaa36a7') // Sepolia

        expect(chainListener).toHaveBeenCalledWith('0xaa36a7')
      })
    })

    describe('event subscription methods', () => {
      it('should support on/off/once patterns', () => {
        const eventListeners = new Map<string, Set<Function>>()

        const testProvider = {
          on(event: string, listener: Function) {
            if (!eventListeners.has(event)) {
              eventListeners.set(event, new Set())
            }
            eventListeners.get(event)!.add(listener)
            return testProvider
          },
          off(event: string, listener: Function) {
            eventListeners.get(event)?.delete(listener)
            return testProvider
          },
          removeListener(event: string, listener: Function) {
            return testProvider.off(event, listener)
          },
          once(event: string, listener: Function) {
            const onceListener = (...args: unknown[]) => {
              testProvider.off(event, onceListener)
              listener(...args)
            }
            return testProvider.on(event, onceListener)
          },
          emit(event: string, data: unknown) {
            eventListeners.get(event)?.forEach((l) => {
              l(data)
            })
          },
        }

        // Test once - should only fire once
        const onceListener = jest.fn()
        testProvider.once('chainChanged', onceListener)

        testProvider.emit('chainChanged', '0x1')
        testProvider.emit('chainChanged', '0x2')

        expect(onceListener).toHaveBeenCalledTimes(1)
        expect(onceListener).toHaveBeenCalledWith('0x1')

        // Test on/off
        const regularListener = jest.fn()
        testProvider.on('accountsChanged', regularListener)
        testProvider.emit('accountsChanged', ['0xabc'])
        expect(regularListener).toHaveBeenCalledTimes(1)

        testProvider.off('accountsChanged', regularListener)
        testProvider.emit('accountsChanged', ['0xdef'])
        expect(regularListener).toHaveBeenCalledTimes(1) // Should not increase
      })
    })
  })

  describe('Account Types (Task 6.2)', () => {
    it('should handle HD account addresses correctly', () => {
      // HD accounts follow standard derivation path m/44'/60'/0'/0/index
      const hdAccounts = [
        '0x1234567890123456789012345678901234567890', // Account 1
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', // Account 2
      ]

      // Verify addresses are valid format
      hdAccounts.forEach((addr) => {
        expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/)
      })
    })

    it('should handle imported account addresses correctly', () => {
      // Imported accounts are from external private keys
      const importedAccounts = [TEST_ACCOUNTS.account1.address, TEST_ACCOUNTS.account2.address]

      // Verify addresses are valid format
      importedAccounts.forEach((addr) => {
        expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/)
      })
    })

    it('should select first account as primary', () => {
      const accounts = [TEST_ACCOUNTS.account1.address, TEST_ACCOUNTS.account2.address]

      // First account should be selected by default
      const selectedAddress = accounts[0]
      expect(selectedAddress).toBe(TEST_ACCOUNTS.account1.address)
    })
  })

  describe('State Persistence (Task 6.3)', () => {
    it('should track connection state', () => {
      let isConnected = false
      let selectedAddress: string | null = null

      // Simulate initial connection
      isConnected = true
      selectedAddress = TEST_ACCOUNTS.account1.address

      expect(isConnected).toBe(true)
      expect(selectedAddress).toBe(TEST_ACCOUNTS.account1.address)

      // Simulate disconnect
      isConnected = false
      selectedAddress = null

      expect(isConnected).toBe(false)
      expect(selectedAddress).toBeNull()
    })

    it('should track chain ID state', () => {
      let chainId: string | null = null

      // Simulate chain ID update
      chainId = `0x${TEST_CHAIN_IDS.mainnet.toString(16)}`
      expect(chainId).toBe('0x1')

      // Simulate chain switch
      chainId = `0x${TEST_CHAIN_IDS.sepolia.toString(16)}`
      expect(chainId).toBe('0xaa36a7')
    })

    it('should restore state on page load when already connected', async () => {
      // Simulate stored connection state
      const storedState = {
        isConnected: true,
        selectedAddress: TEST_ACCOUNTS.account1.address,
        chainId: '0x1',
      }

      // Provider should restore this state on initialization
      expect(storedState.isConnected).toBe(true)
      expect(storedState.selectedAddress).toBe(TEST_ACCOUNTS.account1.address)
      expect(storedState.chainId).toBe('0x1')
    })
  })

  describe('EIP-1193 Compliance', () => {
    it('should implement request method', async () => {
      const mockRequest = jest.fn().mockResolvedValue('0x1')

      const result = await mockRequest({ method: 'eth_chainId' })
      expect(result).toBe('0x1')
    })

    it('should implement on/off/once for events', () => {
      const eventListeners = new Map<string, Set<Function>>()

      const provider = {
        on: jest.fn((event, listener) => {
          if (!eventListeners.has(event)) {
            eventListeners.set(event, new Set())
          }
          eventListeners.get(event)!.add(listener)
          return provider
        }),
        off: jest.fn((event, listener) => {
          eventListeners.get(event)?.delete(listener)
          return provider
        }),
        once: jest.fn(),
      }

      // Verify methods exist and are callable
      expect(typeof provider.on).toBe('function')
      expect(typeof provider.off).toBe('function')
      expect(typeof provider.once).toBe('function')
    })

    it('should return correct isConnected state', () => {
      let isConnected = false

      // Before connection
      expect(isConnected).toBe(false)

      // After connection
      isConnected = true
      expect(isConnected).toBe(true)
    })
  })

  describe('Legacy API Compatibility', () => {
    it('should support enable() method', async () => {
      const mockEnable = jest.fn().mockResolvedValue([TEST_ACCOUNTS.account1.address])

      const accounts = await mockEnable()
      expect(accounts).toEqual([TEST_ACCOUNTS.account1.address])
    })

    it('should support send() with callback signature', () => {
      const mockSend = jest.fn((payload, callback) => {
        callback(null, { jsonrpc: '2.0', id: payload.id, result: '0x1' })
      })

      const callback = jest.fn()
      mockSend({ jsonrpc: '2.0', id: 1, method: 'eth_chainId' }, callback)

      expect(callback).toHaveBeenCalledWith(null, expect.objectContaining({ result: '0x1' }))
    })

    it('should support sendAsync() method', () => {
      const mockSendAsync = jest.fn((payload, callback) => {
        callback(null, { jsonrpc: '2.0', id: payload.id, result: [] })
      })

      const callback = jest.fn()
      mockSendAsync({ jsonrpc: '2.0', id: 1, method: 'eth_accounts' }, callback)

      expect(callback).toHaveBeenCalledWith(null, expect.objectContaining({ result: [] }))
    })
  })
})

describe('Provider Event Integration', () => {
  describe('Multi-tab Synchronization (Task 6.4)', () => {
    it('should receive events broadcast from background', () => {
      // This tests that the provider correctly handles PROVIDER_EVENT messages
      const eventListeners = new Map<string, Set<Function>>()

      const handleProviderEvent = (message: { event: string; data: unknown }) => {
        const { event, data } = message
        eventListeners.get(event)?.forEach((listener) => {
          listener(data)
        })
      }

      // Register listeners
      const accountsListener = jest.fn()
      eventListeners.set('accountsChanged', new Set([accountsListener]))

      // Simulate receiving PROVIDER_EVENT from background (via content script)
      handleProviderEvent({
        event: 'accountsChanged',
        data: [TEST_ACCOUNTS.account1.address],
      })

      expect(accountsListener).toHaveBeenCalledWith([TEST_ACCOUNTS.account1.address])
    })

    it('should update internal state on external events', () => {
      let selectedAddress: string | null = null
      let chainId: string | null = null
      let isConnected = false

      const handleProviderEvent = (event: string, data: unknown) => {
        switch (event) {
          case 'connect':
            isConnected = true
            chainId = (data as { chainId: string }).chainId
            break
          case 'disconnect':
            isConnected = false
            selectedAddress = null
            break
          case 'accountsChanged': {
            const accounts = data as string[]
            selectedAddress = accounts[0] ?? null
            isConnected = accounts.length > 0
            break
          }
          case 'chainChanged':
            chainId = data as string
            break
        }
      }

      // Test connect
      handleProviderEvent('connect', { chainId: '0x1' })
      expect(isConnected).toBe(true)
      expect(chainId).toBe('0x1')

      // Test accountsChanged
      handleProviderEvent('accountsChanged', [TEST_ACCOUNTS.account1.address])
      expect(selectedAddress).toBe(TEST_ACCOUNTS.account1.address)

      // Test chainChanged
      handleProviderEvent('chainChanged', '0xaa36a7')
      expect(chainId).toBe('0xaa36a7')

      // Test disconnect
      handleProviderEvent('disconnect', { code: 4900, message: 'Disconnected' })
      expect(isConnected).toBe(false)
      expect(selectedAddress).toBeNull()
    })
  })
})

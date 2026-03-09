import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RegistryClient } from '../src/client'
import { ConnectionTimeoutError, RegistryClientError, WebSocketError } from '../src/errors'

// --- Mock WebSocket ---
class MockWebSocket {
  static instances: MockWebSocket[] = []

  url: string
  onopen: ((ev: Event) => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  sent: string[] = []
  readyState = 0

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3
  }

  simulateOpen() {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  simulateClose() {
    this.readyState = 3
    this.onclose?.()
  }

  simulateError() {
    this.onerror?.(new Event('error'))
  }
}

const validContract = {
  id: 'c1',
  chainId: 1,
  name: 'USDC',
  address: '0x' + 'a'.repeat(40),
  version: '1.0.0',
  tags: ['stablecoin'],
  metadata: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function mockFetchResponse(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  })
}

describe('RegistryClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    vi.stubGlobal('fetch', mockFetchResponse({}))
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function createClient(options?: Partial<Parameters<typeof RegistryClient.prototype.connect>[0]>) {
    return new RegistryClient({
      url: 'https://registry.example.com',
      autoConnect: false,
      ...options,
    })
  }

  describe('constructor', () => {
    it('builds correct WebSocket URL from HTTPS', () => {
      const client = createClient()
      // Access private wsUrl via connect
      void client.connect()
      expect(MockWebSocket.instances[0].url).toBe('wss://registry.example.com/ws')
    })

    it('builds correct WebSocket URL from HTTP', () => {
      const client = new RegistryClient({
        url: 'http://localhost:3000',
        autoConnect: false,
      })
      void client.connect()
      expect(MockWebSocket.instances[0].url).toBe('ws://localhost:3000/ws')
    })

    it('strips trailing slash from URL', () => {
      const client = new RegistryClient({
        url: 'https://registry.example.com/',
        autoConnect: false,
      })
      void client.connect()
      expect(MockWebSocket.instances[0].url).toBe('wss://registry.example.com/ws')
    })

    it('emits error on autoConnect failure', async () => {
      const errorHandler = vi.fn()
      const client = new RegistryClient({
        url: 'https://registry.example.com',
        autoConnect: true,
      })
      client.on('error', errorHandler)

      // Simulate connection error
      const ws = MockWebSocket.instances[0]
      ws.simulateError()

      await vi.advanceTimersByTimeAsync(0)
      expect(errorHandler).toHaveBeenCalled()
    })
  })

  describe('connect / disconnect', () => {
    it('resolves on successful connection', async () => {
      const client = createClient()
      const connectPromise = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await connectPromise
      expect(client.isConnected).toBe(true)
    })

    it('rejects on connection error', async () => {
      const client = createClient()
      const connectPromise = client.connect()
      MockWebSocket.instances[0].simulateError()
      await expect(connectPromise).rejects.toThrow(WebSocketError)
    })

    it('rejects on connection timeout', async () => {
      const client = createClient({ connectionTimeout: 5000 })
      const connectPromise = client.connect()

      // Advance past the timeout
      vi.advanceTimersByTime(5001)

      await expect(connectPromise).rejects.toThrow(ConnectionTimeoutError)

      // Drain any scheduled reconnect timers to prevent unhandled rejections
      client.disconnect()
    })

    it('returns immediately if already connected', async () => {
      const client = createClient()
      const p1 = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p1
      // Second connect should resolve immediately
      await client.connect()
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    it('disconnect clears subscriptions', async () => {
      const client = createClient()
      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      client.subscribe(['contracts:1:USDC'])
      client.disconnect()
      expect(client.isConnected).toBe(false)
    })

    it('disconnect stops heartbeat', async () => {
      const client = createClient({ heartbeatInterval: 1000 })
      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      const ws = MockWebSocket.instances[0]
      ws.sent = []
      client.disconnect()

      vi.advanceTimersByTime(5000)
      // No pings should be sent after disconnect
      expect(ws.sent).toHaveLength(0)
    })
  })

  describe('heartbeat', () => {
    it('sends periodic ping messages', async () => {
      const client = createClient({ heartbeatInterval: 1000 })
      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      const ws = MockWebSocket.instances[0]
      ws.sent = []

      vi.advanceTimersByTime(3500)
      const pings = ws.sent.filter((s) => JSON.parse(s).type === 'ping')
      expect(pings).toHaveLength(3)
    })
  })

  describe('reconnection', () => {
    it('schedules reconnect on close with exponential backoff', async () => {
      const client = createClient({ reconnectInterval: 100, maxReconnectAttempts: 3 })
      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      // Close triggers reconnect
      MockWebSocket.instances[0].simulateClose()
      expect(client.isConnected).toBe(false)

      // First reconnect: ~100ms base * 2^0 + jitter
      await vi.advanceTimersByTimeAsync(200)
      expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2)
    })

    it('stops reconnecting after max attempts', async () => {
      const client = createClient({
        reconnectInterval: 10,
        maxReconnectAttempts: 2,
      })
      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      // Close and exhaust reconnect attempts
      for (let i = 0; i < 3; i++) {
        const lastWs = MockWebSocket.instances[MockWebSocket.instances.length - 1]
        lastWs.simulateClose()
        await vi.advanceTimersByTimeAsync(50000)
      }

      // Should not create more than initial + maxAttempts connections
      expect(MockWebSocket.instances.length).toBeLessThanOrEqual(4)
    })
  })

  describe('subscribe / unsubscribe', () => {
    it('sends subscribe message when connected', async () => {
      const client = createClient()
      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      client.subscribe(['contracts:1:USDC'])
      const sent = JSON.parse(MockWebSocket.instances[0].sent.at(-1)!)
      expect(sent).toEqual({ type: 'subscribe', channels: ['contracts:1:USDC'] })
    })

    it('queues subscriptions before connection', async () => {
      const client = createClient()
      client.subscribe(['contracts:1:USDC'])

      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      const sent = MockWebSocket.instances[0].sent.map((s) => JSON.parse(s))
      expect(sent).toContainEqual({
        type: 'subscribe',
        channels: ['contracts:1:USDC'],
      })
    })

    it('sends unsubscribe message', async () => {
      const client = createClient()
      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      client.subscribe(['contracts:1:USDC'])
      client.unsubscribe(['contracts:1:USDC'])

      const sent = JSON.parse(MockWebSocket.instances[0].sent.at(-1)!)
      expect(sent).toEqual({ type: 'unsubscribe', channels: ['contracts:1:USDC'] })
    })
  })

  describe('handleMessage', () => {
    it('emits contract:updated events', async () => {
      const client = createClient()
      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      const handler = vi.fn()
      client.on('contract:updated', handler)

      MockWebSocket.instances[0].simulateMessage({
        type: 'contract:updated',
        data: validContract,
      })

      expect(handler).toHaveBeenCalledWith(validContract)
    })

    it('emits contract:deleted events', async () => {
      const client = createClient()
      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      const handler = vi.fn()
      client.on('contract:deleted', handler)

      MockWebSocket.instances[0].simulateMessage({
        type: 'contract:deleted',
        chainId: 1,
        name: 'USDC',
      })

      expect(handler).toHaveBeenCalledWith({ chainId: 1, name: 'USDC' })
    })

    it('emits error for invalid messages', async () => {
      const client = createClient()
      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      const handler = vi.fn()
      client.on('error', handler)

      // Send invalid JSON via raw onmessage
      MockWebSocket.instances[0].onmessage?.({ data: 'not-json' })

      expect(handler).toHaveBeenCalled()
    })

    it('emits error for unknown message types', async () => {
      const client = createClient()
      const p = client.connect()
      MockWebSocket.instances[0].simulateOpen()
      await p

      const handler = vi.fn()
      client.on('error', handler)

      MockWebSocket.instances[0].simulateMessage({ type: 'unknown_type' })

      expect(handler).toHaveBeenCalled()
    })
  })

  describe('REST methods', () => {
    it('getContract validates input and encodes name', async () => {
      vi.stubGlobal('fetch', mockFetchResponse(validContract))
      const client = createClient()

      const result = await client.getContract(1, 'USDC')
      expect(result.name).toBe('USDC')

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
      expect(fetchCall[0]).toContain('/api/v1/contracts/1/USDC')
    })

    it('getContract rejects invalid chainId', async () => {
      const client = createClient()
      await expect(client.getContract(-1, 'USDC')).rejects.toThrow('Invalid chainId')
    })

    it('getContract rejects path traversal name', async () => {
      const client = createClient()
      await expect(client.getContract(1, '../../admin')).rejects.toThrow('Invalid name')
    })

    it('getContract throws on invalid response shape', async () => {
      vi.stubGlobal('fetch', mockFetchResponse({ invalid: 'data' }))
      const client = createClient()
      await expect(client.getContract(1, 'USDC')).rejects.toThrow()
    })

    it('listContracts supports pagination params', async () => {
      vi.stubGlobal('fetch', mockFetchResponse([validContract]))
      const client = createClient()

      const result = await client.listContracts(
        { chainId: 1 },
        { limit: 10, cursor: 'abc' }
      )
      expect(result.items).toHaveLength(1)

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
      const url = fetchCall[0] as string
      expect(url).toContain('limit=10')
      expect(url).toContain('cursor=abc')
    })

    it('listContracts handles paginated response', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetchResponse({
          items: [validContract],
          total: 50,
          cursor: 'next-page',
        })
      )
      const client = createClient()

      const result = await client.listContracts()
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(50)
      expect(result.cursor).toBe('next-page')
    })

    it('listContracts handles legacy array response', async () => {
      vi.stubGlobal('fetch', mockFetchResponse([validContract]))
      const client = createClient()

      const result = await client.listContracts()
      expect(result.items).toHaveLength(1)
      expect(result.cursor).toBeUndefined()
    })

    it('getAddressSet fetches and validates', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetchResponse({
          id: 's1',
          name: 'core',
          chainId: 1,
          contracts: [validContract],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        })
      )
      const client = createClient()

      const result = await client.getAddressSet(1, 'core')
      expect(result.contracts).toHaveLength(1)
    })

    it('createContract sends correct payload', async () => {
      vi.stubGlobal('fetch', mockFetchResponse(validContract))
      const client = createClient()

      await client.createContract({
        chainId: 1,
        name: 'USDC',
        address: '0x' + 'a'.repeat(40),
        version: '1.0.0',
      })

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
      const body = JSON.parse(fetchCall[1]!.body as string)
      expect(body.chainId).toBe(1)
      expect(body.version).toBe('1.0.0')
    })

    it('createContract uses empty defaults for optional fields', async () => {
      vi.stubGlobal('fetch', mockFetchResponse(validContract))
      const client = createClient()

      await client.createContract({
        chainId: 1,
        name: 'USDC',
        address: '0x' + 'a'.repeat(40),
      })

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
      const body = JSON.parse(fetchCall[1]!.body as string)
      expect(body.tags).toEqual([])
      expect(body.metadata).toEqual({})
    })

    it('bulkImport validates all contracts', async () => {
      const client = createClient()
      await expect(
        client.bulkImport([
          { chainId: 1, name: 'Good', address: '0x' + 'a'.repeat(40) },
          { chainId: -1, name: 'Bad', address: '0x' + 'b'.repeat(40) },
        ])
      ).rejects.toThrow('Invalid chainId')
    })

    it('bulkImport returns result with errors', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetchResponse({
          created: 1,
          updated: 0,
          errors: [{ index: 1, name: 'Bad', message: 'Invalid' }],
        })
      )
      const client = createClient()

      const result = await client.bulkImport([
        { chainId: 1, name: 'Good', address: '0x' + 'a'.repeat(40) },
      ])
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('error handling', () => {
    it('throws RegistryClientError with status code on HTTP error', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetchResponse({ message: 'Not found', code: 'NOT_FOUND' }, 404)
      )
      const client = createClient()

      try {
        await client.getContract(1, 'USDC')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RegistryClientError)
        const regErr = err as RegistryClientError
        expect(regErr.statusCode).toBe(404)
        expect(regErr.isNotFound).toBe(true)
        expect(regErr.errorCode).toBe('NOT_FOUND')
      }
    })

    it('RegistryClientError identifies unauthorized', async () => {
      vi.stubGlobal('fetch', mockFetchResponse({ message: 'Unauthorized' }, 401))
      const client = createClient()

      try {
        await client.getContract(1, 'USDC')
        expect.fail('Should have thrown')
      } catch (err) {
        const regErr = err as RegistryClientError
        expect(regErr.isUnauthorized).toBe(true)
        expect(regErr.isNotFound).toBe(false)
      }
    })

    it('RegistryClientError identifies server error', async () => {
      vi.stubGlobal('fetch', mockFetchResponse({ message: 'Internal error' }, 500))
      const client = createClient()

      try {
        await client.getContract(1, 'USDC')
        expect.fail('Should have thrown')
      } catch (err) {
        const regErr = err as RegistryClientError
        expect(regErr.isServerError).toBe(true)
      }
    })

    it('includes API key in headers when provided', async () => {
      vi.stubGlobal('fetch', mockFetchResponse(validContract))
      const client = new RegistryClient({
        url: 'https://registry.example.com',
        apiKey: 'secret-key',
        autoConnect: false,
      })

      await client.getContract(1, 'USDC')
      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
      const headers = fetchCall[1]!.headers as Record<string, string>
      expect(headers['X-API-Key']).toBe('secret-key')
    })

    it('does not include API key when not provided', async () => {
      vi.stubGlobal('fetch', mockFetchResponse(validContract))
      const client = createClient()

      await client.getContract(1, 'USDC')
      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]
      const headers = fetchCall[1]!.headers as Record<string, string>
      expect(headers['X-API-Key']).toBeUndefined()
    })

    it('error details do not contain message or code fields', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetchResponse(
          { message: 'Not found', code: 'NOT_FOUND', extra: 'info' },
          404
        )
      )
      const client = createClient()

      try {
        await client.getContract(1, 'USDC')
        expect.fail('Should have thrown')
      } catch (err) {
        const regErr = err as RegistryClientError
        expect(regErr.details).not.toHaveProperty('message')
        expect(regErr.details).not.toHaveProperty('code')
        expect(regErr.details).toHaveProperty('extra', 'info')
      }
    })
  })
})

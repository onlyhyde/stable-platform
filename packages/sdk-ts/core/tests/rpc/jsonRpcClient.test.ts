/**
 * JSON-RPC Client Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RpcError } from '../../src/rpc/errors'
import {
  createBundlerRpcClient,
  createJsonRpcClient,
  createPaymasterRpcClient,
} from '../../src/rpc/jsonRpcClient'

// Helper to create a mock fetch response
function mockFetchResponse(body: unknown, options?: { status?: number; statusText?: string }) {
  return {
    ok: (options?.status ?? 200) >= 200 && (options?.status ?? 200) < 300,
    status: options?.status ?? 200,
    statusText: options?.statusText ?? 'OK',
    json: () => Promise.resolve(body),
  } as Response
}

describe('createJsonRpcClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('basic configuration', () => {
    it('should create a client with the given URL', () => {
      const client = createJsonRpcClient({ url: 'https://rpc.example.com' })
      expect(client.url).toBe('https://rpc.example.com')
    })

    it('should expose request and isAvailable methods', () => {
      const client = createJsonRpcClient({ url: 'https://rpc.example.com' })
      expect(typeof client.request).toBe('function')
      expect(typeof client.isAvailable).toBe('function')
    })
  })

  describe('request', () => {
    it('should make a successful JSON-RPC request', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 1, result: '0x1' }))

      const client = createJsonRpcClient({ url: 'https://rpc.example.com', maxRetries: 0 })
      const result = await client.request<string>('eth_chainId', [])

      expect(result).toBe('0x1')
      expect(fetchSpy).toHaveBeenCalledOnce()

      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toBe('https://rpc.example.com')
      expect(options?.method).toBe('POST')

      const body = JSON.parse(options?.body as string)
      expect(body.jsonrpc).toBe('2.0')
      expect(body.method).toBe('eth_chainId')
      expect(body.params).toEqual([])
      expect(body.id).toBe(1)
    })

    it('should increment request IDs', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 1, result: '0x1' }))
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 2, result: '0x2' }))

      const client = createJsonRpcClient({ url: 'https://rpc.example.com', maxRetries: 0 })
      await client.request('eth_chainId', [])
      await client.request('eth_blockNumber', [])

      const calls = vi.mocked(globalThis.fetch).mock.calls
      const body1 = JSON.parse(calls[0]![1]?.body as string)
      const body2 = JSON.parse(calls[1]![1]?.body as string)
      expect(body2.id).toBeGreaterThan(body1.id)
    })

    it('should include Content-Type header', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 1, result: null }))

      const client = createJsonRpcClient({ url: 'https://rpc.example.com', maxRetries: 0 })
      await client.request('eth_chainId', [])

      const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Authorization header when apiKey is provided', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 1, result: null }))

      const client = createJsonRpcClient({
        url: 'https://rpc.example.com',
        apiKey: 'test-key',
        maxRetries: 0,
      })
      await client.request('eth_chainId', [])

      const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer test-key')
    })

    it('should include custom headers', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 1, result: null }))

      const client = createJsonRpcClient({
        url: 'https://rpc.example.com',
        headers: { 'X-Custom': 'value' },
        maxRetries: 0,
      })
      await client.request('eth_chainId', [])

      const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>
      expect(headers['X-Custom']).toBe('value')
    })

    it('should allow per-request custom headers', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 1, result: null }))

      const client = createJsonRpcClient({ url: 'https://rpc.example.com', maxRetries: 0 })
      await client.request('eth_chainId', [], { headers: { 'X-Request': 'test' } })

      const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>
      expect(headers['X-Request']).toBe('test')
    })
  })

  describe('error handling', () => {
    it('should throw RpcError on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(null, { status: 500, statusText: 'Internal Server Error' })
      )

      const client = createJsonRpcClient({ url: 'https://rpc.example.com', maxRetries: 0 })
      try {
        await client.request('eth_chainId', [])
        expect.unreachable('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RpcError)
        expect((err as RpcError).type).toBe('HTTP_ERROR')
      }
    })

    it('should throw RpcError on JSON-RPC error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32601, message: 'Method not found' },
        })
      )

      const client = createJsonRpcClient({ url: 'https://rpc.example.com', maxRetries: 0 })
      await expect(client.request('nonexistent_method', [])).rejects.toThrow(RpcError)
    })

    it('should throw RpcError on invalid JSON response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response)

      const client = createJsonRpcClient({ url: 'https://rpc.example.com', maxRetries: 0 })
      await expect(client.request('eth_chainId', [])).rejects.toThrow(RpcError)
    })

    it('should throw timeout error on AbortError', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        Object.assign(new Error('Aborted'), { name: 'AbortError' })
      )

      const client = createJsonRpcClient({
        url: 'https://rpc.example.com',
        maxRetries: 0,
        timeout: 5000,
      })
      await expect(client.request('eth_chainId', [])).rejects.toMatchObject({
        type: 'TIMEOUT',
      })
    })

    it('should throw network error on TypeError', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        Object.assign(new Error('Failed to fetch'), { name: 'TypeError' })
      )

      const client = createJsonRpcClient({ url: 'https://rpc.example.com', maxRetries: 0 })
      await expect(client.request('eth_chainId', [])).rejects.toMatchObject({
        type: 'NETWORK',
      })
    })
  })

  describe('retry logic', () => {
    it('should retry on timeout errors', async () => {
      const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' })
      vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 2, result: '0x1' }))

      const client = createJsonRpcClient({
        url: 'https://rpc.example.com',
        maxRetries: 1,
        retryDelay: 1,
      })
      const result = await client.request<string>('eth_chainId', [])
      expect(result).toBe('0x1')
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('should retry on network errors', async () => {
      const networkError = Object.assign(new Error('ECONNREFUSED'), { name: 'TypeError' })
      vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 2, result: '0x1' }))

      const client = createJsonRpcClient({
        url: 'https://rpc.example.com',
        maxRetries: 1,
        retryDelay: 1,
      })
      const result = await client.request<string>('eth_chainId', [])
      expect(result).toBe('0x1')
    })

    it('should not retry on non-retryable errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32601, message: 'Method not found' },
        })
      )

      const client = createJsonRpcClient({
        url: 'https://rpc.example.com',
        maxRetries: 3,
        retryDelay: 1,
      })
      await expect(client.request('nonexistent', [])).rejects.toThrow()
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    it('should retry on 429 HTTP errors', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          mockFetchResponse(null, { status: 429, statusText: 'Too Many Requests' })
        )
        .mockResolvedValueOnce(mockFetchResponse({ jsonrpc: '2.0', id: 2, result: '0x1' }))

      const client = createJsonRpcClient({
        url: 'https://rpc.example.com',
        maxRetries: 1,
        retryDelay: 1,
      })
      const result = await client.request<string>('eth_chainId', [])
      expect(result).toBe('0x1')
    })

    it('should exhaust retries and throw final error', async () => {
      const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' })
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortError)

      const client = createJsonRpcClient({
        url: 'https://rpc.example.com',
        maxRetries: 2,
        retryDelay: 1,
      })
      await expect(client.request('eth_chainId', [])).rejects.toThrow(RpcError)
      expect(globalThis.fetch).toHaveBeenCalledTimes(3) // initial + 2 retries
    })

    it('should respect per-request retry override', async () => {
      const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' })
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortError)

      const client = createJsonRpcClient({
        url: 'https://rpc.example.com',
        maxRetries: 5,
        retryDelay: 1,
      })
      await expect(client.request('eth_chainId', [], { retries: 0 })).rejects.toThrow()
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('isAvailable', () => {
    it('should return true when endpoint responds', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ jsonrpc: '2.0', id: 1, result: '0x1' })
      )

      const client = createJsonRpcClient({ url: 'https://rpc.example.com' })
      expect(await client.isAvailable()).toBe(true)
    })

    it('should return false when endpoint fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection refused'))

      const client = createJsonRpcClient({ url: 'https://rpc.example.com' })
      expect(await client.isAvailable()).toBe(false)
    })
  })
})

describe('createBundlerRpcClient', () => {
  it('should create a client with the given URL', () => {
    const client = createBundlerRpcClient('https://bundler.example.com')
    expect(client.url).toBe('https://bundler.example.com')
  })

  it('should accept optional configuration', () => {
    const client = createBundlerRpcClient('https://bundler.example.com', {
      apiKey: 'key',
      timeout: 5000,
    })
    expect(client.url).toBe('https://bundler.example.com')
  })
})

describe('createPaymasterRpcClient', () => {
  it('should create a client with URL and apiKey', () => {
    const client = createPaymasterRpcClient('https://paymaster.example.com', 'api-key')
    expect(client.url).toBe('https://paymaster.example.com')
  })

  it('should work without apiKey', () => {
    const client = createPaymasterRpcClient('https://paymaster.example.com')
    expect(client.url).toBe('https://paymaster.example.com')
  })
})

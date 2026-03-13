/**
 * Minimal JSON-RPC transport for read-only calls.
 *
 * Enables eth_call, eth_getBalance, etc. without a wallet connection.
 * Uses a public RPC endpoint for direct JSON-RPC requests.
 */
import { createLogger } from './logger'

const log = createLogger('ReadOnly')

export class ReadOnlyTransport {
  private readonly rpcUrl: string
  private nextId = 1

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl
  }

  async request(method: string, params?: unknown[]): Promise<unknown> {
    const id = this.nextId++
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params: params ?? [],
    })

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as {
      result?: unknown
      error?: { code: number; message: string }
    }

    if (json.error) {
      log.warn('RPC error', { method, code: json.error.code, message: json.error.message })
      const err = new Error(json.error.message) as Error & { code: number }
      err.code = json.error.code
      throw err
    }

    return json.result
  }
}

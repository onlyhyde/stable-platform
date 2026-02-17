import EventEmitter from 'eventemitter3'
import type {
  ClientMessage,
  ContractEntry,
  ContractFilter,
  ImportResult,
  RegistryClientOptions,
  ResolvedAddressSet,
  ServerMessage,
} from './types'

type ClientEvent =
  | 'connected'
  | 'disconnected'
  | 'contract:updated'
  | 'contract:deleted'
  | 'set:updated'
  | 'set:deleted'
  | 'error'

export class RegistryClient extends EventEmitter<ClientEvent> {
  private readonly baseUrl: string
  private readonly wsUrl: string
  private readonly apiKey?: string
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private readonly reconnectInterval: number
  private readonly maxReconnectAttempts: number
  private reconnectAttempts = 0
  private _isConnected = false
  private subscribedChannels = new Set<string>()

  constructor(options: RegistryClientOptions) {
    super()
    this.baseUrl = options.url.replace(/\/$/, '')
    this.wsUrl = `${this.baseUrl.replace(/^http/, 'ws')}/ws`
    this.apiKey = options.apiKey
    this.reconnectInterval = options.reconnectInterval ?? 3000
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10

    if (options.autoConnect !== false) {
      this.connect().catch(() => {})
    }
  }

  get isConnected(): boolean {
    return this._isConnected
  }

  async getContract(chainId: number, name: string): Promise<ContractEntry> {
    const res = await this.fetch(`/api/v1/contracts/${chainId}/${name}`)
    return res as ContractEntry
  }

  async listContracts(filter?: ContractFilter): Promise<ContractEntry[]> {
    const params = new URLSearchParams()
    if (filter?.chainId !== undefined) params.set('chainId', String(filter.chainId))
    if (filter?.tag) params.set('tag', filter.tag)
    if (filter?.name) params.set('name', filter.name)

    const query = params.toString()
    const res = await this.fetch(`/api/v1/contracts${query ? `?${query}` : ''}`)
    return res as ContractEntry[]
  }

  async getAddressSet(chainId: number, name: string): Promise<ResolvedAddressSet> {
    const res = await this.fetch(`/api/v1/sets/${chainId}/${name}`)
    return res as ResolvedAddressSet
  }

  async createContract(data: {
    chainId: number
    name: string
    address: string
    version?: string
    tags?: string[]
    metadata?: Record<string, unknown>
  }): Promise<ContractEntry> {
    const res = await this.fetch('/api/v1/contracts', {
      method: 'POST',
      body: JSON.stringify({
        version: '0.1.0',
        tags: [],
        metadata: {},
        ...data,
      }),
    })
    return res as ContractEntry
  }

  async bulkImport(
    contracts: Array<{
      chainId: number
      name: string
      address: string
      version?: string
      tags?: string[]
      metadata?: Record<string, unknown>
    }>
  ): Promise<ImportResult> {
    const res = await this.fetch('/api/v1/bulk/import', {
      method: 'POST',
      body: JSON.stringify({
        contracts: contracts.map((c) => ({
          version: '0.1.0',
          tags: [],
          metadata: {},
          ...c,
        })),
      }),
    })
    return res as ImportResult
  }

  async connect(): Promise<void> {
    if (this._isConnected) return

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl)

        this.ws.onopen = () => {
          this._isConnected = true
          this.reconnectAttempts = 0
          this.emit('connected')

          if (this.subscribedChannels.size > 0) {
            this.sendWs({
              type: 'subscribe',
              channels: [...this.subscribedChannels],
            })
          }

          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(String(event.data))
        }

        this.ws.onclose = () => {
          this._isConnected = false
          this.emit('disconnected')
          this.scheduleReconnect()
        }

        this.ws.onerror = (event) => {
          if (!this._isConnected) {
            reject(new Error('WebSocket connection failed'))
          }
          this.emit('error', event)
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = this.maxReconnectAttempts

    if (this.ws) {
      // Clear event handlers to prevent leaks on reconnect
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.close()
      this.ws = null
    }

    this._isConnected = false
  }

  subscribe(channels: string[]): void {
    for (const ch of channels) {
      this.subscribedChannels.add(ch)
    }

    if (this._isConnected) {
      this.sendWs({ type: 'subscribe', channels })
    }
  }

  unsubscribe(channels: string[]): void {
    for (const ch of channels) {
      this.subscribedChannels.delete(ch)
    }

    if (this._isConnected) {
      this.sendWs({ type: 'unsubscribe', channels })
    }
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw) as ServerMessage

      switch (msg.type) {
        case 'contract:updated':
          this.emit('contract:updated', msg.data)
          break
        case 'contract:deleted':
          this.emit('contract:deleted', { chainId: msg.chainId, name: msg.name })
          break
        case 'set:updated':
          this.emit('set:updated', msg.data)
          break
        case 'set:deleted':
          this.emit('set:deleted', { chainId: msg.chainId, name: msg.name })
          break
        case 'error':
          this.emit('error', new Error(msg.message))
          break
      }
    } catch (err) {
      this.emit(
        'error',
        new Error(
          `Failed to parse WebSocket message: ${err instanceof Error ? err.message : String(err)}`
        )
      )
    }
  }

  private sendWs(msg: ClientMessage): void {
    if (this.ws && this._isConnected) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect().catch(() => {})
    }, this.reconnectInterval)
  }

  private async fetch(path: string, init?: RequestInit): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey
    }

    const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers as Record<string, string>),
      },
    })

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
      throw new Error((body.message as string) ?? `Request failed: ${res.status} ${res.statusText}`)
    }

    return res.json()
  }
}

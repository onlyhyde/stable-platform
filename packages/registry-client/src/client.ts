import EventEmitter from 'eventemitter3'
import {
  ConnectionTimeoutError,
  RegistryClientError,
  WebSocketError,
} from './errors'
import {
  ContractEntryListSchema,
  ContractEntrySchema,
  ImportResultSchema,
  ResolvedAddressSetSchema,
  ServerMessageSchema,
  validateChainId,
  validateName,
} from './schemas'
import type {
  ClientMessage,
  ContractEntry,
  ContractFilter,
  CreateContractInput,
  ImportResult,
  PaginatedResult,
  PaginationParams,
  RegistryClientOptions,
  ResolvedAddressSet,
  ServerMessage,
} from './types'

const DEFAULT_RECONNECT_INTERVAL = 1000
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10
const DEFAULT_CONNECTION_TIMEOUT = 10_000
const DEFAULT_HEARTBEAT_INTERVAL = 30_000
const MAX_RECONNECT_DELAY = 30_000

type ClientEvent =
  | 'connected'
  | 'disconnected'
  | 'contract:updated'
  | 'contract:deleted'
  | 'set:updated'
  | 'set:deleted'
  | 'error'

function buildWsUrl(httpUrl: string): string {
  const url = new URL(httpUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = url.pathname.replace(/\/$/, '') + '/ws'
  return url.toString()
}

export class RegistryClient extends EventEmitter<ClientEvent> {
  private readonly baseUrl: string
  private readonly wsUrl: string
  private readonly apiKey?: string
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private readonly baseReconnectInterval: number
  private readonly maxReconnectAttempts: number
  private readonly connectionTimeout: number
  private readonly heartbeatInterval: number
  private reconnectAttempts = 0
  private _isConnected = false
  private subscribedChannels = new Set<string>()

  constructor(options: RegistryClientOptions) {
    super()
    this.baseUrl = options.url.replace(/\/$/, '')
    this.wsUrl = buildWsUrl(options.url)
    this.apiKey = options.apiKey
    this.baseReconnectInterval = options.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS
    this.connectionTimeout = options.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT
    this.heartbeatInterval = options.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL

    if (options.autoConnect !== false) {
      this.connect().catch((err) => {
        this.emit('error', err instanceof Error ? err : new Error(String(err)))
      })
    }
  }

  get isConnected(): boolean {
    return this._isConnected
  }

  async getContract(chainId: number, name: string): Promise<ContractEntry> {
    validateChainId(chainId)
    validateName(name)
    const res = await this.fetch(
      `/api/v1/contracts/${chainId}/${encodeURIComponent(name)}`
    )
    return ContractEntrySchema.parse(res)
  }

  async listContracts(
    filter?: ContractFilter,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<ContractEntry>> {
    const params = new URLSearchParams()
    if (filter?.chainId !== undefined) {
      validateChainId(filter.chainId)
      params.set('chainId', String(filter.chainId))
    }
    if (filter?.tag) params.set('tag', filter.tag)
    if (filter?.name) params.set('name', filter.name)
    if (pagination?.limit !== undefined) params.set('limit', String(pagination.limit))
    if (pagination?.cursor) params.set('cursor', pagination.cursor)

    const query = params.toString()
    const res = await this.fetch(`/api/v1/contracts${query ? `?${query}` : ''}`)

    // Support both paginated and legacy array responses
    if (Array.isArray(res)) {
      const items = ContractEntryListSchema.parse(res)
      return { items, total: items.length, cursor: undefined }
    }

    const body = res as Record<string, unknown>
    const items = ContractEntryListSchema.parse(body.items ?? body.data ?? [])
    return {
      items,
      total: typeof body.total === 'number' ? body.total : items.length,
      cursor: typeof body.cursor === 'string' ? body.cursor : undefined,
    }
  }

  async getAddressSet(chainId: number, name: string): Promise<ResolvedAddressSet> {
    validateChainId(chainId)
    validateName(name)
    const res = await this.fetch(
      `/api/v1/sets/${chainId}/${encodeURIComponent(name)}`
    )
    return ResolvedAddressSetSchema.parse(res)
  }

  async createContract(data: CreateContractInput): Promise<ContractEntry> {
    validateChainId(data.chainId)
    validateName(data.name)
    const res = await this.fetch('/api/v1/contracts', {
      method: 'POST',
      body: JSON.stringify({
        tags: [],
        metadata: {},
        ...data,
      }),
    })
    return ContractEntrySchema.parse(res)
  }

  async bulkImport(contracts: CreateContractInput[]): Promise<ImportResult> {
    for (const c of contracts) {
      validateChainId(c.chainId)
      validateName(c.name)
    }
    const res = await this.fetch('/api/v1/bulk/import', {
      method: 'POST',
      body: JSON.stringify({
        contracts: contracts.map((c) => ({
          tags: [],
          metadata: {},
          ...c,
        })),
      }),
    })
    return ImportResultSchema.parse(res)
  }

  async connect(): Promise<void> {
    if (this._isConnected) return

    return new Promise((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          fn()
        }
      }

      const timer = setTimeout(() => {
        settle(() => {
          if (this.ws) {
            this.ws.onopen = null
            this.ws.onerror = null
            this.ws.close()
          }
          reject(new ConnectionTimeoutError(this.connectionTimeout))
        })
      }, this.connectionTimeout)

      try {
        this.ws = new WebSocket(this.wsUrl)

        this.ws.onopen = () => {
          settle(() => {
            this._isConnected = true
            this.reconnectAttempts = 0
            this.emit('connected')
            this.startHeartbeat()

            if (this.subscribedChannels.size > 0) {
              this.sendWs({
                type: 'subscribe',
                channels: [...this.subscribedChannels],
              })
            }

            resolve()
          })
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(String(event.data))
        }

        this.ws.onclose = () => {
          this.stopHeartbeat()
          this._isConnected = false
          this.emit('disconnected')
          this.scheduleReconnect()
        }

        this.ws.onerror = (event) => {
          settle(() => {
            reject(new WebSocketError('WebSocket connection failed'))
          })
          this.emit('error', event)
        }
      } catch (err) {
        settle(() => reject(err))
      }
    })
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()
    this.reconnectAttempts = this.maxReconnectAttempts
    this.subscribedChannels.clear()

    if (this.ws) {
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

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.sendWs({ type: 'ping' })
    }, this.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private handleMessage(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as unknown
      const msg: ServerMessage = ServerMessageSchema.parse(parsed)

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
        case 'pong':
        case 'subscribed':
        case 'unsubscribed':
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

  private getReconnectDelay(): number {
    const exponentialDelay = this.baseReconnectInterval * 2 ** this.reconnectAttempts
    const jitter = Math.random() * this.baseReconnectInterval
    return Math.min(exponentialDelay + jitter, MAX_RECONNECT_DELAY)
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    const delay = this.getReconnectDelay()

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect().catch((err) => {
        this.emit('error', err instanceof Error ? err : new Error(String(err)))
      })
    }, delay)
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
      const { message: _msg, code: _code, ...safeDetails } = body
      throw new RegistryClientError(
        (body.message as string) ?? `Request failed: ${res.status} ${res.statusText}`,
        res.status,
        body.code as string | undefined,
        safeDetails
      )
    }

    return res.json()
  }
}

export interface ContractEntry {
  readonly id: string
  readonly chainId: number
  readonly name: string
  readonly address: `0x${string}`
  readonly version: string
  readonly tags: readonly string[]
  readonly abi?: string
  readonly deployedAt?: number
  readonly txHash?: `0x${string}`
  readonly metadata: Readonly<Record<string, unknown>>
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ResolvedAddressSet {
  readonly id: string
  readonly name: string
  readonly chainId: number
  readonly contracts: readonly ContractEntry[]
  readonly description?: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ContractFilter {
  readonly chainId?: number
  readonly tag?: string
  readonly name?: string
}

export interface PaginationParams {
  readonly limit?: number
  readonly cursor?: string
}

export interface PaginatedResult<T> {
  readonly items: T[]
  readonly total: number
  readonly cursor: string | undefined
}

export interface CreateContractInput {
  readonly chainId: number
  readonly name: string
  readonly address: string
  readonly version?: string
  readonly tags?: string[]
  readonly metadata?: Record<string, unknown>
}

export interface ImportResult {
  readonly created: number
  readonly updated: number
  readonly errors?: readonly ImportError[]
}

export interface ImportError {
  readonly index: number
  readonly name: string
  readonly message: string
}

export type ClientMessage =
  | { type: 'subscribe'; channels: string[] }
  | { type: 'unsubscribe'; channels: string[] }
  | { type: 'ping' }

export type ServerMessage =
  | { type: 'subscribed'; channels: string[] }
  | { type: 'unsubscribed'; channels: string[] }
  | { type: 'contract:updated'; data: ContractEntry }
  | { type: 'contract:deleted'; chainId: number; name: string }
  | { type: 'set:updated'; data: ResolvedAddressSet }
  | { type: 'set:deleted'; chainId: number; name: string }
  | { type: 'pong' }
  | { type: 'error'; message: string }

export interface RegistryClientOptions {
  readonly url: string
  readonly apiKey?: string
  readonly autoConnect?: boolean
  readonly reconnectInterval?: number
  readonly maxReconnectAttempts?: number
  readonly connectionTimeout?: number
  readonly heartbeatInterval?: number
}

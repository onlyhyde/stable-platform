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

export interface ImportResult {
  readonly created: number
  readonly updated: number
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
}

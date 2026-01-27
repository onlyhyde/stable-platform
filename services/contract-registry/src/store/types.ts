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

export interface AddressSet {
  readonly id: string
  readonly name: string
  readonly chainId: number
  readonly contracts: readonly string[]
  readonly description?: string
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

export type CreateContractInput = Omit<ContractEntry, 'id' | 'createdAt' | 'updatedAt'>

export type CreateSetInput = Omit<AddressSet, 'id' | 'createdAt' | 'updatedAt'>

export type StoreEvent = 'contract:updated' | 'contract:deleted' | 'set:updated' | 'set:deleted'

export interface ImportResult {
  readonly created: number
  readonly updated: number
}

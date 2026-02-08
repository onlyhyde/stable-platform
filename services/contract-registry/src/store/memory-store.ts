import { EventEmitter } from 'node:events'
import { generateId } from '../utils/id'
import type {
  AddressSet,
  ContractEntry,
  ContractFilter,
  CreateContractInput,
  CreateSetInput,
  ImportResult,
  ResolvedAddressSet,
} from './types'

function contractKey(chainId: number, name: string): string {
  return `${chainId}:${name}`
}

function setKey(chainId: number, name: string): string {
  return `${chainId}:${name}`
}

export class InMemoryStore extends EventEmitter {
  private contracts = new Map<string, ContractEntry>()
  private sets = new Map<string, AddressSet>()

  getContract(chainId: number, name: string): ContractEntry | undefined {
    return this.contracts.get(contractKey(chainId, name))
  }

  listContracts(filter?: ContractFilter): ContractEntry[] {
    const entries = [...this.contracts.values()]
    if (!filter) return entries

    return entries.filter((entry) => {
      if (filter.chainId !== undefined && entry.chainId !== filter.chainId) return false
      if (filter.name !== undefined && !entry.name.includes(filter.name)) return false
      if (filter.tag !== undefined && !entry.tags.includes(filter.tag)) return false
      return true
    })
  }

  setContract(input: CreateContractInput): ContractEntry {
    const key = contractKey(input.chainId, input.name)
    const existing = this.contracts.get(key)
    const now = new Date().toISOString()

    const entry: ContractEntry = {
      ...input,
      tags: [...input.tags],
      metadata: { ...input.metadata },
      id: existing?.id ?? generateId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    this.contracts.set(key, entry)
    this.emit('contract:updated', entry)
    return entry
  }

  deleteContract(chainId: number, name: string): boolean {
    const key = contractKey(chainId, name)
    const existed = this.contracts.has(key)
    if (existed) {
      this.contracts.delete(key)
      this.emit('contract:deleted', { chainId, name })
    }
    return existed
  }

  getSet(name: string, chainId: number): ResolvedAddressSet | undefined {
    const addressSet = this.sets.get(setKey(chainId, name))
    if (!addressSet) return undefined

    const contracts = addressSet.contracts
      .map((contractName) => this.contracts.get(contractKey(chainId, contractName)))
      .filter((c): c is ContractEntry => c !== undefined)

    return {
      ...addressSet,
      contracts,
    }
  }

  listSets(chainId?: number): AddressSet[] {
    const entries = [...this.sets.values()]
    if (chainId === undefined) return entries
    return entries.filter((s) => s.chainId === chainId)
  }

  createSet(input: CreateSetInput): AddressSet {
    const key = setKey(input.chainId, input.name)
    const existing = this.sets.get(key)
    const now = new Date().toISOString()

    const addressSet: AddressSet = {
      ...input,
      contracts: [...input.contracts],
      id: existing?.id ?? generateId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    this.sets.set(key, addressSet)
    this.emit('set:updated', addressSet)
    return addressSet
  }

  deleteSet(name: string, chainId: number): boolean {
    const key = setKey(chainId, name)
    const existed = this.sets.has(key)
    if (existed) {
      this.sets.delete(key)
      this.emit('set:deleted', { chainId, name })
    }
    return existed
  }

  importContracts(entries: readonly CreateContractInput[]): ImportResult {
    let created = 0
    let updated = 0

    for (const input of entries) {
      const key = contractKey(input.chainId, input.name)
      const existing = this.contracts.has(key)
      this.setContract(input)
      if (existing) {
        updated++
      } else {
        created++
      }
    }

    return { created, updated }
  }

  getChainIds(): number[] {
    const chainIds = new Set<number>()
    for (const entry of this.contracts.values()) {
      chainIds.add(entry.chainId)
    }
    return [...chainIds].sort((a, b) => a - b)
  }

  getAllContracts(): ContractEntry[] {
    return [...this.contracts.values()]
  }

  getAllSets(): AddressSet[] {
    return [...this.sets.values()]
  }

  loadFromData(contracts: readonly ContractEntry[], sets: readonly AddressSet[]): void {
    this.contracts.clear()
    this.sets.clear()

    for (const entry of contracts) {
      this.contracts.set(contractKey(entry.chainId, entry.name), entry)
    }
    for (const s of sets) {
      this.sets.set(setKey(s.chainId, s.name), s)
    }
  }
}

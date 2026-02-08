import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Logger } from '../utils/logger'
import type { InMemoryStore } from './memory-store'
import type { AddressSet, ContractEntry } from './types'

interface PersistedData<T> {
  readonly version: 1
  readonly updatedAt: string
  readonly entries: readonly T[]
}

export class FilePersistence {
  private readonly contractsPath: string
  private readonly setsPath: string
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly debounceMs: number
  private readonly logger: Logger

  constructor(dataDir: string, logger: Logger, debounceMs = 100) {
    this.contractsPath = join(dataDir, 'contracts.json')
    this.setsPath = join(dataDir, 'sets.json')
    this.debounceMs = debounceMs
    this.logger = logger.child({ module: 'persistence' })
  }

  async load(store: InMemoryStore): Promise<void> {
    const contracts = await this.loadFile<ContractEntry>(this.contractsPath)
    const sets = await this.loadFile<AddressSet>(this.setsPath)

    store.loadFromData(contracts, sets)

    this.logger.info({ contracts: contracts.length, sets: sets.length }, 'Loaded persisted data')
  }

  scheduleSave(store: InMemoryStore): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.save(store).catch((err) => {
        this.logger.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Failed to persist data'
        )
      })
    }, this.debounceMs)
  }

  async save(store: InMemoryStore): Promise<void> {
    const now = new Date().toISOString()

    const contractsData: PersistedData<ContractEntry> = {
      version: 1,
      updatedAt: now,
      entries: store.getAllContracts(),
    }

    const setsData: PersistedData<AddressSet> = {
      version: 1,
      updatedAt: now,
      entries: store.getAllSets(),
    }

    await this.ensureDir(this.contractsPath)
    await Promise.all([
      writeFile(this.contractsPath, JSON.stringify(contractsData, null, 2), 'utf-8'),
      writeFile(this.setsPath, JSON.stringify(setsData, null, 2), 'utf-8'),
    ])

    this.logger.debug('Data persisted to disk')
  }

  async flush(store: InMemoryStore): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    await this.save(store)
  }

  private async loadFile<T>(path: string): Promise<T[]> {
    if (!existsSync(path)) return []

    try {
      const content = await readFile(path, 'utf-8')
      const data = JSON.parse(content) as PersistedData<T>

      if (data.version !== 1) {
        this.logger.warn({ path, version: data.version }, 'Unknown data version, skipping')
        return []
      }

      return [...data.entries]
    } catch (err) {
      this.logger.warn(
        { path, error: err instanceof Error ? err.message : String(err) },
        'Failed to load persisted file'
      )
      return []
    }
  }

  private async ensureDir(filePath: string): Promise<void> {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
  }
}

import { readFile } from 'node:fs/promises'
import { type FSWatcher, watch } from 'chokidar'
import type { InMemoryStore } from '../store/memory-store'
import type { Logger } from '../utils/logger'
import { mapArtifactName } from './artifact-mapper'
import { parseFoundryBroadcast } from './foundry-parser'

export interface FileWatcherOptions {
  readonly watchDir: string
  readonly store: InMemoryStore
  readonly logger: Logger
  readonly debounceMs?: number
  readonly nameMappings?: Record<string, string>
  readonly onImport?: () => void
}

export class FileWatcher {
  private watcher: FSWatcher | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingFiles = new Set<string>()
  private readonly options: Required<
    Pick<FileWatcherOptions, 'watchDir' | 'store' | 'logger' | 'debounceMs'>
  > &
    FileWatcherOptions

  constructor(options: FileWatcherOptions) {
    this.options = {
      debounceMs: 500,
      ...options,
    }
  }

  async start(): Promise<void> {
    if (this.watcher) return

    const { watchDir, logger } = this.options
    const watchLogger = logger.child({ module: 'watcher' })

    this.watcher = watch(`${watchDir}/**/broadcast/**/*.json`, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    })

    this.watcher.on('add', (path) => this.scheduleProcess(path))
    this.watcher.on('change', (path) => this.scheduleProcess(path))

    this.watcher.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      watchLogger.error({ error: message }, 'Watcher error')
    })

    watchLogger.info({ watchDir }, 'File watcher started')
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
  }

  private scheduleProcess(path: string): void {
    this.pendingFiles.add(path)

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      const files = [...this.pendingFiles]
      this.pendingFiles.clear()
      this.processFiles(files).catch((err) => {
        this.options.logger.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Failed to process broadcast files'
        )
      })
    }, this.options.debounceMs)
  }

  private async processFiles(paths: string[]): Promise<void> {
    const { store, logger, nameMappings, onImport } = this.options
    const watchLogger = logger.child({ module: 'watcher' })
    let totalImported = 0

    for (const path of paths) {
      try {
        const content = await readFile(path, 'utf-8')
        const broadcast = parseFoundryBroadcast(content)
        if (!broadcast) continue

        for (const tx of broadcast.transactions) {
          const registryName = mapArtifactName(tx.contractName, nameMappings)

          store.setContract({
            chainId: broadcast.chain,
            name: registryName,
            address: tx.contractAddress as `0x${string}`,
            version: '0.1.0',
            tags: ['foundry', 'auto-imported'],
            txHash: tx.hash ? (tx.hash as `0x${string}`) : undefined,
            metadata: {
              source: 'foundry-broadcast',
              artifactName: tx.contractName,
              broadcastFile: path,
            },
          })
          totalImported++
        }
      } catch (err) {
        watchLogger.warn(
          { path, error: err instanceof Error ? err.message : String(err) },
          'Failed to parse broadcast file'
        )
      }
    }

    if (totalImported > 0) {
      watchLogger.info(
        { files: paths.length, contracts: totalImported },
        'Imported contracts from Foundry broadcasts'
      )
      onImport?.()
    }
  }
}
